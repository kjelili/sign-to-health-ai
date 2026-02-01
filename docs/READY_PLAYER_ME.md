# Ready Player Me Avatar Integration

Sign-to-Health AI uses Ready Player Me for realistic 3D avatar visualization with real-time pose tracking.

## Overview

The Ready Player Me avatar component provides:
- Realistic human avatar models
- Real-time MediaPipe pose synchronization
- Pain region highlighting with emissive effects
- Emergency visualization
- Fall detection display
- Smooth joint interpolation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Ready Player Me Avatar Pipeline                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐         │
│  │  MediaPipe   │   │  Kalidokit   │   │  Ready Player│         │
│  │    Pose      │──▶│  Pose Solver │──▶│   Me Avatar  │         │
│  └──────────────┘   └──────────────┘   └──────────────┘         │
│         │                                     │                  │
│         │                                     ▼                  │
│         │              ┌───────────────────────────────┐        │
│         └─────────────▶│      Pain & Emergency         │        │
│                        │       Highlighting            │        │
│                        └───────────────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### ReadyPlayerMeAvatar.tsx

**Location:** `src/components/ReadyPlayerMeAvatar.tsx`

Main avatar component that:
1. Loads RPM avatar models via useGLTF
2. Maps MediaPipe landmarks to avatar bones using Kalidokit
3. Applies pain region highlighting
4. Handles emergency visualization
5. Shows fall detection status

### Key Features

#### 1. Avatar Loading

```typescript
const AVATAR_MODELS = {
  neutral: "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb",
  halfBody: "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit",
};

const { scene, nodes } = useGLTF(AVATAR_MODELS.neutral, true);
```

#### 2. Pose Tracking with Kalidokit

Kalidokit converts MediaPipe landmarks to bone rotations. **Critical**: It requires two different landmark arrays:

```typescript
import * as Kalidokit from "kalidokit";

// MediaPipe provides two landmark types:
// - poseLandmarks: Normalized 2D coordinates (0-1 range)
// - worldLandmarks: 3D world coordinates (in meters, origin at hip)

// CORRECT: Pass worldLandmarks first, then normalizedLandmarks
const poseRig = Kalidokit.Pose.solve(worldLandmarks, normalizedLandmarks, {
  runtime: "mediapipe",
  enableLegs: true,
});

// Apply rotations with smoothing
const spine = bones.get("Spine");
if (spine && poseRig.Spine) {
  spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, poseRig.Spine.x * 0.5, 0.1);
  spine.rotation.y = THREE.MathUtils.lerp(spine.rotation.y, poseRig.Spine.y * 0.5, 0.1);
  spine.rotation.z = THREE.MathUtils.lerp(spine.rotation.z, poseRig.Spine.z * 0.5, 0.1);
}
```

**Common mistake**: Passing the same landmarks array twice will result in no movement!

#### 3. Bone Mapping

Ready Player Me uses standard bone names:

| RPM Bone | Body Part |
|----------|-----------|
| Hips | Pelvis center |
| Spine, Spine1, Spine2 | Torso |
| Neck, Head | Upper body |
| LeftArm, LeftForeArm, LeftHand | Left arm |
| RightArm, RightForeArm, RightHand | Right arm |
| LeftUpLeg, LeftLeg, LeftFoot | Left leg |
| RightUpLeg, RightLeg, RightFoot | Right leg |

#### 4. Pain Region Highlighting

```typescript
const PAIN_REGION_BONES = {
  "head": ["Head", "Neck"],
  "chest": ["Spine1", "Spine2"],
  "abdomen": ["Spine", "Hips"],
  "lower-right": ["RightUpLeg", "RightLeg"],
  "lower-left": ["LeftUpLeg", "LeftLeg"],
};
```

## Dependencies

```json
{
  "@react-three/fiber": "^8.x",
  "@react-three/drei": "^10.x",
  "three": "^0.170.x",
  "kalidokit": "^1.x"
}
```

## Usage

```tsx
import ReadyPlayerMeAvatar from "@/components/ReadyPlayerMeAvatar";

<ReadyPlayerMeAvatar
  painRegion="chest"        // Pain highlighting
  isEmergency={false}       // Emergency mode
  poseState={poseState}     // MediaPipe pose data
/>
```

## Customization

### Using Different Avatars

To use a different Ready Player Me avatar:

1. Create an avatar at https://readyplayer.me
2. Get the GLB URL (e.g., `https://models.readyplayer.me/YOUR_AVATAR_ID.glb`)
3. Update `AVATAR_MODELS.neutral` in the component

### Adding Custom Models

```typescript
const AVATAR_MODELS = {
  neutral: "https://models.readyplayer.me/YOUR_AVATAR_ID.glb",
  custom: "/models/custom-avatar.glb",
};
```

## Fallback Behavior

If the Ready Player Me model fails to load:

1. `loadError` state is set to true
2. A simple fallback avatar renders (basic shapes)
3. All pain highlighting still works

## Performance Considerations

### Optimization Tips

1. **Preload models:**
   ```typescript
   useGLTF.preload(AVATAR_MODELS.neutral);
   ```

2. **Use half-body models** for better performance when full body isn't needed

3. **Adjust DPR (device pixel ratio):**
   ```tsx
   <Canvas dpr={[1, 2]} />
   ```

### Model Size

- Full-body RPM model: ~2-5MB
- Half-body with atlas: ~1-2MB
- Use `textureAtlas=1024` query param for smaller textures

## Troubleshooting

### Avatar Not Loading

1. Check network connectivity
2. Verify the avatar URL is valid
3. Check browser console for CORS errors
4. Try the fallback local model

### Pose Not Syncing

1. Ensure MediaPipe is detecting pose
2. Check `poseState` is being passed correctly
3. Verify Kalidokit is installed

### Performance Issues

1. Reduce DPR to [1, 1]
2. Use half-body model
3. Reduce pose update frequency
4. Disable shadows in Canvas

## API Reference

### Props

| Prop | Type | Description |
|------|------|-------------|
| `painRegion` | `PainRegion` | Body region to highlight |
| `isEmergency` | `boolean` | Enable emergency visualization |
| `poseState` | `BodyPoseState \| null` | MediaPipe pose data |

### Pain Regions

- `"head"` - Head and neck
- `"chest"` - Upper torso
- `"abdomen"` - Stomach area
- `"lower-right"` - Right leg/hip
- `"lower-left"` - Left leg/hip

## External Resources

- [Ready Player Me Documentation](https://docs.readyplayer.me/)
- [Kalidokit NPM](https://www.npmjs.com/package/kalidokit)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [MediaPipe Pose](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker)

## Future Enhancements

- [ ] Facial expression mirroring
- [ ] Hand gesture visualization
- [ ] Custom medical avatars
- [ ] Avatar customization UI
- [ ] VRM format support
