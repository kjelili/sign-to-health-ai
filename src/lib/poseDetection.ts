/**
 * Pose Detection Utilities
 * Analyzes MediaPipe Pose Landmarker output to determine body state
 * Reference: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 */

import type { Landmark, BodyPoseState, AvatarJoints } from "./types";

const PL = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/**
 * Calculate distance between two 3D points
 */
function distance3D(a: Landmark, b: Landmark): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2) +
    Math.pow(a.z - b.z, 2)
  );
}

/**
 * Calculate midpoint between two landmarks
 */
function midpoint(a: Landmark, b: Landmark): { x: number; y: number; z: number } {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

/**
 * Calculate angle between two points relative to vertical axis
 * Returns angle in degrees (0 = vertical, 90 = horizontal)
 */
function angleFromVertical(top: Landmark, bottom: Landmark): number {
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  const angleRad = Math.atan2(Math.abs(dx), Math.abs(dy));
  return (angleRad * 180) / Math.PI;
}

/**
 * Analyze body posture from pose landmarks
 */
export function analyzeBodyState(poseLandmarks: Landmark[]): BodyPoseState["bodyState"] {
  if (poseLandmarks.length < 33) {
    return {
      isStanding: false,
      isSitting: false,
      isFallen: false,
      isCrouching: false,
      bodyAngle: 0,
      headPosition: null,
      torsoCenter: null,
    };
  }

  const nose = poseLandmarks[PL.NOSE];
  const leftShoulder = poseLandmarks[PL.LEFT_SHOULDER];
  const rightShoulder = poseLandmarks[PL.RIGHT_SHOULDER];
  const leftHip = poseLandmarks[PL.LEFT_HIP];
  const rightHip = poseLandmarks[PL.RIGHT_HIP];
  const leftKnee = poseLandmarks[PL.LEFT_KNEE];
  const rightKnee = poseLandmarks[PL.RIGHT_KNEE];
  const leftAnkle = poseLandmarks[PL.LEFT_ANKLE];
  const rightAnkle = poseLandmarks[PL.RIGHT_ANKLE];

  // Calculate key positions
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const kneeCenter = midpoint(leftKnee, rightKnee);
  const ankleCenter = midpoint(leftAnkle, rightAnkle);

  // Body angle from vertical (spine angle)
  const bodyAngle = angleFromVertical(shoulderCenter as Landmark, hipCenter as Landmark);

  // Head position relative to frame (normalized 0-1)
  const headPosition = { x: nose.x, y: nose.y, z: nose.z };

  // Torso center
  const torsoCenter = midpoint(shoulderCenter as Landmark, hipCenter as Landmark);

  // Posture detection logic
  // Y coordinates: 0 = top, 1 = bottom in camera frame

  // Check if fallen (body nearly horizontal or head very low)
  const isFallen = bodyAngle > 60 || nose.y > 0.85;

  // Check if crouching (hips lower than normal but not fallen)
  const hipToAnkleRatio = (hipCenter.y - ankleCenter.y);
  const isCrouching = !isFallen && hipCenter.y > 0.6 && hipToAnkleRatio < 0.2;

  // Check if sitting (hips at similar height to knees)
  const hipKneeHeightDiff = Math.abs(hipCenter.y - kneeCenter.y);
  const isSitting = !isFallen && !isCrouching && hipKneeHeightDiff < 0.1;

  // Standing if none of the above
  const isStanding = !isFallen && !isCrouching && !isSitting;

  return {
    isStanding,
    isSitting,
    isFallen,
    isCrouching,
    bodyAngle,
    headPosition,
    torsoCenter,
  };
}

/**
 * Convert normalized pose landmarks to 3D avatar joint positions
 * Input: Normalized coordinates (0-1 range)
 * Output: 3D coordinates scaled for Three.js (-1 to 1 range, Y up)
 */
export function poseToAvatarJoints(
  poseLandmarks: Landmark[] | null,
  leftHandLandmarks: Landmark[] | null,
  rightHandLandmarks: Landmark[] | null
): AvatarJoints | null {
  if (!poseLandmarks || poseLandmarks.length < 33) return null;

  // Convert from normalized (0-1, Y down) to 3D space (-1 to 1, Y up)
  const convert = (l: Landmark): { x: number; y: number; z: number } => ({
    x: (l.x - 0.5) * 2,      // Center and scale X
    y: -(l.y - 0.5) * 2,     // Flip and scale Y (camera Y is down)
    z: -l.z * 2,             // Scale Z (depth)
  });

  const nose = poseLandmarks[PL.NOSE];
  const leftShoulder = poseLandmarks[PL.LEFT_SHOULDER];
  const rightShoulder = poseLandmarks[PL.RIGHT_SHOULDER];
  const leftElbow = poseLandmarks[PL.LEFT_ELBOW];
  const rightElbow = poseLandmarks[PL.RIGHT_ELBOW];
  const leftWrist = poseLandmarks[PL.LEFT_WRIST];
  const rightWrist = poseLandmarks[PL.RIGHT_WRIST];
  const leftHip = poseLandmarks[PL.LEFT_HIP];
  const rightHip = poseLandmarks[PL.RIGHT_HIP];
  const leftKnee = poseLandmarks[PL.LEFT_KNEE];
  const rightKnee = poseLandmarks[PL.RIGHT_KNEE];
  const leftAnkle = poseLandmarks[PL.LEFT_ANKLE];
  const rightAnkle = poseLandmarks[PL.RIGHT_ANKLE];

  // Calculate derived positions
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const neckPos = {
    x: shoulderCenter.x,
    y: (shoulderCenter.y + nose.y) / 2,
    z: shoulderCenter.z,
  };
  const spinePos = midpoint(shoulderCenter as Landmark, hipCenter as Landmark);

  // Use hand landmarks for more accurate wrist if available
  const leftWristFinal = leftHandLandmarks?.[0] || leftWrist;
  const rightWristFinal = rightHandLandmarks?.[0] || rightWrist;

  return {
    head: convert(nose),
    neck: convert(neckPos as Landmark),
    leftShoulder: convert(leftShoulder),
    rightShoulder: convert(rightShoulder),
    leftElbow: convert(leftElbow),
    rightElbow: convert(rightElbow),
    leftWrist: convert(leftWristFinal),
    rightWrist: convert(rightWristFinal),
    spine: convert(spinePos as Landmark),
    leftHip: convert(leftHip),
    rightHip: convert(rightHip),
    leftKnee: convert(leftKnee),
    rightKnee: convert(rightKnee),
    leftAnkle: convert(leftAnkle),
    rightAnkle: convert(rightAnkle),
  };
}

/**
 * Smooth joint positions over time to reduce jitter
 */
export function smoothJoints(
  current: AvatarJoints | null,
  previous: AvatarJoints | null,
  smoothingFactor: number = 0.3
): AvatarJoints | null {
  if (!current) return previous;
  if (!previous) return current;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  
  const smoothPoint = (
    curr: { x: number; y: number; z: number },
    prev: { x: number; y: number; z: number }
  ) => ({
    x: lerp(prev.x, curr.x, smoothingFactor),
    y: lerp(prev.y, curr.y, smoothingFactor),
    z: lerp(prev.z, curr.z, smoothingFactor),
  });

  return {
    head: smoothPoint(current.head, previous.head),
    neck: smoothPoint(current.neck, previous.neck),
    leftShoulder: smoothPoint(current.leftShoulder, previous.leftShoulder),
    rightShoulder: smoothPoint(current.rightShoulder, previous.rightShoulder),
    leftElbow: smoothPoint(current.leftElbow, previous.leftElbow),
    rightElbow: smoothPoint(current.rightElbow, previous.rightElbow),
    leftWrist: smoothPoint(current.leftWrist, previous.leftWrist),
    rightWrist: smoothPoint(current.rightWrist, previous.rightWrist),
    spine: smoothPoint(current.spine, previous.spine),
    leftHip: smoothPoint(current.leftHip, previous.leftHip),
    rightHip: smoothPoint(current.rightHip, previous.rightHip),
    leftKnee: smoothPoint(current.leftKnee, previous.leftKnee),
    rightKnee: smoothPoint(current.rightKnee, previous.rightKnee),
    leftAnkle: smoothPoint(current.leftAnkle, previous.leftAnkle),
    rightAnkle: smoothPoint(current.rightAnkle, previous.rightAnkle),
  };
}

/**
 * Detect if the person is falling (rapid downward movement or extreme angle)
 */
export function detectFall(
  currentState: BodyPoseState["bodyState"],
  previousState: BodyPoseState["bodyState"] | null,
  deltaTimeMs: number
): boolean {
  // Already detected as fallen
  if (currentState.isFallen) return true;

  // No previous state to compare
  if (!previousState || !currentState.headPosition || !previousState.headPosition) {
    return false;
  }

  // Check for rapid downward head movement (falling speed)
  const headDeltaY = currentState.headPosition.y - previousState.headPosition.y;
  const fallSpeed = (headDeltaY / deltaTimeMs) * 1000; // Pixels per second
  
  // If head is moving down quickly (fall speed > threshold)
  if (fallSpeed > 0.5) {
    return true;
  }

  // Check for rapid body angle change
  const angleChange = Math.abs(currentState.bodyAngle - previousState.bodyAngle);
  if (angleChange > 30 && deltaTimeMs < 500) {
    return true;
  }

  return false;
}

/**
 * Get emergency tokens if fall or collapse detected
 */
export function getFallEmergencyTokens(bodyState: BodyPoseState["bodyState"]): string[] {
  const tokens: string[] = [];
  
  if (bodyState.isFallen) {
    tokens.push("fallen", "collapse", "emergency");
    
    // Check if face-down (more dangerous)
    if (bodyState.bodyAngle > 75) {
      tokens.push("prone_position", "critical");
    }
  }
  
  if (bodyState.isCrouching) {
    tokens.push("crouching", "distress");
  }
  
  return tokens;
}
