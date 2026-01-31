/**
 * Phase 4: AI Triage Mode (High Impact Feature)
 * Maps gesture/emotion patterns to urgency levels
 * 
 * Pattern → Output mapping:
 * - Stroke gestures → 🚨 Immediate
 * - Fall/Collapse → 🚨 Immediate
 * - Chest pain + fear → 🚑 Emergency
 * - Breathing difficulty → 🚑 Emergency
 * - Migraine → 🟡 Non-urgent
 * - Anxiety attack → 🧠 Mental health
 */

import type { GestureState } from "./types";
import { inferEmotionFromGestures } from "./emotionLayer";

export type TriageUrgency =
  | "immediate"
  | "emergency"
  | "urgent"
  | "non-urgent"
  | "mental-health"
  | null;

/**
 * Triage urgency labels with emoji indicators
 */
export const TRIAGE_LABELS: Record<NonNullable<TriageUrgency>, string> = {
  immediate: "🚨 Immediate",
  emergency: "🚑 Emergency",
  urgent: "⚠️ Urgent",
  "non-urgent": "🟡 Non-urgent",
  "mental-health": "🧠 Mental Health",
};

/**
 * Triage colors for UI
 */
export const TRIAGE_COLORS: Record<NonNullable<TriageUrgency>, string> = {
  immediate: "#ef4444", // Red
  emergency: "#f97316", // Orange
  urgent: "#eab308", // Yellow
  "non-urgent": "#22c55e", // Green
  "mental-health": "#a855f7", // Purple
};

/**
 * Department mapping based on triage
 */
export const TRIAGE_DEPARTMENTS: Record<NonNullable<TriageUrgency>, string> = {
  immediate: "Emergency Department",
  emergency: "Emergency Department",
  urgent: "Urgent Care",
  "non-urgent": "General Medicine",
  "mental-health": "Psychiatry / Mental Health",
};

/**
 * Triage pattern definitions for knowledge graph
 */
export interface TriagePattern {
  id: string;
  name: string;
  tokens: string[];
  emotionThreshold?: { painLevel?: number; distress?: number };
  urgency: TriageUrgency;
  department: string;
}

export const TRIAGE_PATTERNS: TriagePattern[] = [
  {
    id: "stroke",
    name: "Stroke Gestures",
    tokens: ["stroke", "help"],
    urgency: "immediate",
    department: "Emergency - Neurology",
  },
  {
    id: "collapse",
    name: "Fall / Collapse",
    tokens: ["fallen", "collapse", "fall", "critical", "prone_position"],
    urgency: "immediate",
    department: "Emergency - Trauma",
  },
  {
    id: "chest_distress",
    name: "Chest Pain + Fear",
    tokens: ["point_chest", "chest"],
    emotionThreshold: { distress: 0.6 },
    urgency: "emergency",
    department: "Emergency - Cardiology",
  },
  {
    id: "breathing",
    name: "Breathing Difficulty",
    tokens: ["breathing"],
    emotionThreshold: { distress: 0.5 },
    urgency: "emergency",
    department: "Emergency - Respiratory",
  },
  {
    id: "migraine",
    name: "Migraine / Headache",
    tokens: ["point_head", "point_temple", "head"],
    urgency: "non-urgent",
    department: "General Medicine / Neurology",
  },
  {
    id: "anxiety",
    name: "Anxiety / Panic Attack",
    tokens: ["breathing"],
    emotionThreshold: { distress: 0.5 },
    urgency: "mental-health",
    department: "Psychiatry / Mental Health",
  },
  {
    id: "abdominal_acute",
    name: "Acute Abdominal Pain",
    tokens: ["point_lower_right"],
    emotionThreshold: { painLevel: 0.7 },
    urgency: "urgent",
    department: "Emergency - Surgery",
  },
  {
    id: "abdominal_general",
    name: "Abdominal Discomfort",
    tokens: ["point_abdomen", "abdomen", "stomach", "point_stomach", "point_lower_left"],
    urgency: "urgent",
    department: "Gastroenterology",
  },
];

/**
 * Infer triage urgency from gestures and clinical interpretation
 */
export function inferTriageUrgency(
  gestureState: GestureState | null,
  clinicalInterpretation: string | null
): TriageUrgency {
  if (!gestureState && !clinicalInterpretation) return null;

  const tokens = gestureState?.gestureTokens.map((t) => t.toLowerCase()) ?? [];
  const emotion = gestureState ? inferEmotionFromGestures(gestureState) : null;
  const text = clinicalInterpretation?.toLowerCase() ?? "";

  // PRIORITY 1: Fall/Collapse → Immediate
  if (tokens.some((t) => ["fallen", "collapse", "fall", "critical", "prone_position"].includes(t))) {
    return "immediate";
  }

  // PRIORITY 2: Stroke gestures → Immediate
  if (tokens.some((t) => ["stroke", "help", "emergency"].includes(t))) {
    return "immediate";
  }

  // PRIORITY 3: Chest pain + high distress → Emergency
  if (
    (tokens.includes("point_chest") || tokens.includes("chest")) &&
    (emotion?.distress ?? 0) > 0.6
  ) {
    return "emergency";
  }

  // PRIORITY 4: Breathing difficulty with distress → Emergency
  if (tokens.includes("breathing")) {
    if ((emotion?.distress ?? 0) > 0.5 || text.includes("urgency: high")) {
      // Check if it's more anxiety-related
      if (text.includes("mental") || text.includes("anxiety") || text.includes("panic")) {
        return "mental-health";
      }
      if (text.includes("respiratory") || text.includes("breathing") || text.includes("dyspnea")) {
        return "emergency";
      }
    }
    // Breathing with anxiety context
    if (emotion?.emotion === "anxious") {
      return "mental-health";
    }
    return "emergency";
  }

  // PRIORITY 5: Anxiety / panic (high emotional distress without physical symptoms)
  if ((emotion?.distress ?? 0) > 0.7 && emotion?.emotion === "anxious") {
    return "mental-health";
  }

  // PRIORITY 6: Acute abdominal pain (lower right = appendix concern)
  if (tokens.includes("point_lower_right") && (emotion?.painLevel ?? 0) > 0.5) {
    return "urgent";
  }

  // PRIORITY 7: General abdominal pain → Urgent
  if (
    tokens.some((t) =>
      ["point_abdomen", "point_lower_right", "point_lower_left", "abdomen", "stomach"].includes(t)
    )
  ) {
    return "urgent";
  }

  // PRIORITY 8: Migraine / headache → Non-urgent
  if (tokens.some((t) => ["point_head", "point_temple", "head"].includes(t))) {
    if (tokens.some((t) => ["pain", "closed_fist"].includes(t))) {
      return "non-urgent";
    }
  }

  // Fallback: check clinical text for urgency hints
  if (text.includes("emergency") || text.includes("critical") || text.includes("immediate")) {
    return "emergency";
  }
  if (text.includes("urgency: high")) {
    return "emergency";
  }
  if (text.includes("urgent")) {
    return "urgent";
  }

  return null;
}

/**
 * Get matched triage pattern for knowledge graph display
 */
export function getMatchedTriagePattern(
  gestureState: GestureState | null
): TriagePattern | null {
  if (!gestureState) return null;

  const tokens = gestureState.gestureTokens.map((t) => t.toLowerCase());
  const emotion = inferEmotionFromGestures(gestureState);

  for (const pattern of TRIAGE_PATTERNS) {
    const hasToken = pattern.tokens.some((t) => tokens.includes(t));
    
    if (hasToken) {
      // Check emotion threshold if specified
      if (pattern.emotionThreshold) {
        const painOk = !pattern.emotionThreshold.painLevel || 
          (emotion?.painLevel ?? 0) >= pattern.emotionThreshold.painLevel;
        const distressOk = !pattern.emotionThreshold.distress || 
          (emotion?.distress ?? 0) >= pattern.emotionThreshold.distress;
        
        if (painOk && distressOk) {
          return pattern;
        }
      } else {
        return pattern;
      }
    }
  }

  return null;
}
