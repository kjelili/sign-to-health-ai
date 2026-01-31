/**
 * AI Services Initializer
 * 
 * Centralizes initialization of all AI services used in the application.
 * Should be called once during app startup to configure all services.
 * 
 * Services initialized:
 * - Hume AI: Emotion detection
 * - ElevenLabs: Text-to-speech (handled separately in automation.ts)
 * - OpenAI: Medical reasoning (GPT-4)
 * - Google AI: Medical knowledge (Gemini)
 * - LangChain: AI orchestration
 */

import { getHumeService } from "./humeService";
import { getOpenAIService } from "./openaiService";
import { getGoogleAIService } from "./googleAIService";
import { getOrchestrator } from "./langchainOrchestrator";
import { initializeAIServices } from "./medicalReasoning";
import { fetchApiKeys, type ApiKeysResponse } from "./api";

/**
 * AI initialization result
 */
export interface AIInitResult {
  success: boolean;
  services: {
    hume: boolean;
    elevenLabs: boolean;
    openai: boolean;
    google: boolean;
    langchain: boolean;
  };
  errors: string[];
}

/**
 * Cached initialization state
 */
let isInitialized = false;
let initResult: AIInitResult | null = null;

/**
 * Initialize all AI services with API keys
 * 
 * This function should be called once during app startup.
 * It fetches API keys from the backend and configures all services.
 */
export async function initializeAllAIServices(): Promise<AIInitResult> {
  if (isInitialized && initResult) {
    return initResult;
  }

  const result: AIInitResult = {
    success: false,
    services: {
      hume: false,
      elevenLabs: false,
      openai: false,
      google: false,
      langchain: false,
    },
    errors: [],
  };

  try {
    // Fetch API keys from backend or environment
    let keys: ApiKeysResponse | null = null;
    
    try {
      keys = await fetchApiKeys();
    } catch {
      console.warn("Failed to fetch API keys from backend, using environment variables");
    }

    // Fall back to environment variables if fetch failed
    if (!keys) {
      keys = {
        humeApiKey: typeof window !== "undefined" 
          ? localStorage.getItem("humeApiKey") || null
          : null,
        elevenLabsApiKey: typeof window !== "undefined"
          ? localStorage.getItem("elevenLabsApiKey") || null
          : null,
        openaiApiKey: typeof window !== "undefined"
          ? localStorage.getItem("openaiApiKey") || null
          : process.env.NEXT_PUBLIC_OPENAI_API_KEY || null,
        googleApiKey: typeof window !== "undefined"
          ? localStorage.getItem("googleApiKey") || null
          : process.env.NEXT_PUBLIC_GOOGLE_API_KEY || null,
        langchainApiKey: null,
      };
    }

    // Initialize Hume AI
    if (keys.humeApiKey) {
      try {
        const humeService = getHumeService();
        humeService.configure(keys.humeApiKey);
        await humeService.connect();
        result.services.hume = true;
        console.log("✓ Hume AI initialized");
      } catch (error) {
        result.errors.push(`Hume AI: ${error instanceof Error ? error.message : "Failed"}`);
      }
    }

    // Initialize OpenAI
    if (keys.openaiApiKey) {
      try {
        const openaiService = getOpenAIService();
        openaiService.configure(keys.openaiApiKey);
        result.services.openai = openaiService.isReady();
        if (result.services.openai) {
          console.log("✓ OpenAI initialized");
        }
      } catch (error) {
        result.errors.push(`OpenAI: ${error instanceof Error ? error.message : "Failed"}`);
      }
    }

    // Initialize Google AI
    if (keys.googleApiKey) {
      try {
        const googleService = getGoogleAIService();
        googleService.configure(keys.googleApiKey);
        result.services.google = googleService.isReady();
        if (result.services.google) {
          console.log("✓ Google AI initialized");
        }
      } catch (error) {
        result.errors.push(`Google AI: ${error instanceof Error ? error.message : "Failed"}`);
      }
    }

    // Initialize LangChain Orchestrator
    if (keys.openaiApiKey || keys.googleApiKey) {
      try {
        const orchestrator = getOrchestrator();
        orchestrator.configure({
          openaiApiKey: keys.openaiApiKey || undefined,
          googleApiKey: keys.googleApiKey || undefined,
          enableMultiModel: !!(keys.openaiApiKey && keys.googleApiKey),
        });
        result.services.langchain = orchestrator.isReady();
        if (result.services.langchain) {
          console.log("✓ LangChain orchestrator initialized");
        }
      } catch (error) {
        result.errors.push(`LangChain: ${error instanceof Error ? error.message : "Failed"}`);
      }
    }

    // Initialize medical reasoning with available AI services
    initializeAIServices({
      openaiApiKey: keys.openaiApiKey || undefined,
      googleApiKey: keys.googleApiKey || undefined,
    });

    // ElevenLabs doesn't need initialization - it's used on-demand
    result.services.elevenLabs = !!keys.elevenLabsApiKey;

    result.success = true;
    isInitialized = true;
    initResult = result;

    // Log summary
    const activeServices = Object.entries(result.services)
      .filter(([, active]) => active)
      .map(([name]) => name);
    
    if (activeServices.length > 0) {
      console.log(`AI Services active: ${activeServices.join(", ")}`);
    } else {
      console.log("AI Services: Using rule-based fallbacks (no API keys configured)");
    }

    return result;
  } catch (error) {
    result.errors.push(`Initialization: ${error instanceof Error ? error.message : "Unknown error"}`);
    initResult = result;
    return result;
  }
}

/**
 * Get current initialization status
 */
export function getAIInitStatus(): AIInitResult | null {
  return initResult;
}

/**
 * Check if AI services are initialized
 */
export function isAIInitialized(): boolean {
  return isInitialized;
}

/**
 * Reset initialization state (for re-initialization after settings change)
 */
export function resetAIInitialization(): void {
  isInitialized = false;
  initResult = null;
}

/**
 * Get summary of active AI services for display
 */
export function getActiveAIServicesSummary(): string {
  if (!initResult) {
    return "Not initialized";
  }

  const active = Object.entries(initResult.services)
    .filter(([, isActive]) => isActive)
    .map(([name]) => {
      switch (name) {
        case "hume": return "Hume AI (emotions)";
        case "elevenLabs": return "ElevenLabs (TTS)";
        case "openai": return "OpenAI GPT-4";
        case "google": return "Google Gemini";
        case "langchain": return "LangChain";
        default: return name;
      }
    });

  if (active.length === 0) {
    return "Rule-based mode (no AI keys)";
  }

  return active.join(", ");
}
