/**
 * Google AI (Gemini) Service for Medical Reasoning
 * 
 * Provides AI-powered medical reasoning using Google's Gemini models.
 * Designed for MedGemma-style medical knowledge and reasoning.
 * 
 * API Documentation: https://ai.google.dev/gemini-api/docs
 * SDK Documentation: https://googleapis.github.io/js-genai/
 * 
 * Features:
 * - Medical symptom interpretation with Gemini
 * - Multimodal analysis (future: image + gesture)
 * - Medical knowledge base integration
 * - ICD-10 code suggestions
 * - Automatic fallback to rule-based reasoning
 * 
 * Authentication:
 * - Uses GOOGLE_API_KEY or GEMINI_API_KEY environment variable
 * - Get API key from: https://aistudio.google.com/apikey
 */

import { GoogleGenAI } from "@google/genai";

// Configuration
const MODEL = "gemini-2.0-flash"; // Fast, capable model
const MEDICAL_MODEL = "gemini-2.0-flash"; // Use flash for medical reasoning too
const MAX_OUTPUT_TOKENS = 1000;
const TEMPERATURE = 0.2; // Low temperature for consistent medical output

/**
 * Medical analysis request interface
 */
export interface GeminiMedicalRequest {
  gestureTokens: string[];
  bodyRegion?: string;
  painCharacteristics?: string[];
  emotionState?: {
    painLevel: number;
    distress: number;
    anxiety: number;
  };
  patientContext?: string;
}

/**
 * Medical analysis response interface
 */
export interface GeminiMedicalResponse {
  clinicalSummary: string;
  symptomAnalysis: {
    primarySymptom: string;
    associatedSymptoms: string[];
    severity: "mild" | "moderate" | "severe" | "critical";
  };
  differentialDiagnosis: Array<{
    condition: string;
    likelihood: "high" | "medium" | "low";
    rationale: string;
  }>;
  icd10Suggestions: Array<{
    code: string;
    description: string;
  }>;
  recommendedWorkup: string[];
  redFlags: string[];
  confidence: number;
  source: "gemini" | "fallback";
}

/**
 * ICD-10 code suggestion interface
 */
export interface ICD10Suggestion {
  code: string;
  description: string;
  category: string;
}

/**
 * Google AI service class for medical reasoning
 */
class GoogleAIService {
  private client: GoogleGenAI | null = null;
  private apiKey: string | null = null;
  private isConfigured = false;

  /**
   * Configure the service with API key
   */
  configure(apiKey: string): void {
    this.apiKey = apiKey;
    if (apiKey && apiKey.length > 10) {
      try {
        this.client = new GoogleGenAI({ apiKey });
        this.isConfigured = true;
        console.log("Google AI: Service configured successfully");
      } catch (error) {
        console.error("Google AI: Failed to configure client", error);
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
   * Analyze medical symptoms using Gemini
   */
  async analyzeMedical(request: GeminiMedicalRequest): Promise<GeminiMedicalResponse> {
    if (!this.isReady()) {
      return this.fallbackAnalysis(request);
    }

    const prompt = this.buildMedicalPrompt(request);

    try {
      const response = await this.client!.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          temperature: TEMPERATURE,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from Gemini");
      }

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return this.normalizeResponse(parsed);
    } catch (error) {
      console.error("Google AI: Medical analysis failed", error);
      return this.fallbackAnalysis(request);
    }
  }

  /**
   * Get ICD-10 code suggestions for symptoms
   */
  async suggestICD10Codes(symptoms: string[], interpretation: string): Promise<ICD10Suggestion[]> {
    if (!this.isReady()) {
      return this.fallbackICD10(symptoms);
    }

    const prompt = `Based on the following symptoms and clinical interpretation, suggest the most relevant ICD-10 codes.

Symptoms: ${symptoms.join(", ")}
Interpretation: ${interpretation}

Return a JSON array with objects containing:
- code: ICD-10 code (e.g., "R10.1")
- description: Short description
- category: Category name

Limit to 5 most relevant codes.`;

    try {
      const response = await this.client!.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          maxOutputTokens: 500,
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response");
      }

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return this.fallbackICD10(symptoms);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Google AI: ICD-10 suggestion failed", error);
      return this.fallbackICD10(symptoms);
    }
  }

  /**
   * Generate medical summary for documentation
   */
  async generateMedicalSummary(
    gestureTokens: string[],
    interpretation: string,
    urgency: string
  ): Promise<string> {
    if (!this.isReady()) {
      return this.fallbackSummary(gestureTokens, interpretation, urgency);
    }

    const prompt = `Generate a brief medical summary (2-3 sentences) for documentation purposes.

Patient Communication: ${gestureTokens.join(", ")}
Clinical Interpretation: ${interpretation}
Urgency Level: ${urgency}

Write a professional, concise summary suitable for medical records.`;

    try {
      const response = await this.client!.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          maxOutputTokens: 200,
          temperature: 0.3,
        },
      });

      return response.text || this.fallbackSummary(gestureTokens, interpretation, urgency);
    } catch (error) {
      console.error("Google AI: Summary generation failed", error);
      return this.fallbackSummary(gestureTokens, interpretation, urgency);
    }
  }

  /**
   * Analyze symptom patterns for triage
   */
  async analyzeForTriage(
    symptoms: string[],
    emotionState?: GeminiMedicalRequest["emotionState"]
  ): Promise<{ urgency: string; reasoning: string }> {
    if (!this.isReady()) {
      return this.fallbackTriage(symptoms, emotionState);
    }

    const prompt = `Analyze the following symptoms and determine triage urgency.

Symptoms: ${symptoms.join(", ")}
${emotionState ? `Pain Level: ${(emotionState.painLevel * 100).toFixed(0)}%, Distress: ${(emotionState.distress * 100).toFixed(0)}%` : ""}

Return a JSON object with:
- urgency: "immediate" | "emergency" | "urgent" | "non-urgent" | "routine"
- reasoning: Brief explanation (1-2 sentences)`;

    try {
      const response = await this.client!.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          maxOutputTokens: 200,
          temperature: 0.2,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response");
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.fallbackTriage(symptoms, emotionState);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Google AI: Triage analysis failed", error);
      return this.fallbackTriage(symptoms, emotionState);
    }
  }

  /**
   * Build medical analysis prompt
   */
  private buildMedicalPrompt(request: GeminiMedicalRequest): string {
    let prompt = `You are a medical AI assistant helping interpret patient symptoms communicated through sign language and gestures. Analyze the following and provide a clinical assessment.

GESTURE TOKENS (from sign language): ${request.gestureTokens.join(", ")}
`;

    if (request.bodyRegion) {
      prompt += `BODY REGION: ${request.bodyRegion}\n`;
    }

    if (request.painCharacteristics && request.painCharacteristics.length > 0) {
      prompt += `PAIN CHARACTERISTICS: ${request.painCharacteristics.join(", ")}\n`;
    }

    if (request.emotionState) {
      prompt += `
EMOTIONAL STATE:
- Pain Level: ${(request.emotionState.painLevel * 100).toFixed(0)}%
- Distress: ${(request.emotionState.distress * 100).toFixed(0)}%
- Anxiety: ${(request.emotionState.anxiety * 100).toFixed(0)}%
`;
    }

    if (request.patientContext) {
      prompt += `ADDITIONAL CONTEXT: ${request.patientContext}\n`;
    }

    prompt += `
Return a JSON object with:
- clinicalSummary: string (brief clinical interpretation)
- symptomAnalysis: { primarySymptom: string, associatedSymptoms: string[], severity: "mild"|"moderate"|"severe"|"critical" }
- differentialDiagnosis: array of { condition: string, likelihood: "high"|"medium"|"low", rationale: string }
- icd10Suggestions: array of { code: string, description: string }
- recommendedWorkup: string[] (suggested tests/evaluations)
- redFlags: string[] (warning signs to monitor)
- confidence: number (0-1)`;

    return prompt;
  }

  /**
   * Normalize API response
   */
  private normalizeResponse(parsed: Record<string, unknown>): GeminiMedicalResponse {
    return {
      clinicalSummary: (parsed.clinicalSummary as string) || "Unable to generate summary",
      symptomAnalysis: {
        primarySymptom: (parsed.symptomAnalysis as Record<string, unknown>)?.primarySymptom as string || "Unspecified",
        associatedSymptoms: ((parsed.symptomAnalysis as Record<string, unknown>)?.associatedSymptoms as string[]) || [],
        severity: this.normalizeSeverity((parsed.symptomAnalysis as Record<string, unknown>)?.severity as string),
      },
      differentialDiagnosis: ((parsed.differentialDiagnosis as Array<Record<string, unknown>>) || []).map(d => ({
        condition: d.condition as string || "Unknown",
        likelihood: this.normalizeLikelihood(d.likelihood as string),
        rationale: d.rationale as string || "",
      })),
      icd10Suggestions: ((parsed.icd10Suggestions as Array<Record<string, unknown>>) || []).map(c => ({
        code: c.code as string || "",
        description: c.description as string || "",
      })),
      recommendedWorkup: (parsed.recommendedWorkup as string[]) || [],
      redFlags: (parsed.redFlags as string[]) || [],
      confidence: (parsed.confidence as number) || 0.7,
      source: "gemini",
    };
  }

  /**
   * Normalize severity level
   */
  private normalizeSeverity(severity: string): "mild" | "moderate" | "severe" | "critical" {
    const s = severity?.toLowerCase() || "";
    if (s.includes("critical")) return "critical";
    if (s.includes("severe")) return "severe";
    if (s.includes("moderate")) return "moderate";
    return "mild";
  }

  /**
   * Normalize likelihood level
   */
  private normalizeLikelihood(likelihood: string): "high" | "medium" | "low" {
    const l = likelihood?.toLowerCase() || "";
    if (l.includes("high")) return "high";
    if (l.includes("low")) return "low";
    return "medium";
  }

  /**
   * Fallback medical analysis
   */
  private fallbackAnalysis(request: GeminiMedicalRequest): GeminiMedicalResponse {
    const tokens = request.gestureTokens.map(t => t.toLowerCase());
    
    // Determine primary symptom
    let primarySymptom = "Unspecified discomfort";
    const associatedSymptoms: string[] = [];
    let severity: "mild" | "moderate" | "severe" | "critical" = "mild";
    const conditions: Array<{ condition: string; likelihood: "high" | "medium" | "low"; rationale: string }> = [];
    const icd10: Array<{ code: string; description: string }> = [];
    const redFlags: string[] = [];

    // Analyze tokens
    if (tokens.some(t => t.includes("pain"))) {
      primarySymptom = "Pain";
      if (tokens.some(t => t.includes("sharp"))) {
        associatedSymptoms.push("Sharp quality");
        severity = "moderate";
      }
      if (tokens.some(t => t.includes("severe"))) {
        severity = "severe";
      }
    }

    if (tokens.some(t => t.includes("chest"))) {
      primarySymptom = "Chest pain";
      severity = "severe";
      conditions.push({ condition: "Acute coronary syndrome", likelihood: "medium", rationale: "Chest pain requires cardiac evaluation" });
      icd10.push({ code: "R07.9", description: "Chest pain, unspecified" });
      redFlags.push("Chest pain - evaluate for cardiac cause");
    }

    if (tokens.some(t => t.includes("head") || t.includes("headache"))) {
      primarySymptom = "Headache";
      conditions.push({ condition: "Tension headache", likelihood: "high", rationale: "Most common headache type" });
      icd10.push({ code: "R51.9", description: "Headache, unspecified" });
    }

    if (tokens.some(t => t.includes("abdomen") || t.includes("stomach"))) {
      primarySymptom = "Abdominal pain";
      conditions.push({ condition: "Gastritis", likelihood: "medium", rationale: "Common cause of abdominal pain" });
      icd10.push({ code: "R10.9", description: "Unspecified abdominal pain" });
    }

    if (tokens.some(t => ["fallen", "collapse", "stroke"].includes(t))) {
      severity = "critical";
      redFlags.push("Patient collapse - immediate evaluation required");
    }

    // Emotional factors affect severity
    if (request.emotionState) {
      if (request.emotionState.painLevel > 0.7) {
        if (severity === "mild") severity = "moderate";
        else if (severity === "moderate") severity = "severe";
      }
      if (request.emotionState.distress > 0.7) {
        associatedSymptoms.push("High distress level");
      }
    }

    return {
      clinicalSummary: `Patient presents with ${primarySymptom.toLowerCase()}. ${associatedSymptoms.length > 0 ? `Associated symptoms include ${associatedSymptoms.join(", ")}.` : ""} Severity assessed as ${severity}.`,
      symptomAnalysis: {
        primarySymptom,
        associatedSymptoms,
        severity,
      },
      differentialDiagnosis: conditions.length > 0 ? conditions : [
        { condition: "Requires evaluation", likelihood: "medium", rationale: "Insufficient data for specific diagnosis" }
      ],
      icd10Suggestions: icd10.length > 0 ? icd10 : [
        { code: "R69", description: "Illness, unspecified" }
      ],
      recommendedWorkup: ["Complete clinical examination", "Detailed history if possible", "Vital signs assessment"],
      redFlags,
      confidence: 0.5,
      source: "fallback",
    };
  }

  /**
   * Fallback ICD-10 suggestions
   */
  private fallbackICD10(symptoms: string[]): ICD10Suggestion[] {
    const codes: ICD10Suggestion[] = [];
    const symptomsLower = symptoms.map(s => s.toLowerCase());

    if (symptomsLower.some(s => s.includes("pain"))) {
      codes.push({ code: "R52", description: "Pain, unspecified", category: "Symptoms" });
    }
    if (symptomsLower.some(s => s.includes("chest"))) {
      codes.push({ code: "R07.9", description: "Chest pain, unspecified", category: "Symptoms" });
    }
    if (symptomsLower.some(s => s.includes("head"))) {
      codes.push({ code: "R51.9", description: "Headache, unspecified", category: "Symptoms" });
    }
    if (symptomsLower.some(s => s.includes("abdomen") || s.includes("stomach"))) {
      codes.push({ code: "R10.9", description: "Unspecified abdominal pain", category: "Symptoms" });
    }
    if (symptomsLower.some(s => s.includes("breathing"))) {
      codes.push({ code: "R06.0", description: "Dyspnea", category: "Symptoms" });
    }

    return codes.length > 0 ? codes : [{ code: "R69", description: "Illness, unspecified", category: "Symptoms" }];
  }

  /**
   * Fallback triage analysis
   */
  private fallbackTriage(
    symptoms: string[],
    emotionState?: GeminiMedicalRequest["emotionState"]
  ): { urgency: string; reasoning: string } {
    const symptomsLower = symptoms.map(s => s.toLowerCase());
    
    // Emergency indicators
    if (symptomsLower.some(s => ["collapse", "fallen", "stroke", "unresponsive"].includes(s))) {
      return { urgency: "immediate", reasoning: "Critical symptoms detected requiring immediate intervention." };
    }
    
    if (symptomsLower.some(s => s.includes("chest") && s.includes("pain"))) {
      return { urgency: "emergency", reasoning: "Chest pain requires urgent cardiac evaluation." };
    }
    
    if (symptomsLower.some(s => s.includes("breathing"))) {
      return { urgency: "emergency", reasoning: "Respiratory symptoms require prompt evaluation." };
    }

    // High pain/distress
    if (emotionState && (emotionState.painLevel > 0.8 || emotionState.distress > 0.8)) {
      return { urgency: "urgent", reasoning: "High pain or distress levels indicate need for prompt attention." };
    }

    if (symptomsLower.some(s => s.includes("severe"))) {
      return { urgency: "urgent", reasoning: "Severity of symptoms warrants timely evaluation." };
    }

    return { urgency: "non-urgent", reasoning: "Symptoms do not indicate immediate emergency but should be evaluated." };
  }

  /**
   * Fallback summary generation
   */
  private fallbackSummary(gestureTokens: string[], interpretation: string, urgency: string): string {
    return `Patient communicated symptoms via sign language (${gestureTokens.slice(0, 3).join(", ")}). ${interpretation} Urgency level: ${urgency}.`;
  }
}

// Singleton instance
let googleAIServiceInstance: GoogleAIService | null = null;

/**
 * Get the Google AI service singleton
 */
export function getGoogleAIService(): GoogleAIService {
  if (!googleAIServiceInstance) {
    googleAIServiceInstance = new GoogleAIService();
  }
  return googleAIServiceInstance;
}

/**
 * Initialize Google AI service with API key
 */
export function initializeGoogleAI(apiKey: string): void {
  const service = getGoogleAIService();
  service.configure(apiKey);
}
