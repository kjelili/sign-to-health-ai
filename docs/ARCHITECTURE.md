# Sign-to-Health AI — Architecture

## Overview

Sign-to-Health AI is a real-time medical interpreter that translates sign language, gestures, facial expressions, and emotional signals into structured clinical understanding for doctors.

## System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Multimodal Input (MediaPipe)                                    │
│  • Hand landmarks  • Body pose  • Face mesh                      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  Emotional Intelligence (Hume AI — Phase 2)                      │
│  • Pain level  • Stress  • Anxiety  • Distress                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  Medical Reasoning (MedGemma + OpenAI + LangChain)               │
│  • Gesture tokens → symptom → diagnosis → urgency                │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  Output Layer                                                    │
│  • Doctor: TTS, SOAP, ICD-10, triage                             │
│  • Patient: Visual confirmation cards                            │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS, Framer Motion
- **Vision:** MediaPipe Tasks Vision (HandLandmarker)
- **TTS:** Web Speech API (MVP) — ElevenLabs planned
- **AI:** Rule-based reasoning (MVP) — MedGemma/OpenAI planned
