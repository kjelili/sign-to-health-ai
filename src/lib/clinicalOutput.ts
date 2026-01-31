/**
 * Clinical Output Generator
 * Generates SOAP notes and ICD-10 code suggestions based on gesture interpretation.
 * 
 * DISCLAIMER: This is for demonstration purposes only.
 * Real medical coding requires certified professionals.
 */

import type { GestureState, EmotionState, ClinicalOutput } from "./types";
import { inferEmotionFromGestures } from "./emotionLayer";

// ICD-10 code mappings for common symptoms
// Reference: These are simplified mappings for demo purposes
const ICD10_MAPPINGS: Record<string, { code: string; description: string }[]> = {
  // Head/Neurological
  "point_head": [
    { code: "R51.9", description: "Headache, unspecified" },
    { code: "G43.909", description: "Migraine, unspecified" },
  ],
  "head": [
    { code: "R51.9", description: "Headache, unspecified" },
  ],
  "point_temple": [
    { code: "G43.909", description: "Migraine, unspecified" },
    { code: "R51.9", description: "Headache, unspecified" },
  ],
  
  // Chest/Cardiac
  "point_chest": [
    { code: "R07.9", description: "Chest pain, unspecified" },
    { code: "R07.89", description: "Other chest pain" },
  ],
  "chest": [
    { code: "R07.9", description: "Chest pain, unspecified" },
  ],
  "breathing": [
    { code: "R06.00", description: "Dyspnea, unspecified" },
    { code: "R06.02", description: "Shortness of breath" },
  ],
  
  // Abdominal
  "point_abdomen": [
    { code: "R10.9", description: "Unspecified abdominal pain" },
    { code: "R10.84", description: "Generalized abdominal pain" },
  ],
  "abdomen": [
    { code: "R10.9", description: "Unspecified abdominal pain" },
  ],
  "stomach": [
    { code: "R10.13", description: "Epigastric pain" },
    { code: "K30", description: "Functional dyspepsia" },
  ],
  "point_stomach": [
    { code: "R10.13", description: "Epigastric pain" },
  ],
  "point_lower_right": [
    { code: "R10.31", description: "Right lower quadrant pain" },
    { code: "K35.80", description: "Unspecified acute appendicitis" },
  ],
  "point_lower_left": [
    { code: "R10.32", description: "Left lower quadrant pain" },
    { code: "K57.92", description: "Diverticulitis, unspecified" },
  ],
  
  // Pain indicators
  "pain": [
    { code: "R52", description: "Pain, unspecified" },
  ],
  "closed_fist": [
    { code: "R52", description: "Pain, unspecified" },
  ],
  
  // Mental health
  "distress": [
    { code: "F41.9", description: "Anxiety disorder, unspecified" },
    { code: "R45.7", description: "State of emotional shock" },
  ],
  
  // Emergency
  "stroke": [
    { code: "I63.9", description: "Cerebral infarction, unspecified" },
    { code: "G45.9", description: "Transient cerebral ischemic attack" },
  ],
  "emergency": [
    { code: "R55", description: "Syncope and collapse" },
  ],
};

/**
 * Get relevant ICD-10 codes based on gesture tokens
 */
export function getICD10Codes(gestureTokens: string[]): { code: string; description: string }[] {
  const codes: { code: string; description: string }[] = [];
  const seenCodes = new Set<string>();
  
  for (const token of gestureTokens) {
    const mappings = ICD10_MAPPINGS[token.toLowerCase()];
    if (mappings) {
      for (const mapping of mappings) {
        if (!seenCodes.has(mapping.code)) {
          seenCodes.add(mapping.code);
          codes.push(mapping);
        }
      }
    }
  }
  
  // Limit to top 5 most relevant codes
  return codes.slice(0, 5);
}

/**
 * Generate a SOAP note from gesture state and emotion
 */
export function generateSOAPNote(
  gestureState: GestureState | null,
  clinicalInterpretation: string | null,
  emotion: EmotionState | null
): ClinicalOutput["soapNote"] | null {
  if (!gestureState || !clinicalInterpretation) return null;
  
  const tokens = gestureState.gestureTokens;
  
  // Determine body region
  let bodyRegion = "unspecified area";
  if (tokens.some(t => ["point_head", "head", "point_temple"].includes(t))) {
    bodyRegion = "head";
  } else if (tokens.some(t => ["point_chest", "chest"].includes(t))) {
    bodyRegion = "chest";
  } else if (tokens.some(t => ["point_abdomen", "abdomen", "stomach", "point_stomach"].includes(t))) {
    bodyRegion = "abdomen";
  } else if (tokens.includes("point_lower_right")) {
    bodyRegion = "right lower quadrant";
  } else if (tokens.includes("point_lower_left")) {
    bodyRegion = "left lower quadrant";
  }
  
  // Determine symptom type
  const hasPain = tokens.some(t => ["pain", "closed_fist"].includes(t));
  const hasBreathing = tokens.includes("breathing");
  const isEmergency = tokens.some(t => ["stroke", "emergency"].includes(t));
  
  // Generate SOAP components
  const subjective = generateSubjective(bodyRegion, hasPain, hasBreathing, emotion, isEmergency);
  const objective = generateObjective(gestureState, emotion);
  const assessment = clinicalInterpretation;
  const plan = generatePlan(bodyRegion, hasPain, hasBreathing, isEmergency, emotion);
  
  return {
    subjective,
    objective,
    assessment,
    plan,
  };
}

function generateSubjective(
  bodyRegion: string,
  hasPain: boolean,
  hasBreathing: boolean,
  emotion: EmotionState | null,
  isEmergency: boolean
): string {
  const parts: string[] = [];
  
  if (isEmergency) {
    parts.push("Patient presents with signs of acute distress requiring immediate attention.");
  }
  
  if (hasPain) {
    parts.push(`Patient indicates pain in the ${bodyRegion} region via gesture.`);
  }
  
  if (hasBreathing) {
    parts.push("Patient signals difficulty breathing.");
  }
  
  if (emotion && emotion.distress > 0.5) {
    parts.push(`Patient appears to be in significant emotional distress (${emotion.emotion}).`);
  }
  
  if (parts.length === 0) {
    parts.push(`Patient is indicating the ${bodyRegion} area through gestures.`);
  }
  
  return parts.join(" ");
}

function generateObjective(gestureState: GestureState, emotion: EmotionState | null): string {
  const parts: string[] = [];
  
  // Communication method
  parts.push("Communication via sign language/gesture interpretation system.");
  
  // Confidence
  parts.push(`Gesture recognition confidence: ${Math.round(gestureState.confidence * 100)}%.`);
  
  // Detected gestures
  const meaningfulTokens = gestureState.gestureTokens.filter(
    t => !["hand_visible", "hand_detected", "touching_body", "communicating"].includes(t)
  );
  if (meaningfulTokens.length > 0) {
    parts.push(`Detected gestures: ${meaningfulTokens.join(", ")}.`);
  }
  
  // Emotional state
  if (emotion) {
    if (emotion.painLevel > 0) {
      parts.push(`Apparent pain level: ${Math.round(emotion.painLevel * 10)}/10.`);
    }
    if (emotion.distress > 0.3) {
      parts.push(`Emotional state: ${emotion.emotion}.`);
    }
  }
  
  return parts.join(" ");
}

function generatePlan(
  bodyRegion: string,
  hasPain: boolean,
  hasBreathing: boolean,
  isEmergency: boolean,
  emotion: EmotionState | null
): string {
  const plans: string[] = [];
  
  if (isEmergency) {
    plans.push("1. IMMEDIATE: Activate emergency response protocol.");
    plans.push("2. Obtain vital signs stat.");
    plans.push("3. Prepare for potential rapid deterioration.");
    return plans.join("\n");
  }
  
  let planNum = 1;
  
  // Physical examination
  plans.push(`${planNum}. Conduct focused physical examination of ${bodyRegion}.`);
  planNum++;
  
  // Vital signs
  plans.push(`${planNum}. Obtain vital signs.`);
  planNum++;
  
  // Pain management consideration
  if (hasPain) {
    plans.push(`${planNum}. Assess pain characteristics (location, quality, duration, severity).`);
    planNum++;
  }
  
  // Breathing assessment
  if (hasBreathing) {
    plans.push(`${planNum}. Assess respiratory status, consider pulse oximetry.`);
    planNum++;
  }
  
  // Mental health
  if (emotion && emotion.distress > 0.5) {
    plans.push(`${planNum}. Provide emotional support and reassurance.`);
    planNum++;
  }
  
  // Follow-up
  plans.push(`${planNum}. Continue gesture-based communication for symptom clarification.`);
  
  return plans.join("\n");
}

/**
 * Generate complete clinical output
 */
export function generateClinicalOutput(
  gestureState: GestureState | null,
  clinicalInterpretation: string | null
): ClinicalOutput | null {
  if (!gestureState || !clinicalInterpretation) return null;
  
  const emotion = inferEmotionFromGestures(gestureState);
  const soapNote = generateSOAPNote(gestureState, clinicalInterpretation, emotion);
  const icd10 = getICD10Codes(gestureState.gestureTokens);
  
  return {
    summary: clinicalInterpretation,
    soapNote: soapNote || undefined,
    icd10Codes: icd10.length > 0 ? icd10.map(c => `${c.code} - ${c.description}`) : undefined,
    triageUrgency: null, // Will be set by triage logic separately
  };
}
