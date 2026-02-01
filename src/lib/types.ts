/**
 * MediaPipe Pose Landmark indices (33 total)
 * Reference: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/**
 * Single landmark point with 3D coordinates and visibility
 */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/**
 * Body pose state for 3D avatar synchronization
 * 
 * MediaPipe provides two types of landmarks:
 * - landmarks: Normalized 2D coordinates (x, y in 0-1 range, z is depth)
 * - worldLandmarks: 3D world coordinates (origin at hip midpoint, in meters)
 * 
 * Kalidokit requires BOTH for accurate pose solving:
 * - First param: worldLandmarks (3D world coordinates)
 * - Second param: landmarks (normalized 2D coordinates)
 */
export interface BodyPoseState {
  // Normalized landmarks (33 points, x/y in 0-1 range)
  poseLandmarks: Landmark[] | null;
  // World landmarks (33 points, 3D world coordinates in meters, origin at hip)
  worldLandmarks: Landmark[] | null;
  // Left hand landmarks (21 points)
  leftHandLandmarks: Landmark[] | null;
  // Right hand landmarks (21 points)
  rightHandLandmarks: Landmark[] | null;
  // Derived body state
  bodyState: {
    isStanding: boolean;
    isSitting: boolean;
    isFallen: boolean;
    isCrouching: boolean;
    bodyAngle: number; // Angle from vertical (0 = standing, 90 = horizontal)
    headPosition: { x: number; y: number; z: number } | null;
    torsoCenter: { x: number; y: number; z: number } | null;
  };
  // Confidence
  confidence: number;
  timestamp: number;
}

export interface GestureState {
  handLandmarks: number[][];
  bodyPose?: number[][];
  faceMesh?: number[][];
  gestureTokens: string[];
  confidence: number;
  timestamp: number;
  // New: Full pose state for 3D sync
  poseState?: BodyPoseState;
}

/**
 * Basic emotion state (legacy format)
 */
export interface EmotionState {
  painLevel: number;
  distress: number;
  emotion: string;
  confidence: number;
}

/**
 * Extended emotion state from Hume AI
 * Provides comprehensive emotional analysis for medical context
 */
export interface ExtendedEmotionState extends EmotionState {
  // Additional emotion metrics (0-1 scale)
  anxiety: number;
  confusion: number;
  anger: number;
  
  // Medical category
  category: "pain" | "anxiety" | "confusion" | "anger" | "stress" | "positive" | "neutral";
  categoryLabel: string;
  
  // Top emotions detected
  topEmotions: Array<{ name: string; score: number }>;
  
  // Source of detection
  source: "hume" | "fallback" | "gesture";
  
  // Detailed labels for specific conditions
  angerSpectrum?: string;  // e.g., "Frustrated", "Hostile", "Furious"
  stressSpectrum?: string; // e.g., "Anxious", "Overwhelmed", "Burned out"
}

export type PainRegion = "head" | "chest" | "abdomen" | "lower-right" | "lower-left" | null;

export interface ClinicalOutput {
  summary: string;
  soapNote?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  icd10Codes?: string[];
  triageUrgency: "immediate" | "emergency" | "urgent" | "non-urgent" | "mental-health" | null;
}

/**
 * 3D Avatar joint positions mapped from pose landmarks
 */
export interface AvatarJoints {
  head: { x: number; y: number; z: number };
  neck: { x: number; y: number; z: number };
  leftShoulder: { x: number; y: number; z: number };
  rightShoulder: { x: number; y: number; z: number };
  leftElbow: { x: number; y: number; z: number };
  rightElbow: { x: number; y: number; z: number };
  leftWrist: { x: number; y: number; z: number };
  rightWrist: { x: number; y: number; z: number };
  spine: { x: number; y: number; z: number };
  leftHip: { x: number; y: number; z: number };
  rightHip: { x: number; y: number; z: number };
  leftKnee: { x: number; y: number; z: number };
  rightKnee: { x: number; y: number; z: number };
  leftAnkle: { x: number; y: number; z: number };
  rightAnkle: { x: number; y: number; z: number };
}
