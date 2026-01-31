/**
 * LangChain Orchestration Layer
 * 
 * Orchestrates multiple AI services (OpenAI, Google AI) for comprehensive
 * medical reasoning using LangChain's chain and agent patterns.
 * 
 * Documentation:
 * - LangChain JS: https://docs.langchain.com/oss/javascript/langchain/quickstart
 * - Chains: https://docs.langchain.com/oss/javascript/langchain/agents
 * 
 * Features:
 * - Multi-model orchestration (OpenAI + Gemini)
 * - Reasoning chains for medical analysis
 * - Structured output parsing
 * - Automatic fallback handling
 * - Consensus-based diagnosis suggestions
 * 
 * Architecture:
 * 1. Primary Chain: OpenAI GPT-4 for main reasoning
 * 2. Verification Chain: Gemini for second opinion
 * 3. Consensus: Combine results for higher confidence
 */

import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

import { getOpenAIService, type MedicalReasoningRequest, type MedicalReasoningResponse } from "./openaiService";
import { getGoogleAIService, type GeminiMedicalRequest, type GeminiMedicalResponse } from "./googleAIService";

/**
 * Orchestrated analysis result combining multiple AI sources
 */
export interface OrchestratedAnalysis {
  // Combined interpretation
  interpretation: string;
  
  // Consensus results
  consensus: {
    urgencyLevel: string;
    confidence: number;
    agreementLevel: "full" | "partial" | "divergent";
  };
  
  // Individual model results
  openaiResult?: MedicalReasoningResponse;
  geminiResult?: GeminiMedicalResponse;
  
  // Combined suggestions
  combinedConditions: string[];
  combinedRecommendations: string[];
  icd10Codes: Array<{ code: string; description: string }>;
  
  // Red flags from any model
  redFlags: string[];
  
  // Metadata
  modelsUsed: string[];
  processingTime: number;
  source: "orchestrated" | "single" | "fallback";
}

/**
 * LangChain orchestrator configuration
 */
interface OrchestratorConfig {
  openaiApiKey?: string;
  googleApiKey?: string;
  enableMultiModel?: boolean;
  consensusThreshold?: number;
}

/**
 * LangChain Orchestrator class
 * Coordinates multiple AI services for comprehensive medical reasoning
 */
class LangChainOrchestrator {
  private config: OrchestratorConfig = {};
  private openaiChain: RunnableSequence | null = null;
  private isConfigured = false;

  /**
   * Configure the orchestrator with API keys
   */
  configure(config: OrchestratorConfig): void {
    this.config = config;
    
    // Configure individual services
    if (config.openaiApiKey) {
      getOpenAIService().configure(config.openaiApiKey);
      this.setupLangChain(config.openaiApiKey);
    }
    
    if (config.googleApiKey) {
      getGoogleAIService().configure(config.googleApiKey);
    }
    
    this.isConfigured = !!(config.openaiApiKey || config.googleApiKey);
    
    if (this.isConfigured) {
      console.log("LangChain Orchestrator: Configured with", 
        [config.openaiApiKey && "OpenAI", config.googleApiKey && "Gemini"].filter(Boolean).join(" + ")
      );
    }
  }

  /**
   * Set up LangChain components
   */
  private setupLangChain(openaiApiKey: string): void {
    try {
      const model = new ChatOpenAI({
        openAIApiKey: openaiApiKey,
        modelName: "gpt-4-turbo-preview",
        temperature: 0.3,
      });

      const prompt = ChatPromptTemplate.fromMessages([
        ["system", `You are a medical AI assistant analyzing patient symptoms communicated through sign language.
Provide clear, concise clinical interpretations.
Always prioritize patient safety and recommend professional evaluation.`],
        ["human", "{input}"],
      ]);

      this.openaiChain = RunnableSequence.from([
        prompt,
        model,
        new StringOutputParser(),
      ]);
    } catch (error) {
      console.error("LangChain: Failed to setup chain", error);
    }
  }

  /**
   * Check if orchestrator is ready
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    const models: string[] = [];
    if (this.config.openaiApiKey) models.push("openai");
    if (this.config.googleApiKey) models.push("gemini");
    return models;
  }

  /**
   * Perform orchestrated medical analysis
   * Combines results from multiple AI models for higher confidence
   */
  async analyzeWithOrchestration(
    gestureTokens: string[],
    emotionState?: MedicalReasoningRequest["emotionState"],
    bodyState?: MedicalReasoningRequest["bodyState"]
  ): Promise<OrchestratedAnalysis> {
    const startTime = Date.now();
    const modelsUsed: string[] = [];
    
    // Prepare requests
    const openaiRequest: MedicalReasoningRequest = {
      gestureTokens,
      emotionState,
      bodyState,
    };
    
    const geminiRequest: GeminiMedicalRequest = {
      gestureTokens,
      emotionState: emotionState ? {
        painLevel: emotionState.painLevel,
        distress: emotionState.distress,
        anxiety: emotionState.anxiety,
      } : undefined,
    };

    // Run analyses in parallel if both configured
    const promises: Promise<unknown>[] = [];
    
    const openaiService = getOpenAIService();
    const geminiService = getGoogleAIService();
    
    if (openaiService.isReady()) {
      promises.push(openaiService.analyzeMedical(openaiRequest));
      modelsUsed.push("openai");
    }
    
    if (geminiService.isReady()) {
      promises.push(geminiService.analyzeMedical(geminiRequest));
      modelsUsed.push("gemini");
    }

    // If no models available, use rule-based fallback
    if (promises.length === 0) {
      return this.fallbackAnalysis(gestureTokens, emotionState, startTime);
    }

    try {
      const results = await Promise.allSettled(promises);
      
      let openaiResult: MedicalReasoningResponse | undefined;
      let geminiResult: GeminiMedicalResponse | undefined;
      let resultIndex = 0;
      
      if (openaiService.isReady()) {
        const result = results[resultIndex++];
        if (result.status === "fulfilled") {
          openaiResult = result.value as MedicalReasoningResponse;
        }
      }
      
      if (geminiService.isReady()) {
        const result = results[resultIndex];
        if (result.status === "fulfilled") {
          geminiResult = result.value as GeminiMedicalResponse;
        }
      }

      // Combine results
      return this.combineResults(
        openaiResult,
        geminiResult,
        modelsUsed,
        Date.now() - startTime
      );
    } catch (error) {
      console.error("LangChain Orchestrator: Analysis failed", error);
      return this.fallbackAnalysis(gestureTokens, emotionState, startTime);
    }
  }

  /**
   * Quick analysis using LangChain chain (if available)
   */
  async quickAnalysis(input: string): Promise<string> {
    if (this.openaiChain) {
      try {
        return await this.openaiChain.invoke({ input });
      } catch (error) {
        console.error("LangChain: Quick analysis failed", error);
      }
    }
    return `Analysis request: ${input}. Please consult a healthcare provider for evaluation.`;
  }

  /**
   * Combine results from multiple models
   */
  private combineResults(
    openaiResult?: MedicalReasoningResponse,
    geminiResult?: GeminiMedicalResponse,
    modelsUsed: string[] = [],
    processingTime: number = 0
  ): OrchestratedAnalysis {
    // Determine consensus urgency
    const urgencies: string[] = [];
    if (openaiResult) urgencies.push(openaiResult.urgencyLevel);
    if (geminiResult) {
      const severityToUrgency: Record<string, string> = {
        critical: "immediate",
        severe: "emergency",
        moderate: "urgent",
        mild: "non-urgent",
      };
      urgencies.push(severityToUrgency[geminiResult.symptomAnalysis.severity] || "non-urgent");
    }

    const consensusUrgency = this.getConsensusUrgency(urgencies);
    const agreementLevel = this.calculateAgreement(openaiResult, geminiResult);

    // Combine conditions
    const allConditions = new Set<string>();
    if (openaiResult?.possibleConditions) {
      openaiResult.possibleConditions.forEach(c => allConditions.add(c));
    }
    if (geminiResult?.differentialDiagnosis) {
      geminiResult.differentialDiagnosis.forEach(d => allConditions.add(d.condition));
    }

    // Combine recommendations
    const allRecommendations = new Set<string>();
    if (openaiResult?.recommendedActions) {
      openaiResult.recommendedActions.forEach(r => allRecommendations.add(r));
    }
    if (geminiResult?.recommendedWorkup) {
      geminiResult.recommendedWorkup.forEach(r => allRecommendations.add(r));
    }

    // Combine red flags
    const allRedFlags = new Set<string>();
    if (geminiResult?.redFlags) {
      geminiResult.redFlags.forEach(f => allRedFlags.add(f));
    }

    // Combine ICD-10 codes
    const icd10Codes = geminiResult?.icd10Suggestions || [];

    // Create combined interpretation
    let interpretation = "";
    if (openaiResult?.interpretation) {
      interpretation = openaiResult.interpretation;
    }
    if (geminiResult?.clinicalSummary && !interpretation) {
      interpretation = geminiResult.clinicalSummary;
    }
    if (!interpretation) {
      interpretation = "Unable to generate interpretation. Please consult healthcare provider.";
    }

    // Calculate combined confidence
    const confidences: number[] = [];
    if (openaiResult?.confidence) confidences.push(openaiResult.confidence);
    if (geminiResult?.confidence) confidences.push(geminiResult.confidence);
    const avgConfidence = confidences.length > 0 
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
      : 0.5;

    return {
      interpretation,
      consensus: {
        urgencyLevel: consensusUrgency,
        confidence: Math.min(avgConfidence + (agreementLevel === "full" ? 0.1 : 0), 1),
        agreementLevel,
      },
      openaiResult,
      geminiResult,
      combinedConditions: Array.from(allConditions),
      combinedRecommendations: Array.from(allRecommendations),
      icd10Codes,
      redFlags: Array.from(allRedFlags),
      modelsUsed,
      processingTime,
      source: modelsUsed.length > 1 ? "orchestrated" : "single",
    };
  }

  /**
   * Get consensus urgency from multiple assessments
   */
  private getConsensusUrgency(urgencies: string[]): string {
    if (urgencies.length === 0) return "non-urgent";
    
    const urgencyOrder = ["immediate", "emergency", "urgent", "non-urgent", "routine"];
    
    // Return the most urgent (lowest index)
    let mostUrgent = "routine";
    let lowestIndex = urgencyOrder.length;
    
    for (const urgency of urgencies) {
      const index = urgencyOrder.indexOf(urgency);
      if (index !== -1 && index < lowestIndex) {
        lowestIndex = index;
        mostUrgent = urgency;
      }
    }
    
    return mostUrgent;
  }

  /**
   * Calculate agreement level between models
   */
  private calculateAgreement(
    openaiResult?: MedicalReasoningResponse,
    geminiResult?: GeminiMedicalResponse
  ): "full" | "partial" | "divergent" {
    if (!openaiResult || !geminiResult) return "partial";
    
    // Compare urgency levels
    const openaiUrgency = openaiResult.urgencyLevel;
    const severityToUrgency: Record<string, string> = {
      critical: "immediate",
      severe: "emergency",
      moderate: "urgent",
      mild: "non-urgent",
    };
    const geminiUrgency = severityToUrgency[geminiResult.symptomAnalysis.severity] || "non-urgent";
    
    if (openaiUrgency === geminiUrgency) {
      return "full";
    }
    
    // Check if they're adjacent urgency levels
    const urgencyOrder = ["immediate", "emergency", "urgent", "non-urgent", "routine"];
    const openaiIndex = urgencyOrder.indexOf(openaiUrgency);
    const geminiIndex = urgencyOrder.indexOf(geminiUrgency);
    
    if (Math.abs(openaiIndex - geminiIndex) <= 1) {
      return "partial";
    }
    
    return "divergent";
  }

  /**
   * Fallback analysis when no AI services available
   */
  private fallbackAnalysis(
    gestureTokens: string[],
    emotionState?: MedicalReasoningRequest["emotionState"],
    startTime: number = Date.now()
  ): OrchestratedAnalysis {
    const tokens = gestureTokens.map(t => t.toLowerCase());
    
    // Basic rule-based analysis
    let interpretation = "Patient communication received via sign language. ";
    let urgency = "non-urgent";
    const conditions: string[] = [];
    const recommendations: string[] = ["Complete clinical evaluation recommended"];
    const redFlags: string[] = [];

    // Emergency detection
    if (tokens.some(t => ["fallen", "collapse", "stroke", "critical"].includes(t))) {
      urgency = "immediate";
      interpretation += "EMERGENCY: Critical condition detected. ";
      redFlags.push("Immediate medical attention required");
    }

    // Symptom patterns
    if (tokens.some(t => t.includes("pain"))) {
      interpretation += "Patient indicates pain. ";
      if (tokens.some(t => t.includes("chest"))) {
        urgency = urgency === "immediate" ? "immediate" : "emergency";
        conditions.push("Possible cardiac event");
        redFlags.push("Chest pain - rule out cardiac cause");
      }
      if (tokens.some(t => t.includes("abdomen") || t.includes("stomach"))) {
        conditions.push("Abdominal pain - multiple possible causes");
      }
      if (tokens.some(t => t.includes("head"))) {
        conditions.push("Headache");
      }
    }

    // Emotional state factors
    if (emotionState) {
      if (emotionState.painLevel > 0.7) {
        interpretation += "High pain level detected. ";
        if (urgency === "non-urgent") urgency = "urgent";
      }
      if (emotionState.distress > 0.7) {
        interpretation += "Patient showing significant distress. ";
      }
    }

    return {
      interpretation: interpretation.trim(),
      consensus: {
        urgencyLevel: urgency,
        confidence: 0.5,
        agreementLevel: "partial",
      },
      combinedConditions: conditions.length > 0 ? conditions : ["Requires evaluation"],
      combinedRecommendations: recommendations,
      icd10Codes: [],
      redFlags,
      modelsUsed: ["rule-based"],
      processingTime: Date.now() - startTime,
      source: "fallback",
    };
  }
}

// Singleton instance
let orchestratorInstance: LangChainOrchestrator | null = null;

/**
 * Get the LangChain orchestrator singleton
 */
export function getOrchestrator(): LangChainOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new LangChainOrchestrator();
  }
  return orchestratorInstance;
}

/**
 * Initialize the orchestrator with API keys
 */
export function initializeOrchestrator(config: OrchestratorConfig): void {
  const orchestrator = getOrchestrator();
  orchestrator.configure(config);
}

/**
 * Convenience function for quick orchestrated analysis
 */
export async function analyzeWithAI(
  gestureTokens: string[],
  emotionState?: MedicalReasoningRequest["emotionState"],
  bodyState?: MedicalReasoningRequest["bodyState"]
): Promise<OrchestratedAnalysis> {
  const orchestrator = getOrchestrator();
  return orchestrator.analyzeWithOrchestration(gestureTokens, emotionState, bodyState);
}
