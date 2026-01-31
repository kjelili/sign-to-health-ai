/**
 * Emotional Intelligence Layer
 * 
 * Comprehensive emotion detection using Hume AI Expression Measurement API
 * with gesture-based fallback for medical context.
 * 
 * Capabilities:
 * - Real-time facial expression analysis (48 emotions via Hume AI)
 * - Pain intensity detection
 * - Stress and anxiety measurement
 * - Confusion/disorientation detection
 * - Anger spectrum (Agitated → Furious)
 * - Stress spectrum (Anxious → Overwhelmed)
 * 
 * Reference: https://dev.hume.ai/docs/expression-measurement/overview
 */

import type { GestureState, EmotionState, ExtendedEmotionState } from "./types";
import {
  mapToAngerSpectrum,
  mapToStressSpectrum,
  calculatePainLevel,
  calculateDistressLevel,
  getMedicalEmotionCategory,
  getTopEmotions,
  type HumeEmotionScore,
} from "./humeEmotions";
import { type ProcessedEmotionResult } from "./humeService";

// Gesture tokens that indicate pain
const PAIN_TOKENS = [
  "pain", "sharp", "burning", "cramping", "aching",
  "throbbing", "stabbing", "dull", "severe", "mild",
  "closed_fist", "grimace", "wince"
];

// Gesture tokens that indicate distress
const DISTRESS_TOKENS = [
  "breathing", "chest", "point_chest", "gasping",
  "hyperventilating", "difficulty_breathing", "emergency",
  "fallen", "collapse", "critical"
];

// Gesture tokens that indicate anxiety
const ANXIETY_TOKENS = [
  "breathing", "rapid", "shallow", "trembling",
  "shaking", "restless", "fidgeting"
];

// Gesture tokens that indicate confusion
const CONFUSION_TOKENS = [
  "confused", "disoriented", "lost", "uncertain",
  "hesitant", "searching", "wandering"
];

// Gesture tokens that indicate anger/frustration
const ANGER_TOKENS = [
  "aggressive", "frustrated", "agitated", "angry",
  "closed_fist", "hitting", "pounding"
];

/**
 * Current Hume AI emotion state (updated by CameraCapture)
 */
let currentHumeState: ProcessedEmotionResult | null = null;

/**
 * Set the current Hume AI emotion state
 * Called by CameraCapture when Hume AI returns results
 */
export function setHumeEmotionState(state: ProcessedEmotionResult | null): void {
  currentHumeState = state;
}

/**
 * Get the current Hume AI emotion state
 */
export function getHumeEmotionState(): ProcessedEmotionResult | null {
  return currentHumeState;
}

/**
 * Infer emotion from gestures (fallback when Hume AI is not available)
 * 
 * This is the legacy method that uses gesture tokens to estimate
 * emotional state. It's less accurate than Hume AI but works offline.
 */
export function inferEmotionFromGestures(
  gestureState: GestureState | null
): EmotionState | null {
  // If Hume AI state is available and recent (within 2 seconds), use it
  if (currentHumeState && Date.now() - currentHumeState.timestamp < 2000) {
    return {
      painLevel: currentHumeState.painLevel,
      distress: currentHumeState.distress,
      emotion: currentHumeState.categoryLabel,
      confidence: currentHumeState.confidence,
    };
  }
  
  // Fallback to gesture-based inference
  if (!gestureState || gestureState.gestureTokens.length === 0) {
    return null;
  }

  const tokens = gestureState.gestureTokens.map((t) => t.toLowerCase());
  
  const hasPain = tokens.some((t) => PAIN_TOKENS.some(pt => t.includes(pt)));
  const hasDistress = tokens.some((t) => DISTRESS_TOKENS.some(dt => t.includes(dt)));
  const hasAnxiety = tokens.some((t) => ANXIETY_TOKENS.some(at => t.includes(at)));
  const hasConfusion = tokens.some((t) => CONFUSION_TOKENS.some(ct => t.includes(ct)));
  const hasAnger = tokens.some((t) => ANGER_TOKENS.some(ant => t.includes(ant)));

  let painLevel = 0;
  let distress = 0;
  let emotion = "neutral";
  let confidence = 0.5;

  // Calculate pain level
  if (hasPain) {
    painLevel = 0.6 + Math.random() * 0.3;
    emotion = "In pain";
    confidence = 0.7;
  }

  // Calculate distress level
  if (hasDistress) {
    distress = 0.7 + Math.random() * 0.2;
    if (emotion === "neutral") emotion = "Distressed";
    confidence = Math.max(confidence, 0.75);
  }

  // Check for anxiety
  if (hasAnxiety) {
    distress = Math.max(distress, 0.5 + Math.random() * 0.3);
    emotion = emotion === "neutral" ? "Anxious" : emotion;
    confidence = Math.max(confidence, 0.65);
  }

  // Check for confusion
  if (hasConfusion) {
    emotion = "Confused";
    confidence = Math.max(confidence, 0.6);
  }

  // Check for anger
  if (hasAnger) {
    emotion = "Frustrated";
    confidence = Math.max(confidence, 0.65);
  }

  // Emergency situations increase distress
  if (tokens.some(t => ["fallen", "collapse", "emergency", "critical"].includes(t))) {
    distress = Math.max(distress, 0.9);
    painLevel = Math.max(painLevel, 0.7);
    emotion = "Critical distress";
    confidence = 0.9;
  }

  return {
    painLevel,
    distress,
    emotion,
    confidence,
  };
}

/**
 * Get extended emotion state combining Hume AI and gesture analysis
 * 
 * This provides the most comprehensive emotional analysis by:
 * 1. Using Hume AI facial expression data when available
 * 2. Augmenting with gesture-based inference
 * 3. Mapping to medical-relevant categories
 */
export function getExtendedEmotionState(
  gestureState: GestureState | null
): ExtendedEmotionState | null {
  const humeState = currentHumeState;
  const gestureEmotion = inferEmotionFromGestures(gestureState);
  
  if (!humeState && !gestureEmotion) {
    return null;
  }

  // If Hume AI is available, use it as primary source
  if (humeState && Date.now() - humeState.timestamp < 2000) {
    // Find anger and stress spectrum labels
    const angerResult = mapToAngerSpectrum(humeState.rawEmotions);
    const stressResult = mapToStressSpectrum(humeState.rawEmotions);
    
    return {
      painLevel: humeState.painLevel,
      distress: humeState.distress,
      emotion: humeState.categoryLabel,
      confidence: humeState.confidence,
      anxiety: humeState.anxiety,
      confusion: humeState.confusion,
      anger: humeState.anger,
      category: humeState.category as ExtendedEmotionState["category"],
      categoryLabel: humeState.categoryLabel,
      topEmotions: humeState.topEmotions,
      source: "hume",
      angerSpectrum: angerResult?.label,
      stressSpectrum: stressResult?.label,
    };
  }

  // Fallback to gesture-based inference
  if (gestureEmotion) {
    const tokens = gestureState?.gestureTokens.map(t => t.toLowerCase()) ?? [];
    
    // Determine category from gesture tokens
    let category: ExtendedEmotionState["category"] = "neutral";
    if (gestureEmotion.painLevel > 0.5) category = "pain";
    else if (gestureEmotion.distress > 0.5) category = "anxiety";
    else if (tokens.some(t => CONFUSION_TOKENS.some(ct => t.includes(ct)))) category = "confusion";
    else if (tokens.some(t => ANGER_TOKENS.some(at => t.includes(at)))) category = "anger";
    
    return {
      ...gestureEmotion,
      anxiety: gestureEmotion.distress * 0.8, // Estimate from distress
      confusion: tokens.some(t => CONFUSION_TOKENS.some(ct => t.includes(ct))) ? 0.6 : 0,
      anger: tokens.some(t => ANGER_TOKENS.some(at => t.includes(at))) ? 0.6 : 0,
      category,
      categoryLabel: gestureEmotion.emotion,
      topEmotions: [],
      source: "gesture",
    };
  }

  return null;
}

/**
 * Check if emotion state indicates high alert
 * (pain > 0.7 or distress > 0.7)
 */
export function isEmotionHighAlert(emotion: EmotionState | null): boolean {
  if (!emotion) return false;
  return emotion.painLevel > 0.7 || emotion.distress > 0.7;
}

/**
 * Get emotion-based urgency level
 */
export function getEmotionUrgency(
  emotion: EmotionState | ExtendedEmotionState | null
): "critical" | "high" | "medium" | "low" | null {
  if (!emotion) return null;
  
  const maxLevel = Math.max(emotion.painLevel, emotion.distress);
  
  if (maxLevel > 0.85) return "critical";
  if (maxLevel > 0.7) return "high";
  if (maxLevel > 0.4) return "medium";
  return "low";
}

/**
 * Format emotion state for display
 */
export function formatEmotionForDisplay(
  emotion: EmotionState | ExtendedEmotionState | null
): string {
  if (!emotion) return "No emotional data";
  
  const parts: string[] = [];
  
  parts.push(`Emotion: ${emotion.emotion}`);
  
  if (emotion.painLevel > 0) {
    parts.push(`Pain: ${Math.round(emotion.painLevel * 100)}%`);
  }
  
  if (emotion.distress > 0) {
    parts.push(`Distress: ${Math.round(emotion.distress * 100)}%`);
  }
  
  // Extended state information
  if ("anxiety" in emotion && emotion.anxiety > 0.2) {
    parts.push(`Anxiety: ${Math.round(emotion.anxiety * 100)}%`);
  }
  
  if ("angerSpectrum" in emotion && emotion.angerSpectrum) {
    parts.push(`State: ${emotion.angerSpectrum}`);
  }
  
  if ("stressSpectrum" in emotion && emotion.stressSpectrum) {
    parts.push(`Stress: ${emotion.stressSpectrum}`);
  }
  
  return parts.join(" | ");
}

/**
 * Get recommended response based on emotional state
 */
export function getEmotionalResponse(
  emotion: EmotionState | ExtendedEmotionState | null
): {
  verbal: string;
  nonVerbal: string;
  clinical: string;
} {
  if (!emotion) {
    return {
      verbal: "How can I help you today?",
      nonVerbal: "Maintain open, welcoming posture",
      clinical: "Patient presenting for assessment",
    };
  }
  
  const urgency = getEmotionUrgency(emotion);
  
  if (urgency === "critical") {
    return {
      verbal: "I can see you're in significant distress. Help is here. Try to stay calm.",
      nonVerbal: "Move closer, maintain eye contact, speak slowly and clearly",
      clinical: "Patient in acute distress. Immediate assessment required.",
    };
  }
  
  if (emotion.painLevel > 0.5) {
    return {
      verbal: "I can see you're experiencing pain. Let me help you communicate where it hurts.",
      nonVerbal: "Use gentle, reassuring gestures",
      clinical: "Patient reporting significant pain. Pain assessment needed.",
    };
  }
  
  if (emotion.distress > 0.5) {
    return {
      verbal: "Take your time. You're in a safe place and we're here to help.",
      nonVerbal: "Speak softly, give space, maintain calm demeanor",
      clinical: "Patient showing signs of emotional distress. Consider mental health support.",
    };
  }
  
  if ("category" in emotion) {
    if (emotion.category === "confusion") {
      return {
        verbal: "Let's take this step by step. I'm here to help you.",
        nonVerbal: "Use simple gestures, point to visual aids",
        clinical: "Patient showing signs of confusion. Cognitive assessment may be needed.",
      };
    }
    
    if (emotion.category === "anger") {
      return {
        verbal: "I understand this is frustrating. Let's work together to help you.",
        nonVerbal: "Maintain safe distance, stay calm, don't match agitation",
        clinical: "Patient showing signs of frustration/anger. De-escalation approach recommended.",
      };
    }
  }
  
  return {
    verbal: "Please show me what's bothering you.",
    nonVerbal: "Use open body language, maintain attentive posture",
    clinical: "Patient presenting for evaluation. Continue assessment.",
  };
}
