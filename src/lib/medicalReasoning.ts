/**
 * Phase 1: Medical Reasoning Layer (MVP)
 * Translates gesture tokens + context into clinical interpretation.
 * In production: MedGemma + OpenAI + LangChain
 * For MVP: Rule-based inference + structured prompts
 */

import type { GestureState } from "./types";

// Body region mapping from common pointing gestures
const BODY_REGIONS: Record<string, string> = {
  "point_head": "head",
  "point_chest": "chest",
  "point_abdomen": "abdomen",
  "point_stomach": "stomach/abdomen",
  "point_lower_right": "lower right abdomen",
  "point_lower_left": "lower left abdomen",
  "point_back": "back",
  "point_throat": "throat",
  "point_temple": "head (temple)",
};

// Gesture token to symptom mapping
const GESTURE_SYMPTOMS: Record<string, string> = {
  "pain": "pain",
  "sharp": "sharp pain",
  "dull": "dull ache",
  "burning": "burning sensation",
  "cramping": "cramping",
  "pressure": "pressure",
  "nausea": "nausea",
  "dizzy": "dizziness",
  "breathing": "difficulty breathing",
  "chest": "chest discomfort",
};

export function inferClinicalInterpretation(
  gestureState: GestureState | null
): string | null {
  if (!gestureState || gestureState.gestureTokens.length === 0) {
    return null;
  }

  const tokens = gestureState.gestureTokens.map((t) => t.toLowerCase());
  const hasPain = tokens.some((t) =>
    ["pain", "sharp", "dull", "burning", "cramping", "fist", "closed_fist"].includes(t)
  );
  const hasChest = tokens.includes("chest") || tokens.includes("point_chest");
  const hasAbdomen =
    tokens.includes("point_abdomen") ||
    tokens.includes("point_stomach") ||
    tokens.includes("point_lower_right") ||
    tokens.includes("point_lower_left") ||
    tokens.includes("abdomen") ||
    tokens.includes("stomach");
  const hasHead = tokens.includes("point_head") || tokens.includes("point_temple") || tokens.includes("head");
  const hasBreathing = tokens.includes("breathing");
  const hasPointing = tokens.includes("pointing");
  const hasOpenPalm = tokens.includes("open_palm") || tokens.includes("palm");
  const hasTouching = tokens.includes("touching_body");
  
  // Emergency conditions from body pose
  const hasFallen = tokens.includes("fallen") || tokens.includes("collapse");
  const hasCritical = tokens.includes("critical") || tokens.includes("prone_position");
  const hasDistress = tokens.includes("distress") || tokens.includes("crouching");

  // PRIORITY: Fall/Collapse detection - EMERGENCY
  if (hasFallen) {
    if (hasCritical) {
      return "CRITICAL EMERGENCY: Patient has collapsed and is in prone position. Immediate medical intervention required. Check airway, breathing, circulation. Call emergency services immediately.";
    }
    return "EMERGENCY: Patient has fallen or collapsed. This may indicate stroke, cardiac event, syncope, or severe pain reaction. Immediate assessment required. Check responsiveness and vital signs.";
  }

  // Body in distress position (crouching)
  if (hasDistress && !hasFallen) {
    return "Patient is in a crouched/distressed position. This may indicate severe pain, nausea, or pre-syncope. Assist patient to safe position and assess symptoms.";
  }

  // Simple triage logic
  if (hasChest && (hasPain || hasBreathing)) {
    return "Patient reports chest discomfort with possible pain or breathing difficulty. Consider cardiac or respiratory assessment. Urgency: High.";
  }
  if (hasAbdomen && hasPain) {
    return "Patient indicates pain in the abdominal/stomach region. Symptoms may suggest gastrointestinal or appendiceal concern. Urgency: Assess severity.";
  }
  if (hasAbdomen) {
    return "Patient is indicating the abdominal/stomach area. Ask about type of discomfort (pain, nausea, cramping).";
  }
  if (hasHead && hasPain) {
    return "Patient reports head pain or headache. Consider migraine, tension, or other neurological causes. Urgency: Assess severity and accompanying symptoms.";
  }
  if (hasHead) {
    return "Patient is indicating the head area. Ask about type of discomfort (headache, dizziness, vision issues).";
  }
  if (hasBreathing) {
    return "Patient signals difficulty breathing. Respiratory distress possible. Urgency: High.";
  }
  if (hasPain) {
    const region =
      Object.entries(BODY_REGIONS).find(([key]) => tokens.includes(key))?.[1] ??
      "body";
    return `Patient expresses pain or discomfort in the ${region} area. Further assessment recommended.`;
  }

  // Touching body gesture (hand in lower position)
  if (hasTouching) {
    return "Patient is touching/indicating a body area. This may represent the location of discomfort. Ask for clarification.";
  }

  // Pointing gesture detected
  if (hasPointing) {
    return "Patient is pointing. They may be indicating a location of discomfort. Ask them to point to the affected body area.";
  }

  // Open palm / stop gesture
  if (hasOpenPalm) {
    return "Patient showing open palm. This may indicate 'stop', 'wait', or an attempt to communicate. Engage for clarification.";
  }

  // Hand raised / hand detected (generic)
  if (tokens.some((t) => ["hand_raised", "hand_detected", "communicating", "hand_visible"].includes(t))) {
    return "Patient's hand detected. Ready for communication. Show gestures: Point to indicate body area, make a fist to indicate pain, or use the demo buttons below for specific symptoms.";
  }

  // Fallback
  const symptomTerms = tokens
    .filter((t) => t in GESTURE_SYMPTOMS)
    .map((t) => GESTURE_SYMPTOMS[t]);
  if (symptomTerms.length > 0) {
    return `Patient may be indicating: ${symptomTerms.join(", ")}. Clinical assessment recommended.`;
  }

  return "Patient is communicating via gestures. Interpreted signals suggest medical concern. Please engage for detailed assessment.";
}

/**
 * Normalize hand landmarks to consistent format
 * MediaPipe returns Array<{x, y, z}> for each hand
 */
function normalizeLandmarks(
  hand: Array<{ x: number; y: number; z?: number }> | number[]
): number[][] {
  if (!hand?.length) return [];
  
  const first = hand[0];
  
  // If it's already in {x, y, z} object format
  if (typeof first === "object" && "x" in first) {
    return (hand as Array<{ x: number; y: number; z?: number }>).map((l) => [
      l.x,
      l.y,
      l.z ?? 0,
    ]);
  }
  
  // If it's a flat array of numbers [x, y, z, x, y, z, ...]
  if (typeof first === "number") {
    const flat = hand as number[];
    const out: number[][] = [];
    for (let i = 0; i < 21 && i * 3 + 2 < flat.length; i++) {
      out.push([flat[i * 3], flat[i * 3 + 1], flat[i * 3 + 2] ?? 0]);
    }
    return out;
  }
  
  return [];
}

/**
 * Determine body region based on hand position in the camera frame
 * The camera typically shows upper body, so we map Y position to body parts:
 * - Y < 0.25: Head area (top of frame)
 * - Y 0.25-0.45: Chest area
 * - Y 0.45-0.65: Upper abdomen / stomach
 * - Y 0.65-0.85: Lower abdomen
 * - Y > 0.85: Lower body (may be out of typical frame)
 * 
 * X position can indicate left/right side
 */
function getBodyRegionFromPosition(y: number, x: number): string {
  // Y increases downward in normalized coords (0 = top, 1 = bottom)
  if (y < 0.25) {
    return "point_head";
  } else if (y < 0.45) {
    return "point_chest";
  } else if (y < 0.65) {
    return "point_abdomen";
  } else if (y < 0.85) {
    // Lower abdomen - check left/right
    if (x > 0.6) {
      return "point_lower_left"; // Mirrored camera, so right side of frame = patient's left
    } else if (x < 0.4) {
      return "point_lower_right"; // Left side of frame = patient's right
    }
    return "point_abdomen";
  } else {
    return "point_abdomen"; // Default to abdomen for very low positions
  }
}

/**
 * Analyze hand landmarks to detect gestures
 * MediaPipe Hand Landmarks:
 * 0: wrist
 * 1-4: thumb (CMC, MCP, IP, TIP)
 * 5-8: index finger (MCP, PIP, DIP, TIP)
 * 9-12: middle finger
 * 13-16: ring finger
 * 17-20: pinky
 */
export function inferGestureTokensFromHands(
  handLandmarks: Array<Array<{ x: number; y: number; z?: number }>> | number[][]
): string[] {
  const tokens: string[] = [];
  
  if (!handLandmarks || handLandmarks.length === 0) {
    return tokens;
  }

  // Get first hand
  const firstHand = handLandmarks[0];
  if (!firstHand || firstHand.length === 0) {
    return tokens;
  }

  const points = normalizeLandmarks(firstHand as Array<{ x: number; y: number; z?: number }>);
  
  if (points.length < 21) {
    // Still detected a hand, just not all landmarks
    console.log("Hand detected but incomplete landmarks:", points.length);
    return ["hand_visible"];
  }

  // Key landmarks
  const wrist = points[0];
  const thumbTip = points[4];
  const indexMcp = points[5];
  const indexTip = points[8];
  const middleMcp = points[9];
  const middleTip = points[12];
  const ringMcp = points[13];
  const ringTip = points[16];
  const pinkyMcp = points[17];
  const pinkyTip = points[20];

  // Calculate hand center position (average of all landmarks)
  const handCenterY = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const handCenterX = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  
  // Get wrist position for body region detection
  const wristY = wrist[1];
  const wristX = wrist[0];

  // Check if fingers are extended (tip is above MCP in Y - remember Y increases downward)
  const indexExtended = indexTip[1] < indexMcp[1] - 0.03;
  const middleExtended = middleTip[1] < middleMcp[1] - 0.03;
  const ringExtended = ringTip[1] < ringMcp[1] - 0.03;
  const pinkyExtended = pinkyTip[1] < pinkyMcp[1] - 0.03;
  
  // Check for closed fist: all fingertips at or below MCP level
  const indexCurled = indexTip[1] >= indexMcp[1];
  const middleCurled = middleTip[1] >= middleMcp[1];
  const ringCurled = ringTip[1] >= ringMcp[1];
  const pinkyCurled = pinkyTip[1] >= pinkyMcp[1];

  // Detect pointing: only index extended
  const isPointing = indexExtended && !middleExtended && middleCurled && ringCurled;
  
  // Detect closed fist: all main fingers curled
  const isFist = indexCurled && middleCurled && ringCurled && pinkyCurled;
  
  // Detect open palm: most fingers extended
  const fingersExtended = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;
  const isOpenPalm = fingersExtended >= 3;

  // Determine body region based on WHERE the hand is in the frame
  const bodyRegion = getBodyRegionFromPosition(wristY, wristX);

  // Log for debugging
  console.log("Gesture analysis:", {
    wristPosition: { x: wristX.toFixed(2), y: wristY.toFixed(2) },
    handCenter: { x: handCenterX.toFixed(2), y: handCenterY.toFixed(2) },
    bodyRegion,
    isPointing,
    isFist,
    isOpenPalm,
    fingersExtended,
  });

  // Assign tokens based on detected gestures AND position
  if (isFist) {
    tokens.push("closed_fist", "pain");
    // Add body region based on where the fist is
    tokens.push(bodyRegion);
  } else if (isPointing) {
    tokens.push("pointing");
    // For pointing, use the index fingertip position
    const pointRegion = getBodyRegionFromPosition(indexTip[1], indexTip[0]);
    tokens.push(pointRegion);
  } else if (isOpenPalm) {
    tokens.push("open_palm");
  } else {
    // Hand is in frame but no specific gesture - use position to indicate body area
    // This helps when user is touching/indicating their stomach area
    tokens.push("touching_body");
    tokens.push(bodyRegion);
  }

  // Add specific body part tokens based on position for easier interpretation
  if (wristY > 0.45) {
    // Hand is in lower half of frame - likely indicating stomach/abdomen
    if (!tokens.includes("point_head") && !tokens.includes("point_chest")) {
      tokens.push("abdomen");
      tokens.push("stomach");
    }
  } else if (wristY < 0.3) {
    // Hand is in upper part of frame - likely indicating head
    if (!tokens.includes("point_abdomen")) {
      tokens.push("head");
    }
  }

  // Always return at least one token if we detected a hand
  if (tokens.length === 0) {
    tokens.push("hand_visible");
  }

  // Remove duplicates
  return [...new Set(tokens)];
}
