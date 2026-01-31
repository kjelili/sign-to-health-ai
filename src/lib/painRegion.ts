import type { GestureState, PainRegion } from "./types";

/**
 * Maps gesture tokens to pain regions for the 3D body avatar.
 * Supports all variations of body region tokens from gesture detection.
 */
export function getPainRegionFromGestures(
  gestureState: GestureState | null
): PainRegion {
  if (!gestureState?.gestureTokens.length) return null;

  const tokens = gestureState.gestureTokens.map((t) => t.toLowerCase());
  
  // Head region
  if (tokens.includes("point_head") || tokens.includes("head") || tokens.includes("point_temple")) {
    return "head";
  }
  
  // Chest region
  if (tokens.includes("point_chest") || tokens.includes("chest")) {
    return "chest";
  }
  
  // Lower right abdomen (appendix area)
  if (tokens.includes("point_lower_right") || tokens.includes("lower_right")) {
    return "lower-right";
  }
  
  // Lower left abdomen
  if (tokens.includes("point_lower_left") || tokens.includes("lower_left")) {
    return "lower-left";
  }
  
  // General abdomen/stomach region
  if (
    tokens.includes("point_abdomen") || 
    tokens.includes("point_stomach") || 
    tokens.includes("abdomen") || 
    tokens.includes("stomach") ||
    tokens.includes("touching_body")
  ) {
    return "abdomen";
  }
  
  return null;
}

/**
 * Get readable label for pain region
 */
export function getPainRegionLabel(region: PainRegion): string {
  switch (region) {
    case "head":
      return "Head";
    case "chest":
      return "Chest";
    case "abdomen":
      return "Abdomen";
    case "lower-right":
      return "Lower Right Abdomen";
    case "lower-left":
      return "Lower Left Abdomen";
    default:
      return "";
  }
}
