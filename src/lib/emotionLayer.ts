/**
 * Phase 2: Emotional Intelligence Layer
 * In production: Hume AI API for pain, stress, anxiety, distress
 * For MVP: Mock inference from gesture tokens
 */

import type { GestureState } from "./types";
import type { EmotionState } from "./types";

const PAIN_TOKENS = ["pain", "sharp", "burning", "cramping"];
const DISTRESS_TOKENS = ["breathing", "chest", "point_chest"];
const ANXIETY_TOKENS = ["breathing"];

export function inferEmotionFromGestures(
  gestureState: GestureState | null
): EmotionState | null {
  if (!gestureState || gestureState.gestureTokens.length === 0) {
    return null;
  }

  const tokens = gestureState.gestureTokens.map((t) => t.toLowerCase());
  const hasPain = tokens.some((t) => PAIN_TOKENS.includes(t));
  const hasDistress = tokens.some((t) => DISTRESS_TOKENS.includes(t));
  const hasAnxiety = tokens.some((t) => ANXIETY_TOKENS.includes(t));

  let painLevel = 0;
  let distress = 0;
  let emotion = "neutral";

  if (hasPain) {
    painLevel = 0.7 + Math.random() * 0.2;
    emotion = "pain";
  }
  if (hasDistress) {
    distress = 0.75 + Math.random() * 0.15;
    if (emotion === "neutral") emotion = "distressed";
  }
  if (hasAnxiety) {
    distress = Math.max(distress, 0.6);
    emotion = emotion === "distressed" ? "anxious" : "anxious";
  }

  return {
    painLevel,
    distress,
    emotion,
    confidence: 0.85,
  };
}
