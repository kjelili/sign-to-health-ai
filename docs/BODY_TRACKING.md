# Body Tracking & 3D Avatar Synchronization

## Overview

The system supports full body pose tracking using MediaPipe Pose Landmarker combined with Kalidokit for accurate 3D avatar bone rotation. This enables:

1. **Real-time 3D avatar synchronization** - The avatar mirrors user movements using bone rotation
2. **Fall/collapse detection** - Automatic emergency alerts when falls are detected
3. **Body position analysis** - Standing, sitting, crouching, fallen states
4. **Hand tracking** - Detailed hand landmark detection for gesture recognition

## Architecture

```
Camera → MediaPipe → [landmarks, worldLandmarks] → Kalidokit → Bone Rotations → 3D Avatar
                  ↓
            [handLandmarks] → Gesture Recognition → Clinical Interpretation
```

## Components

### CameraCapture.tsx

Initializes both trackers with optimized settings:
- **HandLandmarker** - 21 landmarks per hand (detection confidence: 0.35)
- **PoseLandmarker** - 33 body landmarks + 33 world landmarks

```typescript
// Both models are loaded with GPU fallback to CPU
const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: POSE_LANDMARKER_MODEL,
    delegate: "GPU", // Falls back to CPU if unavailable
  },
  numPoses: 1,
  runningMode: "VIDEO",
  minPoseDetectionConfidence: 0.4,  // Optimized for sensitivity
  minPosePresenceConfidence: 0.4,
  minTrackingConfidence: 0.4,
});
```

**Important**: MediaPipe provides TWO types of landmarks:
- `landmarks` - Normalized 2D coordinates (x, y in 0-1 range, z is relative depth)
- `worldLandmarks` - 3D world coordinates (in meters, origin at hip midpoint)

Both are required for accurate 3D pose solving with Kalidokit.

### BodyPoseState Type

```typescript
interface BodyPoseState {
  poseLandmarks: Landmark[] | null;      // 33 normalized landmarks (0-1)
  worldLandmarks: Landmark[] | null;     // 33 world landmarks (3D meters)
  leftHandLandmarks: Landmark[] | null;  // 21 hand landmarks
  rightHandLandmarks: Landmark[] | null;
  bodyState: {
    isStanding: boolean;
    isSitting: boolean;
    isFallen: boolean;
    isCrouching: boolean;
    bodyAngle: number;  // 0 = vertical, 90 = horizontal
    headPosition: { x: number; y: number; z: number } | null;
    torsoCenter: { x: number; y: number; z: number } | null;
  };
  confidence: number;
  timestamp: number;
}
```

## Kalidokit Integration

[Kalidokit](https://github.com/yeemachine/kalidokit) converts MediaPipe landmarks into bone rotation data for 3D avatars.

### Usage

```typescript
import * as Kalidokit from "kalidokit";

// CRITICAL: Pass worldLandmarks first, then normalized landmarks
const poseRig = Kalidokit.Pose.solve(worldLandmarks, normalizedLandmarks, {
  runtime: "mediapipe",
  enableLegs: true,
});

// poseRig contains rotation data for each bone:
// - Hips: { rotation: { x, y, z }, position: { x, y, z } }
// - Spine: { x, y, z }
// - LeftUpperArm: { x, y, z }
// - LeftLowerArm: { x, y, z }
// - RightUpperArm: { x, y, z }
// - RightLowerArm: { x, y, z }
// etc.
```

### Common Issues

1. **Avatar not moving**: Ensure `worldLandmarks` are captured and passed to Kalidokit
2. **Jittery movement**: Apply smoothing with lerp (0.1-0.15 factor)
3. **Wrong bone names**: Map Kalidokit output to your avatar's bone names

### poseDetection.ts

Utility functions for pose analysis:

#### `analyzeBodyState(poseLandmarks)`
Analyzes 33 landmarks to determine body posture:
- **Standing**: Body upright, hips above knees
- **Sitting**: Hips at similar height to knees
- **Crouching**: Hips low but not fallen
- **Fallen**: Body angle > 60° or head very low (Y > 0.85)

#### `poseToAvatarJoints(poseLandmarks, leftHand, rightHand)`
Converts normalized pose coordinates (0-1) to 3D space (-1 to 1):
- X: `(x - 0.5) * 2` (center and scale)
- Y: `-(y - 0.5) * 2` (flip for 3D coordinate system)
- Z: `-z * 2` (depth scaling)

#### `smoothJoints(current, previous, factor)`
Applies linear interpolation for smooth motion:
```typescript
lerp(prev, curr, 0.4)  // 40% toward new position each frame
```

#### `getFallEmergencyTokens(bodyState)`
Returns emergency tokens when falls detected:
- `fallen`, `collapse`, `emergency`
- `prone_position`, `critical` (if face-down)

## BodyAvatar3D.tsx

### Two Rendering Modes

1. **Skeleton Mode** (with pose data):
   - Real-time joint positions from pose landmarks
   - Animated limbs connecting joints
   - Fall animation (body rotates to horizontal)

2. **Static Mode** (no pose data):
   - Pre-positioned humanoid figure
   - Gentle floating animation
   - Pain region highlighting only

### Joint Mapping

| Pose Landmark | Avatar Joint |
|---------------|--------------|
| NOSE (0) | head |
| LEFT_SHOULDER (11) | leftShoulder |
| RIGHT_SHOULDER (12) | rightShoulder |
| LEFT_ELBOW (13) | leftElbow |
| RIGHT_ELBOW (14) | rightElbow |
| LEFT_WRIST (15) | leftWrist |
| RIGHT_WRIST (16) | rightWrist |
| LEFT_HIP (23) | leftHip |
| RIGHT_HIP (24) | rightHip |
| LEFT_KNEE (25) | leftKnee |
| RIGHT_KNEE (26) | rightKnee |
| LEFT_ANKLE (27) | leftAnkle |
| RIGHT_ANKLE (28) | rightAnkle |

Derived joints:
- **neck**: Midpoint between shoulders and nose
- **spine**: Midpoint between shoulder center and hip center

### Visual Feedback

- **Live Tracking badge** - Shows when pose data is available
- **FALL DETECTED badge** - Pulsing red alert
- **Pain region highlighting** - Glowing body parts
- **Emergency particles** - Red floating particles for emergencies

## Fall Detection Algorithm

```typescript
// Body angle from vertical (shoulder to hip line)
const bodyAngle = angleFromVertical(shoulderCenter, hipCenter);

// Detect fallen state
const isFallen = bodyAngle > 60 || nose.y > 0.85;
```

Falls trigger:
1. Emergency tokens added to gesture state
2. 3D avatar rotates to horizontal position
3. Emergency overlay activates
4. Clinical interpretation shows emergency message

## Demo Mode

The "Emergency (Collapse)" demo button simulates a fall:
```typescript
const demoPoseState: BodyPoseState = {
  bodyState: {
    isFallen: true,
    bodyAngle: 85,
    headPosition: { x: 0.5, y: 0.9, z: 0 },
  },
  // ...
};
```

## Performance Considerations

- **Frame rate**: Both models run at ~30fps
- **Smoothing**: Reduces jitter with 40% lerp factor
- **Debouncing**: 100ms minimum between gesture updates
- **Stability frames**: 2 consecutive frames for gesture confirmation

## External References

- [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)
- [MediaPipe Pose Landmark Indices](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker#pose_landmarker_model)
- [Three.js Documentation](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
