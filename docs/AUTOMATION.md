# Automation Layer — Documentation

## Overview

The Automation Layer provides a complete workflow automation system that orchestrates the entire Sign-to-Health AI process from gesture capture to clinical report generation.

**Workflow:** New session → Emotion high → Auto triage → Generate report → Send to doctor → Save to patient history → Export PDF → Play voice summary

## Components

### automation.ts

Core automation service providing:

- Session management
- Report generation
- PDF export
- Voice summary (Web Speech API + ElevenLabs option)
- Patient history (localStorage)
- Department recommendations

### SessionPanel.tsx

UI component for workflow control:

- Session status display
- Save to history button
- Export PDF button
- Play voice summary button
- Session history viewer

## Workflow Steps

### 1. New Session
```typescript
const sessionId = generateSessionId();
const sessionStart = Date.now();
```

### 2. Emotion High Detection
```typescript
function isEmotionHighAlert(emotion: EmotionState | null): boolean {
  if (!emotion) return false;
  return emotion.painLevel > 0.7 || emotion.distress > 0.7;
}
```

When detected, displays alert banner and triggers auto-triage.

### 3. Auto Triage
Automatically classifies urgency using `triageLogic.ts`:
- Immediate (stroke, collapse)
- Emergency (chest pain + distress)
- Urgent (abdominal pain)
- Non-urgent (headache)
- Mental health (anxiety)

### 4. Generate Report
```typescript
interface SessionRecord {
  id: string;
  timestamp: number;
  duration: number;
  gestureTokens: string[];
  painRegion: string | null;
  emotion: EmotionState | null;
  clinicalInterpretation: string | null;
  triageUrgency: TriageUrgency;
  soapNote: ClinicalOutput["soapNote"] | null;
  icd10Codes: string[];
  patientConfirmed: boolean | null;
  emergencyTriggered: boolean;
}
```

### 5. Send to Doctor
Report includes:
- Clinical interpretation
- SOAP note
- ICD-10 codes
- Triage urgency
- Department recommendation

### 6. Save to Patient History
```typescript
saveToHistory(record: SessionRecord): void
```
Stores in localStorage, keeps last 50 sessions.

### 7. Export PDF
```typescript
exportToPDF(record: SessionRecord): void
```
Opens print dialog with formatted HTML report.

### 8. Play Voice Summary
```typescript
playVoiceSummary(text: string, elevenLabsApiKey?: string): Promise<void>
```
- Uses ElevenLabs if API key provided
- Falls back to Web Speech API

## Department Routing

Based on triage and symptoms:

| Condition | Department |
|-----------|------------|
| Stroke/Collapse | Emergency - Neurology |
| Chest pain/Breathing | Emergency - Cardiology |
| Mental health | Psychiatry |
| Lower right abdomen | Surgery (appendicitis) |
| Abdominal | Gastroenterology |
| Headache | Neurology |
| Default | General Medicine |

## PDF Report Format

The PDF report includes:
- Session metadata (ID, date, duration)
- Emergency alert (if triggered)
- Triage assessment with color coding
- Clinical interpretation
- Pain location
- Emotional state
- Full SOAP note
- ICD-10 code suggestions
- Detected gestures
- Disclaimer

## Voice Summary Format

Example output:
```
"Emergency alert. Triage level: Immediate. 
CRITICAL EMERGENCY: Patient has collapsed. 
Pain location: chest. Pain level: 8 out of 10."
```

## ElevenLabs Integration

To use ElevenLabs premium voices:

1. Get API key from elevenlabs.io
2. Pass to `playVoiceSummary(text, apiKey)`
3. Uses "Rachel" voice by default

```typescript
await playVoiceSummary(summary, process.env.ELEVENLABS_API_KEY);
```

## Local Storage Schema

Key: `signToHealth_history`
Value: Array of SessionRecord (max 50)

## Future: n8n Integration

For production deployment with n8n:

```yaml
# n8n Workflow
trigger: webhook
steps:
  - receive_session_data
  - check_emotion_threshold
  - run_triage_rules
  - generate_report
  - send_to_ehr (FHIR)
  - notify_doctor (email/pager)
  - save_to_database
  - send_pdf_to_patient
  - log_audit_trail
```

## API Reference

### generateSessionId()
Returns unique session ID string.

### generateReport(gestureState, clinicalInterpretation, sessionId, sessionStart)
Returns SessionRecord or null.

### formatVoiceSummary(record)
Returns text string for TTS.

### formatReportHTML(record)
Returns HTML string for PDF.

### saveToHistory(record)
Saves to localStorage.

### getSessionHistory()
Returns array of SessionRecord.

### exportToPDF(record)
Opens print dialog.

### getDepartmentRecommendation(record)
Returns department string.
