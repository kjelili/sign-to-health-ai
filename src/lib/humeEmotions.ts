/**
 * Hume AI Emotion Definitions
 * 
 * Hume AI Expression Measurement API detects 48 facial/vocal expressions
 * and 53 language expressions. This module defines the complete emotion
 * taxonomy and mapping functions.
 * 
 * Reference: https://dev.hume.ai/docs/expression-measurement/overview
 */

/**
 * Core Hume AI emotion labels (48 for face/voice, 53 for language)
 * These are the emotions Hume can directly detect
 */
export const HUME_EMOTIONS = [
  "Admiration",
  "Adoration",
  "Aesthetic Appreciation",
  "Amusement",
  "Anger",
  "Annoyance",
  "Anxiety",
  "Awe",
  "Awkwardness",
  "Boredom",
  "Calmness",
  "Concentration",
  "Confusion",
  "Contemplation",
  "Contempt",
  "Contentment",
  "Craving",
  "Desire",
  "Determination",
  "Disappointment",
  "Disapproval",
  "Disgust",
  "Distress",
  "Doubt",
  "Ecstasy",
  "Embarrassment",
  "Empathic Pain",
  "Enthusiasm",
  "Entrancement",
  "Envy",
  "Excitement",
  "Fear",
  "Gratitude",
  "Guilt",
  "Horror",
  "Interest",
  "Joy",
  "Love",
  "Nostalgia",
  "Pain",
  "Pride",
  "Realization",
  "Relief",
  "Romance",
  "Sadness",
  "Sarcasm",
  "Satisfaction",
  "Shame",
  "Surprise (negative)",
  "Surprise (positive)",
  "Sympathy",
  "Tiredness",
  "Triumph",
] as const;

export type HumeEmotion = typeof HUME_EMOTIONS[number];

/**
 * Extended emotion labels for medical context
 * These are derived from combinations of Hume emotions
 */
export const MEDICAL_EMOTION_CATEGORIES = {
  // Anger spectrum (from user requirements)
  anger: [
    "Agitated", "Aggravated", "Bitter", "Disdain", "Disgruntled",
    "Disturbed", "Edgy", "Exasperated", "Frustrated", "Furious",
    "Grouchy", "Hostile", "Impatient", "Irritated", "Irate",
    "Moody", "On edge", "Outraged", "Resentful", "Upset", "Vindictive"
  ],
  // Stress spectrum (from user requirements)
  stress: [
    "Anxious", "Burned out", "Cranky", "Depleted", "Edgy",
    "Exhausted", "Frazzled", "Overwhelmed", "Rattled", "Stressed"
  ],
  // Pain indicators
  pain: [
    "Pain", "Empathic Pain", "Distress", "Discomfort", "Agony", "Suffering"
  ],
  // Fear/anxiety
  anxiety: [
    "Anxiety", "Fear", "Horror", "Dread", "Panic", "Worry", "Nervous"
  ],
  // Confusion/disorientation
  confusion: [
    "Confusion", "Disorientation", "Bewildered", "Perplexed", "Dazed"
  ],
  // Positive states
  positive: [
    "Joy", "Calmness", "Contentment", "Relief", "Satisfaction", "Pride"
  ],
  // Neutral/focused
  neutral: [
    "Concentration", "Contemplation", "Interest", "Determination"
  ],
} as const;

/**
 * Medical urgency mapping from emotions
 */
export const EMOTION_URGENCY_MAP: Record<string, "high" | "medium" | "low"> = {
  // High urgency emotions
  "Pain": "high",
  "Empathic Pain": "high",
  "Distress": "high",
  "Fear": "high",
  "Horror": "high",
  "Anxiety": "high",
  "Confusion": "high",
  "Anger": "medium",
  "Disgust": "medium",
  "Sadness": "medium",
  "Tiredness": "low",
  "Boredom": "low",
  "Calmness": "low",
  "Contentment": "low",
};

/**
 * Single emotion score from Hume API
 */
export interface HumeEmotionScore {
  name: string;
  score: number; // 0-1
}

/**
 * Hume API facial expression result
 */
export interface HumeFaceResult {
  predictions: Array<{
    frame: number;
    time: number;
    bbox: { x: number; y: number; w: number; h: number };
    prob: number;
    face_id: string;
    emotions: HumeEmotionScore[];
  }>;
}

/**
 * Hume API prosody (voice) result
 */
export interface HumeProsodyResult {
  predictions: Array<{
    time: { begin: number; end: number };
    emotions: HumeEmotionScore[];
  }>;
}

/**
 * Combined emotion analysis result
 */
export interface HumeAnalysisResult {
  face?: HumeFaceResult;
  prosody?: HumeProsodyResult;
  timestamp: number;
}

/**
 * Map Hume emotions to anger spectrum
 */
export function mapToAngerSpectrum(emotions: HumeEmotionScore[]): {
  label: string;
  intensity: number;
} | null {
  const anger = emotions.find(e => e.name === "Anger")?.score ?? 0;
  const annoyance = emotions.find(e => e.name === "Annoyance")?.score ?? 0;
  const contempt = emotions.find(e => e.name === "Contempt")?.score ?? 0;
  const disgust = emotions.find(e => e.name === "Disgust")?.score ?? 0;
  const disapproval = emotions.find(e => e.name === "Disapproval")?.score ?? 0;
  
  const totalAnger = (anger * 2 + annoyance + contempt + disgust + disapproval) / 6;
  
  if (totalAnger < 0.1) return null;
  
  // Map intensity to specific label
  if (totalAnger > 0.8) return { label: "Furious", intensity: totalAnger };
  if (totalAnger > 0.7) return { label: "Outraged", intensity: totalAnger };
  if (totalAnger > 0.6) return { label: "Hostile", intensity: totalAnger };
  if (totalAnger > 0.5) return { label: "Irate", intensity: totalAnger };
  if (totalAnger > 0.4) return { label: "Frustrated", intensity: totalAnger };
  if (totalAnger > 0.3) return { label: "Irritated", intensity: totalAnger };
  if (totalAnger > 0.2) return { label: "Annoyed", intensity: totalAnger };
  return { label: "Agitated", intensity: totalAnger };
}

/**
 * Map Hume emotions to stress spectrum
 */
export function mapToStressSpectrum(emotions: HumeEmotionScore[]): {
  label: string;
  intensity: number;
} | null {
  const anxiety = emotions.find(e => e.name === "Anxiety")?.score ?? 0;
  const fear = emotions.find(e => e.name === "Fear")?.score ?? 0;
  const distress = emotions.find(e => e.name === "Distress")?.score ?? 0;
  const tiredness = emotions.find(e => e.name === "Tiredness")?.score ?? 0;
  const confusion = emotions.find(e => e.name === "Confusion")?.score ?? 0;
  
  const totalStress = (anxiety * 2 + fear + distress + tiredness + confusion) / 6;
  
  if (totalStress < 0.1) return null;
  
  if (totalStress > 0.8) return { label: "Overwhelmed", intensity: totalStress };
  if (totalStress > 0.7) return { label: "Frazzled", intensity: totalStress };
  if (totalStress > 0.6) return { label: "Exhausted", intensity: totalStress };
  if (totalStress > 0.5) return { label: "Burned out", intensity: totalStress };
  if (totalStress > 0.4) return { label: "Depleted", intensity: totalStress };
  if (totalStress > 0.3) return { label: "Rattled", intensity: totalStress };
  if (totalStress > 0.2) return { label: "Anxious", intensity: totalStress };
  return { label: "Stressed", intensity: totalStress };
}

/**
 * Get top N emotions sorted by score
 */
export function getTopEmotions(
  emotions: HumeEmotionScore[],
  count: number = 5
): HumeEmotionScore[] {
  return [...emotions]
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

/**
 * Calculate pain level from emotions
 */
export function calculatePainLevel(emotions: HumeEmotionScore[]): number {
  const pain = emotions.find(e => e.name === "Pain")?.score ?? 0;
  const empatheticPain = emotions.find(e => e.name === "Empathic Pain")?.score ?? 0;
  const distress = emotions.find(e => e.name === "Distress")?.score ?? 0;
  const fear = emotions.find(e => e.name === "Fear")?.score ?? 0;
  
  // Weighted average with pain having highest weight
  return Math.min(1, (pain * 3 + empatheticPain * 2 + distress + fear) / 7);
}

/**
 * Calculate distress level from emotions
 */
export function calculateDistressLevel(emotions: HumeEmotionScore[]): number {
  const distress = emotions.find(e => e.name === "Distress")?.score ?? 0;
  const anxiety = emotions.find(e => e.name === "Anxiety")?.score ?? 0;
  const fear = emotions.find(e => e.name === "Fear")?.score ?? 0;
  const sadness = emotions.find(e => e.name === "Sadness")?.score ?? 0;
  const horror = emotions.find(e => e.name === "Horror")?.score ?? 0;
  
  return Math.min(1, (distress * 2 + anxiety * 2 + fear * 1.5 + sadness + horror) / 7.5);
}

/**
 * Determine primary emotion category for medical context
 */
export function getMedicalEmotionCategory(emotions: HumeEmotionScore[]): {
  category: keyof typeof MEDICAL_EMOTION_CATEGORIES;
  confidence: number;
  label: string;
} {
  const painLevel = calculatePainLevel(emotions);
  const distressLevel = calculateDistressLevel(emotions);
  const anger = mapToAngerSpectrum(emotions);
  const stress = mapToStressSpectrum(emotions);
  const confusion = emotions.find(e => e.name === "Confusion")?.score ?? 0;
  const calmness = emotions.find(e => e.name === "Calmness")?.score ?? 0;
  const joy = emotions.find(e => e.name === "Joy")?.score ?? 0;
  
  // Priority: Pain > Distress/Anxiety > Confusion > Anger > Stress > Positive > Neutral
  if (painLevel > 0.5) {
    return { category: "pain", confidence: painLevel, label: "In pain" };
  }
  if (distressLevel > 0.5) {
    return { category: "anxiety", confidence: distressLevel, label: "Distressed" };
  }
  if (confusion > 0.4) {
    return { category: "confusion", confidence: confusion, label: "Confused" };
  }
  if (anger && anger.intensity > 0.3) {
    return { category: "anger", confidence: anger.intensity, label: anger.label };
  }
  if (stress && stress.intensity > 0.3) {
    return { category: "stress", confidence: stress.intensity, label: stress.label };
  }
  if (calmness > 0.5 || joy > 0.5) {
    const label = joy > calmness ? "Content" : "Calm";
    return { category: "positive", confidence: Math.max(calmness, joy), label };
  }
  
  return { category: "neutral", confidence: 0.5, label: "Neutral" };
}
