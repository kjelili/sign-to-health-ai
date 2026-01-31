<img width="1761" height="1725" alt="image" src="https://github.com/user-attachments/assets/32c8d770-3492-459d-a339-e5eb37bd85b8" />

# Sign-to-Health AI

**Real-time medical interpreter** that translates sign language, gestures, facial expressions, and emotional signals into structured clinical understanding for doctors — giving Deaf and non-verbal patients a voice in healthcare.

## Features

- **Multimodal Input:** Camera capture with MediaPipe (hand landmarks) + demo gesture simulation
- **Medical Reasoning:** Gesture tokens → symptom inference → clinical interpretation
- **Emotional Intelligence:** Pain level, distress, emotion detection (mock layer)
- **Doctor Output:** Clinical interpretation with Web Speech TTS, triage badge
- **Patient Confirmation:** Yes/No visual cards for accessibility
- **3D Body Avatar:** Pain region visualization with Three.js
- **Silent Emergency Mode:** Auto-alert on high-urgency patterns
- **AI Triage:** Immediate / Emergency / Urgent / Non-urgent / Mental health
- **Explainability:** Reasoning chain panel (gesture → symptom → triage)

## Quick Start

1. Open a terminal in the project folder and run:

```bash
cd sign-to-health-app
npm install
npm run dev
```

2. In your browser, go to **exactly**:

   **http://localhost:3001**

   (This app uses port **3001** so it doesn’t conflict with other apps on 3000.)

3. You should see the Sign-to-Health AI landing page (dark theme, “Giving non-verbal patients a voice”). Click **Launch App** to open the interpreter.

If you see a different site, check the terminal: it will show `Local: http://localhost:3001`. Use that URL.

## Project Structure

```
sign-to-health-app/
├── src/
│   ├── app/           # Next.js App Router (landing, /app)
│   ├── components/    # UI components
│   └── lib/           # Medical reasoning, emotion, triage, emergency logic
└── docs/              # Architecture, input layer, triage, automation, explainability
```

## Documentation

See [docs/README.md](docs/README.md) for full documentation.

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS, Framer Motion
- **Vision:** MediaPipe Tasks Vision (HandLandmarker)
- **3D:** Three.js, React Three Fiber, Drei
- **TTS:** Web Speech API

## License

Private / Hackathon project.
