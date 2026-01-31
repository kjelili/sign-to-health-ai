# Emotional Intelligence Layer — Documentation

## Overview

The Emotional Intelligence Layer provides comprehensive emotion detection using **Hume AI Expression Measurement API** with gesture-based fallback. This gives Sign-to-Health AI human-level empathy, not just translation.

## Hume AI Integration

### API Reference
- **Documentation:** https://dev.hume.ai/docs/expression-measurement/overview
- **WebSocket Streaming:** https://dev.hume.ai/docs/expression-measurement/websocket
- **Pricing:** https://link.hume.ai/pricing

### Capabilities

Hume AI detects **48 facial/vocal expressions** and **53 language expressions** including:

| Expression | Type | Medical Relevance |
|------------|------|-------------------|
| Pain | Face/Voice | Direct pain indicator |
| Empathic Pain | Face/Voice | Indirect pain signal |
| Distress | Face/Voice | Emergency indicator |
| Anxiety | All | Mental health |
| Fear | All | Trauma/emergency |
| Confusion | All | Cognitive assessment |
| Anger | All | Behavior management |
| Sadness | All | Mental health |
| Tiredness | Face/Voice | Fatigue assessment |

### Connection Flow

```
1. Check for API key (localStorage or env)
2. Connect to WebSocket: wss://api.hume.ai/v0/stream/models
3. Send video frames (base64 encoded, every 500ms)
4. Receive emotion scores (48 dimensions)
5. Process into medical categories
6. Update UI and clinical output
```

## Emotion Categories

### Anger Spectrum (from User Requirements)

| Intensity | Labels |
|-----------|--------|
| Low (0.1-0.3) | Agitated, Annoyed |
| Medium (0.3-0.5) | Irritated, Frustrated |
| High (0.5-0.7) | Irate, Hostile |
| Critical (0.7+) | Outraged, Furious |

**Source emotions:** Anger, Annoyance, Contempt, Disgust, Disapproval

### Stress Spectrum (from User Requirements)

| Intensity | Labels |
|-----------|--------|
| Low (0.1-0.3) | Stressed, Anxious |
| Medium (0.3-0.5) | Rattled, Depleted |
| High (0.5-0.7) | Exhausted, Burned out |
| Critical (0.7+) | Frazzled, Overwhelmed |

**Source emotions:** Anxiety, Fear, Distress, Tiredness, Confusion

### Medical Categories

| Category | Trigger | Clinical Response |
|----------|---------|-------------------|
| Pain | Pain > 50% | Pain assessment |
| Anxiety | Distress > 50% | Mental health support |
| Confusion | Confusion > 40% | Cognitive assessment |
| Anger | Anger spectrum > 30% | De-escalation |
| Stress | Stress spectrum > 30% | Stress management |
| Positive | Calm/Joy > 50% | Continue normal care |
| Neutral | Default | Standard assessment |

## Implementation

### Files

| File | Purpose |
|------|---------|
| `humeEmotions.ts` | Emotion definitions and mappings |
| `humeService.ts` | WebSocket service for Hume AI |
| `emotionLayer.ts` | Integration layer with fallback |
| `types.ts` | ExtendedEmotionState interface |

### Key Functions

```typescript
// Configure Hume AI
const humeService = getHumeService();
humeService.configure(apiKey);

// Send frame for analysis
const frameData = captureFrameAsBase64(videoElement);
humeService.analyzeFrame(frameData);

// Get extended emotion state
const emotion = getExtendedEmotionState(gestureState);
// Returns: ExtendedEmotionState with all metrics
```

### ExtendedEmotionState Interface

```typescript
interface ExtendedEmotionState {
  // Core metrics (0-1)
  painLevel: number;
  distress: number;
  anxiety: number;
  confusion: number;
  anger: number;
  
  // Category
  category: "pain" | "anxiety" | "confusion" | "anger" | "stress" | "positive" | "neutral";
  categoryLabel: string;
  
  // Spectrum labels
  angerSpectrum?: string;  // "Frustrated", "Hostile", etc.
  stressSpectrum?: string; // "Anxious", "Overwhelmed", etc.
  
  // Top emotions
  topEmotions: Array<{ name: string; score: number }>;
  
  // Source
  source: "hume" | "fallback" | "gesture";
  confidence: number;
}
```

## Configuration

### Environment Variable

```bash
NEXT_PUBLIC_HUME_API_KEY=your_api_key_here
```

### localStorage (Runtime)

```javascript
localStorage.setItem("humeApiKey", "your_api_key_here");
```

### Get API Key

1. Sign up at https://app.hume.ai/
2. Go to API Keys section
3. Generate new key
4. Add to environment or localStorage

## Fallback Mode

When Hume AI is not available, the system falls back to gesture-based inference:

| Gesture Tokens | Inferred Emotion |
|----------------|------------------|
| `pain`, `sharp`, `burning` | Pain |
| `breathing`, `chest` | Distress |
| `trembling`, `shaking` | Anxiety |
| `confused`, `disoriented` | Confusion |
| `aggressive`, `frustrated` | Anger |
| `fallen`, `collapse` | Critical distress |

## UI Display

### CameraCapture Component

Shows real-time emotion in camera overlay:
- Hume AI connection status (top right)
- Primary emotion label with color coding
- Pain/Distress percentages
- Top 3 detected emotions

### DoctorOutput Component

Shows detailed emotion analysis:
- Primary emotion category
- Anger/Stress spectrum labels
- Progress bars for all metrics
- Top 5 detected emotions
- Source indicator (Hume AI / Gesture inference)

## Clinical Response

The system provides recommended responses based on emotional state:

```typescript
const response = getEmotionalResponse(emotion);
// Returns:
// - verbal: What to say to patient
// - nonVerbal: Body language guidance
// - clinical: Documentation notes
```

### Example Responses

**Critical Distress:**
- Verbal: "I can see you're in significant distress. Help is here."
- NonVerbal: "Move closer, maintain eye contact, speak slowly"
- Clinical: "Patient in acute distress. Immediate assessment required."

**High Pain:**
- Verbal: "I can see you're experiencing pain. Let me help."
- NonVerbal: "Use gentle, reassuring gestures"
- Clinical: "Patient reporting significant pain. Pain assessment needed."

**Confusion:**
- Verbal: "Let's take this step by step. I'm here to help."
- NonVerbal: "Use simple gestures, point to visual aids"
- Clinical: "Patient showing confusion. Cognitive assessment may be needed."

## Rate Limiting

- Frames sent to Hume AI: ~2 FPS (every 500ms)
- WebSocket timeout: 60 seconds (auto-reconnect)
- Max reconnect attempts: 5

## Privacy Considerations

- Video frames are sent to Hume AI servers
- No frames are stored locally or logged
- API key should be kept secure
- Patient consent recommended for emotion tracking

## Future Enhancements

1. **Voice Analysis**: Add speech prosody detection
2. **Multi-face**: Track multiple patients simultaneously
3. **Custom Models**: Train for medical-specific expressions
4. **Offline Mode**: On-device emotion detection
5. **Historical Tracking**: Emotion trends over time
