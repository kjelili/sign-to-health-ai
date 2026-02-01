# Mixamo-style Avatar Integration

Sign-to-Health AI uses a Mixamo-style programmatic 3D avatar for real-time pose visualization with MediaPipe tracking.

## Overview

The Mixamo avatar component provides:
- Programmatic skeleton using Three.js primitives
- Mixamo-standard bone naming conventions
- Real-time MediaPipe pose synchronization via Kalidokit
- Pain region highlighting with emissive effects
- Emergency visualization (red glow, particles)
- Fall detection display (body rotation)
- Smooth joint interpolation

## Why Programmatic Avatar?

Instead of loading external GLTF models, we use a programmatic skeleton because:

1. **No External Dependencies**: Works without network requests or model hosting
2. **Guaranteed Compatibility**: Always works with Kalidokit pose data
3. **Simpler Debugging**: Can visualize exact joint positions
4. **Consistent Performance**: No model loading delays or failures
5. **Easy Customization**: Can modify body proportions in code

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Mixamo Avatar Pipeline                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐         │
│  │  MediaPipe   │   │  Kalidokit   │   │  Skeleton    │         │
│  │  Pose Data   │──▶│  Pose Solver │──▶│  Avatar      │         │
│  └──────────────┘   └──────────────┘   └──────────────┘         │
│         │                                     │                  │
│         ▼                                     ▼                  │
│  ┌──────────────┐              ┌───────────────────────┐        │
│  │ poseLandmarks│              │   Body Part Meshes    │        │
│  │worldLandmarks│              │   + Pain Highlighting │        │
│  └──────────────┘              └───────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### MixamoAvatar.tsx

**Location:** `src/components/MixamoAvatar.tsx`

Main avatar component that:
1. Creates a programmatic skeleton with body part meshes
2. Maps MediaPipe landmarks to body part positions
3. Uses Kalidokit for bone rotation calculations
4. Applies pain region highlighting
5. Handles emergency visualization

### Mixamo Bone Naming Convention

The avatar follows standard Mixamo bone names:

```typescript
const MIXAMO_BONES = {
  // Core
  HIPS: "Hips",
  SPINE: "Spine",
  SPINE1: "Spine1", 
  SPINE2: "Spine2",
  NECK: "Neck",
  HEAD: "Head",
  // Left Arm
  LEFT_ARM: "LeftArm",
  LEFT_FOREARM: "LeftForeArm",
  LEFT_HAND: "LeftHand",
  // Right Arm
  RIGHT_ARM: "RightArm",
  RIGHT_FOREARM: "RightForeArm",
  RIGHT_HAND: "RightHand",
  // Legs
  LEFT_UP_LEG: "LeftUpLeg",
  LEFT_LEG: "LeftLeg",
  LEFT_FOOT: "LeftFoot",
  RIGHT_UP_LEG: "RightUpLeg",
  RIGHT_LEG: "RightLeg",
  RIGHT_FOOT: "RightFoot",
};
```

### Body Part Definitions

Each body part is defined with position, size, and type:

```typescript
const BODY_PARTS = {
  head: { position: [0, 1.65, 0], size: [0.12], type: "sphere" },
  neck: { position: [0, 1.5, 0], size: [0.08, 0.08], type: "capsule" },
  chest: { position: [0, 1.3, 0], size: [0.3, 0.2, 0.15], type: "box" },
  spine: { position: [0, 1.1, 0], size: [0.22, 0.15, 0.12], type: "box" },
  hips: { position: [0, 0.95, 0], size: [0.25, 0.12, 0.15], type: "box" },
  // Arms
  leftUpperArm: { position: [-0.35, 1.25, 0], size: [0.05, 0.15], type: "capsule" },
  leftLowerArm: { position: [-0.35, 1.0, 0], size: [0.04, 0.13], type: "capsule" },
  leftHand: { position: [-0.35, 0.82, 0], size: [0.04, 0.06], type: "box" },
  // ... (similar for right arm and legs)
};
```

## Kalidokit Integration

### Pose Calculation

```typescript
function calculatePoseRotations(poseState: BodyPoseState | null) {
  // Normalized landmarks (0-1 range)
  const normalizedLandmarks = poseState.poseLandmarks;
  
  // World landmarks (3D meters, origin at hip)
  const worldLandmarks = poseState.worldLandmarks;
  
  // CRITICAL: worldLandmarks first, normalizedLandmarks second
  const poseRig = Kalidokit.Pose.solve(worldLandmarks, normalizedLandmarks, {
    runtime: "mediapipe",
    enableLegs: true,
  });
  
  return poseRig;
}
```

### Applying Rotations

```typescript
// In useFrame animation loop
if (poseRig.Spine) {
  animatedRotations.current.spine.x = THREE.MathUtils.lerp(
    animatedRotations.current.spine.x,
    poseRig.Spine.x * 0.5,  // Scale factor
    0.12  // Smoothing factor
  );
}
```

## Pain Region Highlighting

Pain regions map to specific body parts:

```typescript
const PAIN_REGION_PARTS = {
  "head": ["head", "neck"],
  "chest": ["chest", "spine"],
  "abdomen": ["abdomen", "hips"],
  "lower-right": ["rightThigh", "rightShin"],
  "lower-left": ["leftThigh", "leftShin"],
};
```

Highlighted parts receive:
- Orange/red color based on severity
- Emissive glow with pulsing animation
- Higher material intensity

## Visual Feedback

### Status Badges

The avatar displays real-time status:
- **"3D Avatar"** - Always shown
- **"Mixamo Style"** - Avatar type indicator
- **"Live Tracking"** - When pose data is available
- **"3D Data"** - When world landmarks are available
- **"FALL DETECTED"** - When fallen state detected
- **"Pain: {region}"** - When pain region is active

### Emergency Effects

When emergency is triggered:
1. Red emissive glow on all body parts
2. Floating red particles around avatar
3. Pulsing red border around component
4. Body rotates to horizontal (fallen) position

## Data Flow

```
1. CameraCapture detects pose via MediaPipe
   ↓
2. poseLandmarks + worldLandmarks sent to MixamoAvatar
   ↓
3. landmarksToJoints() converts to joint positions
   ↓
4. calculatePoseRotations() uses Kalidokit for bone rotations
   ↓
5. useFrame() applies positions/rotations with smoothing
   ↓
6. Body part meshes update positions
```

## Debug Logging

The avatar logs status every 3 seconds:

```javascript
console.log("Mixamo Avatar:", {
  hasPoseData: true/false,
  hasWorldData: true/false,
  isFallen: true/false,
  timestamp: 1234567890,
});
```

Check browser console to verify data flow.

## Performance Considerations

- **Smoothing Factor (0.12-0.15)**: Prevents jitter
- **Scale Factor (0.5)**: Prevents over-rotation
- **DPR (1-2)**: Balances quality vs performance
- **Primitive Geometries**: Faster than GLTF loading

## Troubleshooting

### Avatar Not Moving

1. Check console for "Mixamo Avatar:" logs
2. Verify `hasPoseData` and `hasWorldData` are true
3. Ensure camera is active and detecting pose

### Jittery Movement

1. Increase smoothing factor (lerp value)
2. Reduce scale factor for rotations
3. Check frame rate is stable

### Pain Highlighting Not Working

1. Verify `painRegion` prop is set
2. Check `PAIN_REGION_PARTS` mapping
3. Ensure body part names match

## Dependencies

```json
{
  "@react-three/fiber": "^9.x",
  "@react-three/drei": "^10.x",
  "three": "^0.172.x",
  "kalidokit": "^1.1.x",
  "framer-motion": "^12.x"
}
```

## Future Enhancements

1. **GLTF Model Support**: Load custom Mixamo characters
2. **Facial Expressions**: Add blend shapes for emotion
3. **Hand Poses**: Detailed finger tracking visualization
4. **Clothing Customization**: Different outfits for context
5. **Accessibility**: High-contrast mode, simplified shapes

## References

- [Mixamo](https://www.mixamo.com/) - 3D character animations
- [Kalidokit](https://github.com/yeemachine/kalidokit) - Pose solving library
- [MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) - Pose detection
- [Three.js](https://threejs.org/) - 3D graphics library
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) - React renderer for Three.js
