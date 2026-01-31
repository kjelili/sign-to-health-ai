/**
 * Phase 3: Silent Emergency Mode
 * Detects patterns that warrant immediate alert
 * Now includes body pose-based fall detection
 */

import type { GestureState } from "./types";
import { inferEmotionFromGestures } from "./emotionLayer";

export function isEmergencySituation(
  gestureState: GestureState | null,
  clinicalInterpretation: string | null
): boolean {
  if (!gestureState && !clinicalInterpretation) return false;

  const tokens = gestureState?.gestureTokens.map((t) => t.toLowerCase()) ?? [];
  const emotion = gestureState ? inferEmotionFromGestures(gestureState) : null;

  // PRIORITY: Fall/Collapse detection from body pose
  const hasFallen = tokens.some((t) =>
    ["fallen", "collapse", "fall", "critical", "prone_position"].includes(t)
  );
  
  if (hasFallen) {
    return true;
  }

  // Stroke gestures (specific emergency signs)
  const strokeLike = tokens.some((t) =>
    ["stroke", "help", "emergency"].includes(t)
  );

  // Chest pain + high distress
  const chestDistress =
    (tokens.includes("point_chest") || tokens.includes("chest")) &&
    (emotion?.distress ?? 0) > 0.7;

  // Breathing difficulty
  const breathingEmergency =
    tokens.includes("breathing") && (emotion?.distress ?? 0) > 0.6;

  // Extreme emotional distress
  const extremeDistress = (emotion?.distress ?? 0) > 0.9;

  // Clinical text suggests emergency
  const textEmergency =
    clinicalInterpretation?.toLowerCase().includes("urgency: high") ||
    clinicalInterpretation?.toLowerCase().includes("emergency") ||
    clinicalInterpretation?.toLowerCase().includes("critical") ||
    clinicalInterpretation?.toLowerCase().includes("cardiac") ||
    clinicalInterpretation?.toLowerCase().includes("respiratory distress") ||
    clinicalInterpretation?.toLowerCase().includes("collapsed");

  return (
    strokeLike ||
    chestDistress ||
    breathingEmergency ||
    extremeDistress ||
    !!textEmergency
  );
}
