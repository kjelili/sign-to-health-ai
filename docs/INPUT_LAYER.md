# Input Layer — Documentation

## Overview

The Input Layer captures sign language, gestures, and facial expressions via camera using MediaPipe Hand Landmarker. This document covers configuration, reliability best practices, and gesture detection logic.

## Components

- **CameraCapture** (`src/components/CameraCapture.tsx`)
  - Requests camera access via `navigator.mediaDevices.getUserMedia`
  - Initializes MediaPipe HandLandmarker with optimized configuration
  - Implements gesture smoothing and debouncing for stable detection
  - Provides demo/simulation mode when camera or MediaPipe is unavailable
  - Displays real-time FPS and confidence metrics

## Camera Configuration

Reference: [MDN Media Capture Constraints](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints)

```typescript
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280, min: 640 },      // Higher resolution for better detection
    height: { ideal: 720, min: 480 },      // 16:9 aspect captures more body
    frameRate: { ideal: 30, min: 15 },     // 30fps for smooth tracking
    facingMode: "user",
    aspectRatio: { ideal: 16 / 9 },        // Wide view for full body
  },
  audio: false,
};
```

### Why These Settings?

| Setting | Value | Rationale |
|---------|-------|-----------|
| Width | 1280px | Higher resolution improves landmark detection accuracy |
| Height | 720px | 16:9 aspect ratio captures more of the body |
| Frame Rate | 30fps | Smooth tracking; MediaPipe processes each frame in VIDEO mode |
| Facing Mode | user | Front camera for self-facing gestures |
| Aspect Ratio | 16:9 | Wider field of view for full body tracking |

## MediaPipe Configuration

Reference: [MediaPipe Hand Landmarker Web Guide](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)

```typescript
const MEDIAPIPE_CONFIG = {
  hand: {
    minHandDetectionConfidence: 0.35,   // Lower for better sensitivity
    minHandPresenceConfidence: 0.35,    // Re-detection trigger threshold
    minTrackingConfidence: 0.35,        // Hand tracking IoU threshold
    numHands: 2,
  },
  pose: {
    minPoseDetectionConfidence: 0.4,    // Body detection threshold
    minPosePresenceConfidence: 0.4,     // Re-detection trigger
    minTrackingConfidence: 0.4,         // Pose tracking threshold
    numPoses: 1,
  },
};
```

### Confidence Thresholds

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minHandDetectionConfidence` | 0.35 | Lower threshold for better detection sensitivity |
| `minHandPresenceConfidence` | 0.35 | Maintains tracking even with partial occlusion |
| `minTrackingConfidence` | 0.35 | IoU threshold between frames for continuous tracking |
| `minPoseDetectionConfidence` | 0.4 | Body detection threshold |

**Note:** Thresholds lowered from 0.5 to improve detection in various lighting conditions. May increase false positives in very noisy environments.

### Delegate Selection

The system attempts GPU first, then falls back to CPU:

```typescript
for (const delegate of ["GPU", "CPU"]) {
  // Try initialization...
}
```

GPU provides better performance but may not be available on all devices.

## Gesture Smoothing

To prevent flickering and jittery output, the system implements:

### Debouncing
```typescript
const SMOOTHING_CONFIG = {
  debounceMs: 150,     // Minimum time between updates
  stableFrames: 3,     // Frames gesture must be stable
};
```

### Stability Check
A gesture is only reported if:
1. The same tokens are detected for `stableFrames` consecutive frames
2. At least `debounceMs` has passed since the last update

This prevents rapid state changes from transient hand positions.

## Gesture Token Inference

`inferGestureTokensFromHands()` in `src/lib/medicalReasoning.ts` analyzes hand landmarks to produce tokens.

### Body Region Detection (Position-Based)

The hand's position in the camera frame determines the body region:

| Hand Y Position | Body Region | Token |
|-----------------|-------------|-------|
| Y < 0.25 (top) | Head | `point_head` |
| Y 0.25 - 0.45 | Chest | `point_chest` |
| Y 0.45 - 0.65 | Upper Abdomen | `point_abdomen` |
| Y 0.65 - 0.85 | Lower Abdomen | `point_lower_right` / `point_lower_left` |
| Y > 0.85 | Lower Body | `point_abdomen` |

X position determines left/right side (accounting for mirrored camera).

### Gesture Types

| Gesture | Detection Logic | Tokens |
|---------|-----------------|--------|
| Closed Fist | All fingertips below MCP joints | `closed_fist`, `pain` |
| Pointing | Index extended, others curled | `pointing`, `point_*` |
| Open Palm | 3+ fingers extended | `open_palm` |
| Hand Raised | Some fingers extended, no specific gesture | `hand_raised` |
| Hand Visible | Hand detected, no clear gesture | `hand_visible` |

### Landmark Reference

MediaPipe Hand Landmarker provides 21 3D landmarks per hand:

```
0: Wrist
1-4: Thumb (CMC, MCP, IP, TIP)
5-8: Index finger (MCP, PIP, DIP, TIP)
9-12: Middle finger
13-16: Ring finger
17-20: Pinky
```

## Demo Mode

When camera access fails, demo buttons allow testing with preset gestures:

- **Chest pain** → `["point_chest", "pain"]`
- **Abdominal pain** → `["point_abdomen", "pain"]`
- **Headache** → `["point_head", "pain"]`
- **Breathing difficulty** → `["breathing"]`
- **Lower Right Pain** → `["point_lower_right", "pain"]`
- **Emergency (Stroke)** → `["stroke", "emergency", "point_head"]`

## Performance Metrics

The component displays:
- **FPS**: Frames processed per second (target: 30)
- **Confidence**: Hand detection confidence (0-100%)
- **Detection Status**: Scanning / Detecting / Hand detected

## Reliability Best Practices

### For Users
1. Ensure adequate lighting (avoid backlighting)
2. Position camera at chest level
3. Keep hands within frame
4. Use solid background when possible
5. Slow, deliberate gestures work better than fast movements

### For Developers
1. Always check `navigator.mediaDevices.getSupportedConstraints()` before applying constraints
2. Handle `OverconstrainedError` gracefully with fallback constraints
3. Monitor FPS and adjust processing if below target
4. Log detection results for debugging
5. Provide clear visual feedback for detection states

## External Documentation

- [MediaPipe Hand Landmarker Overview](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/index)
- [MediaPipe Hand Landmarker Web/JS Guide](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [MDN getUserMedia Constraints](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints)
- [MDN frameRate Constraint](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/frameRate)
