/**
 * OpenAI Service for Medical Reasoning
 * 
 * Provides AI-powered medical reasoning using GPT-4 for enhanced
 * clinical interpretation of gestures and symptoms.
 * 
 * API Documentation: https://platform.openai.com/docs/api-reference
 * 
 * Features:
 * - Medical symptom interpretation
 * - Clinical reasoning chains
 * - Differential diagnosis suggestions
 * - Natural language generation for reports
 * - Automatic fallback to rule-based reasoning
 * 
 * Authentication:
 * - Uses OPENAI_API_KEY environment variable
 * - Get API key from: https://platform.openai.com/api-keys
 */

import OpenAI from "openai";

// Configuration
const MODEL = "gpt-4-turbo-preview"; // Best for medical reasoning
const FALLBACK_MODEL = "gpt-3.5-turbo"; // Cheaper fallback
const MAX_TOKENS = 1000;
const TEMPERATURE = 0.3; // Lower temperature for more consistent medical advice

/**
 * Medical reasoning request interface
 */
export interface MedicalReasoningRequest {
  gestureTokens: string[];
  emotionState?: {
    painLevel: number;
    distress: number;
    anxiety: number;
    primaryEmotion: string;
  };
  bodyState?: {
    position: string;
    isEmergency: boolean;
  };
  context?: string;
}

/**
 * Medical reasoning response interface
 */
export interface MedicalReasoningResponse {
  interpretation: string;
  possibleConditions: string[];
  urgencyLevel: "immediate" | "emergency" | "urgent" | "non-urgent" | "routine";
  recommendedActions: string[];
  differentialDiagnosis: string[];
  confidence: number;
  source: "openai" | "fallback";
  model?: string;
}

/**
 * SOAP note structure
 */
export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

/**
 * OpenAI service class for medical reasoning
 */
class OpenAIService {
  private client: OpenAI | null = null;
  private apiKey: string | null = null;
  private isConfigured = false;
  private model = MODEL;

  /**
   * Configure the service with API key
   */
  configure(apiKey: string): void {
    this.apiKey = apiKey;
    if (apiKey && apiKey.length > 10) {
      try {
        this.client = new OpenAI({
          apiKey: apiKey,
          dangerouslyAllowBrowser: true, // For client-side use
        });
        this.isConfigured = true;
        console.log("OpenAI: Service configured successfully");
      } catch (error) {
        console.error("OpenAI: Failed to configure client", error);
        this.isConfigured = false;
      }
    }
  }

  /**
   * Check if service is configured
   */
  isReady(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Perform medical reasoning on gesture/symptom data
   */
  async analyzeMedical(request: MedicalReasoningRequest): Promise<MedicalReasoningResponse> {
    if (!this.isReady()) {
      return this.fallbackReasoning(request);
    }

    const systemPrompt = `You are a medical assistant AI helping to interpret patient symptoms communicated through sign language and gestures. Your role is to provide preliminary clinical assessments to help healthcare providers.

IMPORTANT GUIDELINES:
- This is for assistive purposes only, not for definitive diagnosis
- Always recommend professional medical evaluation
- Prioritize patient safety - flag any emergency symptoms
- Be concise but thorough
- Use medical terminology appropriately
- Consider the emotional state of the patient in your assessment`;

    const userPrompt = this.buildUserPrompt(request);

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const parsed = JSON.parse(content);
      return {
        interpretation: parsed.interpretation || "Unable to interpret symptoms",
        possibleConditions: parsed.possibleConditions || [],
        urgencyLevel: this.normalizeUrgency(parsed.urgencyLevel),
        recommendedActions: parsed.recommendedActions || [],
        differentialDiagnosis: parsed.differentialDiagnosis || [],
        confidence: parsed.confidence || 0.7,
        source: "openai",
        model: this.model,
      };
    } catch (error) {
      console.error("OpenAI: Medical reasoning failed", error);
      // Fall back to rule-based reasoning
      return this.fallbackReasoning(request);
    }
  }

  /**
   * Generate SOAP note from session data
   */
  async generateSOAPNote(
    gestureTokens: string[],
    interpretation: string,
    emotionState?: MedicalReasoningRequest["emotionState"],
    vitalSigns?: Record<string, string>
  ): Promise<SOAPNote> {
    if (!this.isReady()) {
      return this.fallbackSOAPNote(gestureTokens, interpretation);
    }

    const prompt = `Generate a SOAP note based on the following patient interaction:

Gesture Tokens (patient's sign language): ${gestureTokens.join(", ")}
Clinical Interpretation: ${interpretation}
Emotional State: ${emotionState ? JSON.stringify(emotionState) : "Not assessed"}
${vitalSigns ? `Vital Signs: ${JSON.stringify(vitalSigns)}` : ""}

Return a JSON object with these fields:
- subjective: Patient's reported symptoms (from gestures)
- objective: Observable findings
- assessment: Clinical assessment
- plan: Recommended plan of care`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: "You are a medical documentation assistant. Generate concise, professional SOAP notes." },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response");
      }

      const parsed = JSON.parse(content);
      return {
        subjective: parsed.subjective || "Patient communication via sign language",
        objective: parsed.objective || "See gesture interpretation",
        assessment: parsed.assessment || interpretation,
        plan: parsed.plan || "Continue evaluation",
      };
    } catch (error) {
      console.error("OpenAI: SOAP generation failed", error);
      return this.fallbackSOAPNote(gestureTokens, interpretation);
    }
  }

  /**
   * Enhance clinical interpretation with AI
   */
  async enhanceInterpretation(
    ruleBasedInterpretation: string,
    gestureTokens: string[]
  ): Promise<string> {
    if (!this.isReady()) {
      return ruleBasedInterpretation;
    }

    try {
      const response = await this.client!.chat.completions.create({
        model: FALLBACK_MODEL, // Use cheaper model for quick enhancement
        messages: [
          {
            role: "system",
            content: "You are a medical assistant. Enhance the following clinical interpretation with additional context and clarity. Keep it concise (2-3 sentences max).",
          },
          {
            role: "user",
            content: `Gesture tokens: ${gestureTokens.join(", ")}\n\nCurrent interpretation: ${ruleBasedInterpretation}\n\nProvide an enhanced interpretation:`,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content || ruleBasedInterpretation;
    } catch (error) {
      console.error("OpenAI: Enhancement failed", error);
      return ruleBasedInterpretation;
    }
  }

  /**
   * Build user prompt for medical reasoning
   */
  private buildUserPrompt(request: MedicalReasoningRequest): string {
    let prompt = `Analyze the following patient communication and provide a medical assessment.

GESTURE TOKENS (from sign language interpretation):
${request.gestureTokens.join(", ")}
`;

    if (request.emotionState) {
      prompt += `
EMOTIONAL STATE:
- Pain Level: ${(request.emotionState.painLevel * 100).toFixed(0)}%
- Distress Level: ${(request.emotionState.distress * 100).toFixed(0)}%
- Anxiety Level: ${(request.emotionState.anxiety * 100).toFixed(0)}%
- Primary Emotion: ${request.emotionState.primaryEmotion}
`;
    }

    if (request.bodyState) {
      prompt += `
BODY STATE:
- Position: ${request.bodyState.position}
- Emergency Indicators: ${request.bodyState.isEmergency ? "YES" : "No"}
`;
    }

    if (request.context) {
      prompt += `
ADDITIONAL CONTEXT:
${request.context}
`;
    }

    prompt += `
Return a JSON object with:
- interpretation: string (clinical interpretation of symptoms)
- possibleConditions: string[] (list of possible conditions)
- urgencyLevel: "immediate" | "emergency" | "urgent" | "non-urgent" | "routine"
- recommendedActions: string[] (next steps for the healthcare provider)
- differentialDiagnosis: string[] (conditions to rule out)
- confidence: number (0-1 scale)`;

    return prompt;
  }

  /**
   * Normalize urgency level
   */
  private normalizeUrgency(level: string): MedicalReasoningResponse["urgencyLevel"] {
    const normalized = level?.toLowerCase() || "";
    if (normalized.includes("immediate")) return "immediate";
    if (normalized.includes("emergency")) return "emergency";
    if (normalized.includes("urgent")) return "urgent";
    if (normalized.includes("routine")) return "routine";
    return "non-urgent";
  }

  /**
   * Fallback rule-based reasoning
   */
  private fallbackReasoning(request: MedicalReasoningRequest): MedicalReasoningResponse {
    const tokens = request.gestureTokens.map(t => t.toLowerCase());
    
    // Emergency detection
    const isEmergency = tokens.some(t => 
      ["fallen", "collapse", "stroke", "heart", "chest_pain", "breathing", "critical"].includes(t)
    );
    
    const hasPain = tokens.some(t => 
      ["pain", "sharp", "dull", "burning", "ache"].includes(t)
    );

    const hasChest = tokens.some(t => t.includes("chest"));
    const hasHead = tokens.some(t => t.includes("head") || t.includes("temple"));
    const hasAbdomen = tokens.some(t => 
      t.includes("abdomen") || t.includes("stomach")
    );

    let interpretation = "Patient is communicating symptoms via sign language. ";
    const conditions: string[] = [];
    const actions: string[] = ["Complete medical evaluation recommended"];
    let urgency: MedicalReasoningResponse["urgencyLevel"] = "non-urgent";

    if (isEmergency || request.bodyState?.isEmergency) {
      urgency = "immediate";
      interpretation += "EMERGENCY: Critical symptoms detected. ";
      actions.unshift("Immediate medical intervention required");
    }

    if (hasPain && hasChest) {
      urgency = urgency === "immediate" ? "immediate" : "emergency";
      interpretation += "Patient indicates chest pain. ";
      conditions.push("Possible cardiac event", "Costochondritis", "Anxiety");
    } else if (hasPain && hasHead) {
      interpretation += "Patient indicates head pain. ";
      conditions.push("Migraine", "Tension headache", "Sinusitis");
      urgency = tokens.includes("severe") ? "urgent" : "non-urgent";
    } else if (hasPain && hasAbdomen) {
      interpretation += "Patient indicates abdominal pain. ";
      conditions.push("Gastritis", "Appendicitis (if lower right)", "IBS");
      urgency = "urgent";
    } else if (hasPain) {
      interpretation += "Patient indicates pain. ";
      conditions.push("Musculoskeletal pain", "Inflammatory condition");
    }

    // Emotional factors
    if (request.emotionState) {
      if (request.emotionState.distress > 0.7) {
        interpretation += "High distress levels observed. ";
        if (urgency === "non-urgent") urgency = "urgent";
      }
      if (request.emotionState.anxiety > 0.6) {
        interpretation += "Significant anxiety present. ";
        conditions.push("Anxiety-related symptoms");
      }
    }

    return {
      interpretation: interpretation.trim(),
      possibleConditions: conditions.length > 0 ? conditions : ["Requires further evaluation"],
      urgencyLevel: urgency,
      recommendedActions: actions,
      differentialDiagnosis: conditions.slice(0, 3),
      confidence: 0.6,
      source: "fallback",
    };
  }

  /**
   * Fallback SOAP note generation
   */
  private fallbackSOAPNote(gestureTokens: string[], interpretation: string): SOAPNote {
    return {
      subjective: `Patient communicated via sign language. Gesture tokens: ${gestureTokens.slice(0, 5).join(", ")}`,
      objective: "Communication interpreted through Sign-to-Health AI system. See gesture analysis for details.",
      assessment: interpretation,
      plan: "1. Complete clinical evaluation\n2. Verify symptom interpretation with patient\n3. Order appropriate diagnostic tests",
    };
  }
}

// Singleton instance
let openAIServiceInstance: OpenAIService | null = null;

/**
 * Get the OpenAI service singleton
 */
export function getOpenAIService(): OpenAIService {
  if (!openAIServiceInstance) {
    openAIServiceInstance = new OpenAIService();
  }
  return openAIServiceInstance;
}

/**
 * Initialize OpenAI service with API key
 */
export function initializeOpenAI(apiKey: string): void {
  const service = getOpenAIService();
  service.configure(apiKey);
}
