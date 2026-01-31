# AI Services Integration

Sign-to-Health AI integrates multiple AI services for comprehensive medical interpretation with automatic fallbacks.

## Overview

| Service | Purpose | Fallback |
|---------|---------|----------|
| **Hume AI** | Emotion detection (48 dimensions) | Gesture-based emotion inference |
| **ElevenLabs** | Premium text-to-speech | Web Speech API |
| **OpenAI GPT-4** | Medical reasoning & SOAP notes | Rule-based inference |
| **Google Gemini** | Medical knowledge & ICD-10 | Rule-based analysis |
| **LangChain** | AI orchestration | Single-model or rule-based |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Services Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐         │
│  │   Hume AI    │   │   OpenAI     │   │  Google AI   │         │
│  │  (Emotions)  │   │   (GPT-4)    │   │  (Gemini)    │         │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘         │
│         │                  │                  │                  │
│         │    ┌─────────────┴─────────────┐    │                  │
│         │    │   LangChain Orchestrator   │    │                  │
│         │    │  (Multi-model consensus)   │    │                  │
│         │    └─────────────┬─────────────┘    │                  │
│         │                  │                  │                  │
│  ┌──────┴──────────────────┴──────────────────┴──────┐          │
│  │              Medical Reasoning Layer               │          │
│  │   (Combines AI + Rule-based with auto-fallback)   │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

Add your API keys to `.env.local`:

```bash
# Emotion Detection
NEXT_PUBLIC_HUME_API_KEY=your_hume_api_key

# Text-to-Speech
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Medical Reasoning
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key

# Medical Knowledge
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key
```

### Getting API Keys

| Service | Sign Up URL | Free Tier |
|---------|-------------|-----------|
| Hume AI | https://app.hume.ai/ | Yes |
| ElevenLabs | https://elevenlabs.io/ | Yes (limited) |
| OpenAI | https://platform.openai.com/api-keys | Pay-as-you-go |
| Google AI | https://aistudio.google.com/apikey | Yes |

## Service Details

### 1. Hume AI (Emotion Detection)

**File:** `src/lib/humeService.ts`

Detects 48 emotional dimensions from facial expressions:
- Pain indicators
- Distress levels
- Anxiety markers
- Confusion signals
- Anger spectrum

**Features:**
- Real-time analysis via REST API
- Rate-limited to respect API limits
- Medical category mapping
- Automatic fallback to gesture-based inference

**Usage:**
```typescript
import { getHumeService } from "@/lib/humeService";

const hume = getHumeService();
hume.configure(apiKey);
await hume.connect();
hume.onResult((result) => {
  console.log("Pain level:", result.painLevel);
  console.log("Emotion:", result.primaryEmotion);
});
```

### 2. OpenAI GPT-4 (Medical Reasoning)

**File:** `src/lib/openaiService.ts`

Provides AI-powered clinical interpretation:
- Symptom analysis
- Differential diagnosis
- SOAP note generation
- Urgency classification

**Features:**
- GPT-4-turbo for medical reasoning
- Structured JSON output
- Context-aware interpretation
- Rule-based fallback

**Usage:**
```typescript
import { getOpenAIService } from "@/lib/openaiService";

const openai = getOpenAIService();
openai.configure(apiKey);

const result = await openai.analyzeMedical({
  gestureTokens: ["chest", "pain", "sharp"],
  emotionState: { painLevel: 0.8, distress: 0.7, anxiety: 0.5 }
});

console.log("Interpretation:", result.interpretation);
console.log("Urgency:", result.urgencyLevel);
```

### 3. Google Gemini (Medical Knowledge)

**File:** `src/lib/googleAIService.ts`

Provides medical knowledge and coding:
- ICD-10 code suggestions
- Differential diagnosis
- Symptom severity analysis
- Red flag detection

**Features:**
- Gemini 2.0 Flash model
- Medical-focused prompts
- Structured clinical output
- Rule-based fallback

**Usage:**
```typescript
import { getGoogleAIService } from "@/lib/googleAIService";

const gemini = getGoogleAIService();
gemini.configure(apiKey);

const result = await gemini.analyzeMedical({
  gestureTokens: ["abdomen", "pain"],
  emotionState: { painLevel: 0.6, distress: 0.4, anxiety: 0.3 }
});

console.log("ICD-10:", result.icd10Suggestions);
console.log("Red flags:", result.redFlags);
```

### 4. LangChain Orchestrator

**File:** `src/lib/langchainOrchestrator.ts`

Coordinates multiple AI services:
- Parallel model queries
- Consensus-based urgency
- Combined recommendations
- Multi-source confidence

**Features:**
- OpenAI + Gemini orchestration
- Agreement level calculation
- Combined ICD-10 codes
- Automatic fallback chain

**Usage:**
```typescript
import { analyzeWithAI } from "@/lib/langchainOrchestrator";

const result = await analyzeWithAI(
  gestureTokens,
  emotionState,
  bodyState
);

console.log("Consensus urgency:", result.consensus.urgencyLevel);
console.log("Agreement:", result.consensus.agreementLevel);
console.log("Models used:", result.modelsUsed);
```

### 5. ElevenLabs (Text-to-Speech)

**File:** `src/lib/automation.ts`

Premium voice synthesis for clinical summaries.

**Usage:**
```typescript
import { playVoiceSummary } from "@/lib/automation";

await playVoiceSummary(
  "Patient reports chest pain with high distress",
  elevenLabsApiKey // Optional - falls back to Web Speech API
);
```

## Initialization

AI services are automatically initialized when the app loads:

**File:** `src/lib/aiInitializer.ts`

```typescript
import { initializeAllAIServices } from "@/lib/aiInitializer";

// Called automatically in app/page.tsx
const result = await initializeAllAIServices();

console.log("Services active:", result.services);
// { hume: true, elevenLabs: true, openai: true, google: true, langchain: true }
```

## Fallback Behavior

### Cascade Pattern

```
AI Service → Rule-based Logic → Safe Default
```

1. **AI Available:** Full AI-powered analysis
2. **AI Fails:** Automatic switch to rule-based
3. **No Config:** Works with rule-based only

### Rule-based Fallback

Located in `src/lib/medicalReasoning.ts`:
- Pattern matching for symptoms
- Body region mapping
- Basic urgency classification
- Standard clinical phrases

## API Reference

### Medical Reasoning Request

```typescript
interface MedicalReasoningRequest {
  gestureTokens: string[];
  emotionState?: {
    painLevel: number;    // 0-1
    distress: number;     // 0-1
    anxiety: number;      // 0-1
    primaryEmotion: string;
  };
  bodyState?: {
    position: string;
    isEmergency: boolean;
  };
}
```

### Orchestrated Analysis Response

```typescript
interface OrchestratedAnalysis {
  interpretation: string;
  consensus: {
    urgencyLevel: "immediate" | "emergency" | "urgent" | "non-urgent" | "routine";
    confidence: number;
    agreementLevel: "full" | "partial" | "divergent";
  };
  combinedConditions: string[];
  combinedRecommendations: string[];
  icd10Codes: Array<{ code: string; description: string }>;
  redFlags: string[];
  modelsUsed: string[];
  source: "orchestrated" | "single" | "fallback";
}
```

## Best Practices

1. **Always configure fallbacks** - The app works without any API keys
2. **Use orchestrator for clinical decisions** - Combines multiple AI sources
3. **Monitor confidence scores** - Lower confidence = more uncertainty
4. **Check agreement levels** - "divergent" may need human review
5. **Log AI decisions** - For audit and improvement

## Security Considerations

- API keys stored in `.env.local` (gitignored)
- Keys can also be stored in backend database
- Client-side keys are exposed - use server proxy in production
- Never log API keys or sensitive patient data

## Troubleshooting

### Service Not Initializing
1. Check API key is valid
2. Verify network connectivity
3. Check browser console for errors

### Fallback Mode Activating
1. API key may be invalid
2. Rate limits may be exceeded
3. Service may be temporarily unavailable

### Inconsistent Results
1. Enable multi-model consensus (both OpenAI + Google)
2. Check for "divergent" agreement - may need human review
3. Review gesture token quality

## Future Enhancements

- [ ] MedGemma integration (when available)
- [ ] Real-time Hume WebSocket (requires SDK auth)
- [ ] LangSmith tracing integration
- [ ] Custom medical fine-tuning
- [ ] Multi-language support
