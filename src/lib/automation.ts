/**
 * Automation Layer
 * Full workflow automation for Sign-to-Health AI
 * 
 * Workflow: New session → Emotion high → Auto triage → Generate report →
 *           Send to doctor → Save to patient history → Export PDF → Play voice summary
 * 
 * In production: n8n / Manus for orchestration
 * For MVP: Client-side automation with local storage
 */

import type { GestureState, EmotionState, ClinicalOutput } from "./types";
import type { TriageUrgency } from "./triageLogic";
import { inferTriageUrgency, TRIAGE_LABELS } from "./triageLogic";
import { inferEmotionFromGestures } from "./emotionLayer";
import { generateSOAPNote, getICD10Codes } from "./clinicalOutput";
import { getPainRegionFromGestures } from "./painRegion";

/**
 * Session record for patient history
 */
export interface SessionRecord {
  id: string;
  timestamp: number;
  duration: number; // milliseconds
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

/**
 * Automation workflow state
 */
export interface WorkflowState {
  sessionId: string;
  sessionStart: number;
  currentStep: WorkflowStep;
  isEmergency: boolean;
  emotionThresholdTriggered: boolean;
  reportGenerated: boolean;
  voiceSummaryPlayed: boolean;
}

export type WorkflowStep = 
  | "idle"
  | "session_active"
  | "emotion_detected"
  | "auto_triage"
  | "report_generated"
  | "sent_to_doctor"
  | "saved_to_history"
  | "pdf_exported"
  | "voice_summary_played"
  | "completed";

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if emotion levels trigger high alert
 */
export function isEmotionHighAlert(emotion: EmotionState | null): boolean {
  if (!emotion) return false;
  return emotion.painLevel > 0.7 || emotion.distress > 0.7;
}

/**
 * Generate a clinical report from session data
 */
export function generateReport(
  gestureState: GestureState | null,
  clinicalInterpretation: string | null,
  sessionId: string,
  sessionStart: number
): SessionRecord | null {
  if (!gestureState && !clinicalInterpretation) return null;

  const emotion = gestureState ? inferEmotionFromGestures(gestureState) : null;
  const painRegion = getPainRegionFromGestures(gestureState);
  const triageUrgency = inferTriageUrgency(gestureState, clinicalInterpretation);
  const soapNote = generateSOAPNote(gestureState, clinicalInterpretation, emotion);
  const icd10Codes = gestureState ? getICD10Codes(gestureState.gestureTokens) : [];
  
  const isEmergency = gestureState?.gestureTokens.some(t => 
    ["stroke", "emergency", "fallen", "collapse", "critical"].includes(t.toLowerCase())
  ) || false;

  return {
    id: sessionId,
    timestamp: sessionStart,
    duration: Date.now() - sessionStart,
    gestureTokens: gestureState?.gestureTokens || [],
    painRegion,
    emotion,
    clinicalInterpretation,
    triageUrgency,
    soapNote,
    icd10Codes: icd10Codes.map(c => `${c.code} - ${c.description}`),
    patientConfirmed: null,
    emergencyTriggered: isEmergency,
  };
}

/**
 * Format report as text for voice summary
 */
export function formatVoiceSummary(record: SessionRecord): string {
  const parts: string[] = [];
  
  if (record.emergencyTriggered) {
    parts.push("Emergency alert.");
  }
  
  if (record.triageUrgency) {
    parts.push(`Triage level: ${TRIAGE_LABELS[record.triageUrgency]}.`);
  }
  
  if (record.clinicalInterpretation) {
    parts.push(record.clinicalInterpretation);
  }
  
  if (record.painRegion) {
    parts.push(`Pain location: ${record.painRegion}.`);
  }
  
  if (record.emotion && record.emotion.painLevel > 0) {
    parts.push(`Pain level: ${Math.round(record.emotion.painLevel * 10)} out of 10.`);
  }
  
  return parts.join(" ");
}

/**
 * Format report as markdown for PDF export
 */
export function formatReportMarkdown(record: SessionRecord): string {
  const date = new Date(record.timestamp);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const durationMin = Math.floor(record.duration / 60000);
  const durationSec = Math.floor((record.duration % 60000) / 1000);

  let md = `# Sign-to-Health AI Clinical Report\n\n`;
  md += `**Session ID:** ${record.id}\n`;
  md += `**Date:** ${dateStr} ${timeStr}\n`;
  md += `**Duration:** ${durationMin}m ${durationSec}s\n\n`;
  
  if (record.emergencyTriggered) {
    md += `## ⚠️ EMERGENCY ALERT\n\n`;
  }
  
  md += `## Triage Assessment\n\n`;
  md += `**Urgency Level:** ${record.triageUrgency ? TRIAGE_LABELS[record.triageUrgency] : "Not assessed"}\n\n`;
  
  md += `## Clinical Interpretation\n\n`;
  md += `${record.clinicalInterpretation || "No interpretation available."}\n\n`;
  
  if (record.painRegion) {
    md += `## Pain Location\n\n`;
    md += `${record.painRegion}\n\n`;
  }
  
  if (record.emotion) {
    md += `## Emotional State\n\n`;
    md += `- **Emotion:** ${record.emotion.emotion}\n`;
    md += `- **Pain Level:** ${Math.round(record.emotion.painLevel * 100)}%\n`;
    md += `- **Distress Level:** ${Math.round(record.emotion.distress * 100)}%\n\n`;
  }
  
  if (record.soapNote) {
    md += `## SOAP Note\n\n`;
    md += `### Subjective\n${record.soapNote.subjective}\n\n`;
    md += `### Objective\n${record.soapNote.objective}\n\n`;
    md += `### Assessment\n${record.soapNote.assessment}\n\n`;
    md += `### Plan\n${record.soapNote.plan}\n\n`;
  }
  
  if (record.icd10Codes.length > 0) {
    md += `## Suggested ICD-10 Codes\n\n`;
    record.icd10Codes.forEach(code => {
      md += `- ${code}\n`;
    });
    md += `\n`;
  }
  
  if (record.gestureTokens.length > 0) {
    md += `## Detected Gestures\n\n`;
    md += record.gestureTokens.join(", ") + "\n\n";
  }
  
  md += `---\n`;
  md += `*Generated by Sign-to-Health AI - For clinical review only*\n`;
  
  return md;
}

/**
 * Format report as HTML for PDF export
 */
export function formatReportHTML(record: SessionRecord): string {
  const date = new Date(record.timestamp);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const durationMin = Math.floor(record.duration / 60000);
  const durationSec = Math.floor((record.duration % 60000) / 1000);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Sign-to-Health AI Clinical Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; }
    h1 { color: #00d4aa; border-bottom: 2px solid #00d4aa; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    h3 { color: #555; margin-top: 20px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
    .emergency { background: #fee; border: 2px solid #f44; color: #c00; padding: 15px; border-radius: 8px; margin: 20px 0; font-weight: bold; }
    .triage { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
    .triage-immediate { background: #ef4444; color: white; }
    .triage-emergency { background: #f97316; color: white; }
    .triage-urgent { background: #eab308; color: black; }
    .triage-non-urgent { background: #22c55e; color: white; }
    .triage-mental-health { background: #a855f7; color: white; }
    .section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 15px 0; }
    .code { font-family: monospace; background: #e0f2f1; padding: 4px 8px; border-radius: 4px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Sign-to-Health AI Clinical Report</h1>
  <div class="meta">
    <strong>Session ID:</strong> ${record.id}<br>
    <strong>Date:</strong> ${dateStr} ${timeStr}<br>
    <strong>Duration:</strong> ${durationMin}m ${durationSec}s
  </div>
  
  ${record.emergencyTriggered ? '<div class="emergency">⚠️ EMERGENCY ALERT - Immediate attention required</div>' : ''}
  
  <h2>Triage Assessment</h2>
  <span class="triage triage-${record.triageUrgency || 'non-urgent'}">
    ${record.triageUrgency ? TRIAGE_LABELS[record.triageUrgency] : "Not assessed"}
  </span>
  
  <h2>Clinical Interpretation</h2>
  <div class="section">
    ${record.clinicalInterpretation || "No interpretation available."}
  </div>
  
  ${record.painRegion ? `
  <h2>Pain Location</h2>
  <div class="section">${record.painRegion}</div>
  ` : ''}
  
  ${record.emotion ? `
  <h2>Emotional State</h2>
  <div class="section">
    <strong>Emotion:</strong> ${record.emotion.emotion}<br>
    <strong>Pain Level:</strong> ${Math.round(record.emotion.painLevel * 100)}%<br>
    <strong>Distress Level:</strong> ${Math.round(record.emotion.distress * 100)}%
  </div>
  ` : ''}
  
  ${record.soapNote ? `
  <h2>SOAP Note</h2>
  <h3>Subjective</h3>
  <div class="section">${record.soapNote.subjective}</div>
  <h3>Objective</h3>
  <div class="section">${record.soapNote.objective}</div>
  <h3>Assessment</h3>
  <div class="section">${record.soapNote.assessment}</div>
  <h3>Plan</h3>
  <div class="section" style="white-space: pre-line;">${record.soapNote.plan}</div>
  ` : ''}
  
  ${record.icd10Codes.length > 0 ? `
  <h2>Suggested ICD-10 Codes</h2>
  <div class="section">
    ${record.icd10Codes.map(code => `<span class="code">${code}</span><br>`).join('')}
  </div>
  ` : ''}
  
  ${record.gestureTokens.length > 0 ? `
  <h2>Detected Gestures</h2>
  <div class="section">${record.gestureTokens.join(", ")}</div>
  ` : ''}
  
  <div class="footer">
    Generated by Sign-to-Health AI - For clinical review only<br>
    This report is generated by AI-assisted interpretation and should be validated by qualified medical professionals.
  </div>
</body>
</html>
  `.trim();
}

/**
 * Save session to local storage (patient history)
 */
export function saveToHistory(record: SessionRecord): void {
  if (typeof window === "undefined") return;
  
  const history = getSessionHistory();
  history.unshift(record); // Add to beginning
  
  // Keep only last 50 sessions
  if (history.length > 50) {
    history.splice(50);
  }
  
  localStorage.setItem("signToHealth_history", JSON.stringify(history));
}

/**
 * Get session history from local storage
 */
export function getSessionHistory(): SessionRecord[] {
  if (typeof window === "undefined") return [];
  
  try {
    const data = localStorage.getItem("signToHealth_history");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Export report as PDF (opens print dialog)
 */
export function exportToPDF(record: SessionRecord): void {
  const html = formatReportHTML(record);
  const printWindow = window.open("", "_blank");
  
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Play voice summary using Web Speech API or ElevenLabs
 */
export async function playVoiceSummary(
  text: string,
  elevenLabsApiKey?: string
): Promise<void> {
  // If ElevenLabs API key provided, use that (premium voice)
  if (elevenLabsApiKey) {
    try {
      const response = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", // Rachel voice
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsApiKey,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75,
            },
          }),
        }
      );
      
      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        await audio.play();
        return;
      }
    } catch (err) {
      console.warn("ElevenLabs TTS failed, falling back to Web Speech API:", err);
    }
  }
  
  // Fallback to Web Speech API
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }
}

/**
 * Get department recommendation based on triage and symptoms
 */
export function getDepartmentRecommendation(record: SessionRecord): string {
  const tokens = record.gestureTokens.map(t => t.toLowerCase());
  
  // Emergency/Immediate → Emergency Department
  if (record.triageUrgency === "immediate" || record.triageUrgency === "emergency") {
    if (tokens.some(t => ["stroke", "fallen", "collapse"].includes(t))) {
      return "Emergency Department - Neurology consult recommended";
    }
    if (tokens.some(t => ["chest", "point_chest", "breathing"].includes(t))) {
      return "Emergency Department - Cardiology consult recommended";
    }
    return "Emergency Department";
  }
  
  // Mental health
  if (record.triageUrgency === "mental-health") {
    return "Psychiatry / Mental Health Services";
  }
  
  // Abdominal pain
  if (tokens.some(t => ["abdomen", "stomach", "point_abdomen", "point_lower_right", "point_lower_left"].includes(t))) {
    if (tokens.includes("point_lower_right")) {
      return "General Surgery (possible appendicitis)";
    }
    return "Gastroenterology / General Medicine";
  }
  
  // Head pain
  if (tokens.some(t => ["head", "point_head", "point_temple"].includes(t))) {
    return "Neurology / General Medicine";
  }
  
  return "General Medicine / Triage Desk";
}
