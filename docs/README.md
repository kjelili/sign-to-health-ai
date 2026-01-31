# Sign-to-Health AI — Documentation

## Overview

Sign-to-Health AI is a real-time medical interpreter that translates sign language, gestures, facial expressions, and emotional signals into structured clinical understanding for doctors — giving Deaf and non-verbal patients a voice in healthcare.

## Documentation Index

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture and tech stack |
| [INPUT_LAYER.md](INPUT_LAYER.md) | Camera + MediaPipe configuration, gesture detection |
| [BODY_TRACKING.md](BODY_TRACKING.md) | Pose landmarker, fall detection, 3D sync |
| [EMOTIONAL_INTELLIGENCE.md](EMOTIONAL_INTELLIGENCE.md) | Hume AI emotion detection, anger/stress spectrum |
| [CLINICAL_OUTPUT.md](CLINICAL_OUTPUT.md) | SOAP notes and ICD-10 code generation |
| [TRIAGE_RULES.md](TRIAGE_RULES.md) | AI triage patterns and urgency classification |
| [AUTOMATION.md](AUTOMATION.md) | Workflow automation, PDF export, voice summary |
| [EXPLAINABILITY.md](EXPLAINABILITY.md) | Knowledge graph and reasoning transparency |
| [BACKEND.md](BACKEND.md) | API routes, database, settings management |

## Quick Start

```bash
cd sign-to-health-app
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## System Layers

### 1. Input Layer
- **Camera Capture**: 640x480 @ 30fps
- **Hand Landmarker**: 21 landmarks per hand
- **Pose Landmarker**: 33 body landmarks
- **Gesture Smoothing**: Debouncing and stability checks

### 2. Emotional Intelligence Layer (Hume AI)
- **48 facial expressions** detected via Hume AI
- Pain level detection (0-100%)
- Distress level detection (0-100%)
- Anxiety level detection (0-100%)
- Confusion/disorientation detection
- Anger spectrum: Agitated → Frustrated → Hostile → Furious
- Stress spectrum: Anxious → Burned out → Overwhelmed
- Fallback to gesture-based inference when offline

### 3. Medical Reasoning Layer
- Gesture → Clinical interpretation
- Body region detection
- SOAP note generation
- ICD-10 code suggestions

### 4. AI Triage Mode
| Pattern | Output |
|---------|--------|
| Stroke gestures | 🚨 Immediate |
| Fall/Collapse | 🚨 Immediate |
| Chest pain + fear | 🚑 Emergency |
| Breathing difficulty | 🚑 Emergency |
| Migraine | 🟡 Non-urgent |
| Anxiety attack | 🧠 Mental Health |

### 5. Output Layer
**Doctor Output:**
- Clinical interpretation with TTS
- SOAP note (expandable)
- ICD-10 codes (expandable)
- Triage badge

**Patient Output:**
- Visual confirmation cards
- Large icons (Yes ✓ / No ✗)
- No reading required

### 6. 3D Body Avatar
- Real-time pose synchronization
- Pain region highlighting
- Fall detection visualization
- Emergency particles effect

### 7. Automation Layer
**Workflow:**
New session → Emotion high → Auto triage → Generate report → Save to history → Export PDF → Play voice summary

### 8. Explainability Layer
**Knowledge Graph:**
```
Gesture → Symptom → Diagnosis → Urgency → Department
```
- Visual graph display
- Detailed reasoning steps
- AI transparency notice

### 9. Backend API
**Endpoints:**
- `GET /api/health` - System health and statistics
- `GET/POST/DELETE /api/sessions` - Session CRUD operations
- `GET/PUT/DELETE /api/settings` - Settings management

**Features:**
- File-based JSON storage (upgradable)
- Automatic localStorage fallback
- Session statistics and filtering
- API key management

## Key Features

### Reliability
- Optimized MediaPipe configuration
- Gesture smoothing (150ms debounce, 3 stable frames)
- Position-based body region detection
- Fall detection from body pose

### Clinical Output
- Auto-generated SOAP notes
- ICD-10 code suggestions
- Department recommendations
- PDF report export

### Accessibility
- High contrast dark theme
- Large touch targets (44px minimum)
- Visual icons (no reading required)
- Voice summary playback

### UI/UX
- Glassmorphism design
- Neon accent colors
- Smooth animations
- Responsive layout

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | File-based JSON (upgradable to PostgreSQL/MongoDB) |
| Animation | Framer Motion |
| Icons | Lucide React |
| Vision | MediaPipe (Hand + Pose Landmarker) |
| Emotion | Hume AI Expression Measurement API |
| 3D | Three.js, @react-three/fiber |
| TTS | Web Speech API (ElevenLabs optional) |
| Storage | API + localStorage fallback |

## Phases Completed

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Input Layer + Medical Reasoning | ✅ |
| 2 | Emotional Intelligence + Patient UI | ✅ |
| 3 | 3D Body Avatar + Emergency Mode | ✅ |
| 4 | AI Triage + Automation | ✅ |
| 5 | Explainability + Documentation | ✅ |
| 6 | Body Tracking + Reliability | ✅ |
| 7 | Full Automation + PDF Export | ✅ |
| 8 | Hume AI Emotion Detection | ✅ |
| 9 | Backend API + Database | ✅ |

## External References

- [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)
- [Hume AI Expression Measurement](https://dev.hume.ai/docs/expression-measurement/overview)
- [Three.js Documentation](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
