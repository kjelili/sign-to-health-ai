"use client";

/**
 * Ready Player Me Avatar Component
 * 
 * A realistic 3D avatar using Ready Player Me models with MediaPipe pose tracking.
 * 
 * Features:
 * - Loads RPM avatar models (.glb format)
 * - Real-time pose synchronization with MediaPipe landmarks
 * - Pain region highlighting with emissive effects
 * - Emergency visualization
 * - Fall detection display
 * - Smooth joint interpolation
 * 
 * Documentation:
 * - Ready Player Me: https://docs.readyplayer.me/
 * - Kalidokit: https://www.npmjs.com/package/kalidokit
 * - Three.js Skeleton: https://threejs.org/docs/#api/en/objects/Skeleton
 */

import { useRef, useMemo, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Float, Environment, ContactShadows } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import type { Group, SkinnedMesh, Bone } from "three";
import * as Kalidokit from "kalidokit";
import type { PainRegion, BodyPoseState, AvatarJoints } from "@/lib/types";
import { poseToAvatarJoints, smoothJoints } from "@/lib/poseDetection";

// Ready Player Me avatar URLs (half-body models work best for medical context)
const AVATAR_MODELS = {
  // Default neutral avatar - medical professional style
  neutral: "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb",
  // Fallback local model URL
  fallback: "/models/avatar.glb",
  // Half-body model (shows upper body better)
  halfBody: "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit&textureAtlas=1024",
};

// Bone name mapping from Ready Player Me to standard names
const RPM_BONE_MAP: Record<string, string> = {
  "Hips": "hips",
  "Spine": "spine",
  "Spine1": "spine1",
  "Spine2": "spine2",
  "Neck": "neck",
  "Head": "head",
  "LeftShoulder": "leftShoulder",
  "LeftArm": "leftUpperArm",
  "LeftForeArm": "leftLowerArm",
  "LeftHand": "leftHand",
  "RightShoulder": "rightShoulder",
  "RightArm": "rightUpperArm",
  "RightForeArm": "rightLowerArm",
  "RightHand": "rightHand",
  "LeftUpLeg": "leftUpperLeg",
  "LeftLeg": "leftLowerLeg",
  "LeftFoot": "leftFoot",
  "RightUpLeg": "rightUpperLeg",
  "RightLeg": "rightLowerLeg",
  "RightFoot": "rightFoot",
};

// Pain region to bone mapping
const PAIN_REGION_BONES: Record<string, string[]> = {
  "head": ["Head", "Neck"],
  "chest": ["Spine1", "Spine2"],
  "abdomen": ["Spine", "Hips"],
  "lower-right": ["RightUpLeg", "RightLeg"],
  "lower-left": ["LeftUpLeg", "LeftLeg"],
};

interface Props {
  painRegion: PainRegion;
  isEmergency?: boolean;
  poseState?: BodyPoseState | null;
}

interface AvatarProps {
  painRegion: PainRegion;
  isEmergency: boolean;
  poseState: BodyPoseState | null;
  isFallen: boolean;
}

/**
 * Convert pose landmarks to avatar joints with smoothing
 */
function useSmoothJoints(poseState: BodyPoseState | null | undefined): AvatarJoints | null {
  const prevJointsRef = useRef<AvatarJoints | null>(null);
  
  return useMemo(() => {
    if (!poseState?.poseLandmarks) {
      return prevJointsRef.current;
    }
    
    const rawJoints = poseToAvatarJoints(
      poseState.poseLandmarks,
      poseState.leftHandLandmarks,
      poseState.rightHandLandmarks
    );
    
    const smoothed = smoothJoints(rawJoints, prevJointsRef.current, 0.4);
    prevJointsRef.current = smoothed;
    return smoothed;
  }, [poseState]);
}

/**
 * Calculate bone rotation from MediaPipe landmarks using Kalidokit
 * 
 * Kalidokit.Pose.solve() requires:
 * - First param: worldLandmarks (3D world coordinates, origin at hip midpoint)
 * - Second param: landmarks (normalized 2D coordinates, 0-1 range)
 * 
 * This enables accurate rotation calculation for 3D avatar rigging.
 */
function calculatePoseRotations(poseState: BodyPoseState | null) {
  // Need both landmark types for accurate pose solving
  if (!poseState?.poseLandmarks || poseState.poseLandmarks.length < 33) {
    return null;
  }

  try {
    // Normalized landmarks (0-1 range) - used for 2D screen position reference
    const normalizedLandmarks = poseState.poseLandmarks.map(lm => ({
      x: lm.x,
      y: lm.y,
      z: lm.z || 0,
      visibility: lm.visibility || 1,
    }));

    // World landmarks (3D coordinates in meters) - used for rotation calculation
    // If worldLandmarks not available, use normalized landmarks with depth estimation
    const worldLandmarks = poseState.worldLandmarks?.length === 33
      ? poseState.worldLandmarks.map(lm => ({
          x: lm.x,
          y: lm.y,
          z: lm.z || 0,
          visibility: lm.visibility || 1,
        }))
      : normalizedLandmarks; // Fallback to normalized if world not available

    // Use Kalidokit to solve pose - pass worldLandmarks first, then normalized
    const poseRig = Kalidokit.Pose.solve(worldLandmarks, normalizedLandmarks, {
      runtime: "mediapipe",
      enableLegs: true,
    });

    return poseRig;
  } catch (error) {
    console.warn("Kalidokit pose solving error:", error);
    return null;
  }
}

/**
 * Loading spinner for avatar
 */
function LoadingSpinner() {
  return (
    <mesh>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial color="#00d4aa" wireframe />
    </mesh>
  );
}

/**
 * RPM Avatar with bone control
 */
function RPMAvatar({ painRegion, isEmergency, poseState, isFallen }: AvatarProps) {
  const groupRef = useRef<Group>(null);
  const bonesRef = useRef<Map<string, Bone>>(new Map());
  const [modelLoaded, setModelLoaded] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(0);
  
  // Load the GLTF model
  const { scene, nodes } = useGLTF(AVATAR_MODELS.neutral, true);
  
  // Clone the scene to avoid mutations
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    return clone;
  }, [scene]);

  // Extract bones from the model
  useEffect(() => {
    if (!clonedScene) return;

    const bones = new Map<string, Bone>();
    
    clonedScene.traverse((object) => {
      if ((object as Bone).isBone) {
        const bone = object as Bone;
        bones.set(bone.name, bone);
      }
    });

    bonesRef.current = bones;
    setModelLoaded(true);
    
    console.log("RPM Avatar bones loaded:", Array.from(bones.keys()));
  }, [clonedScene]);

  // Apply pain highlighting to materials
  useEffect(() => {
    if (!clonedScene) return;

    clonedScene.traverse((object) => {
      if ((object as SkinnedMesh).isSkinnedMesh) {
        const mesh = object as SkinnedMesh;
        const material = mesh.material as THREE.MeshStandardMaterial;
        
        if (material) {
          // Store original color if not stored
          if (!material.userData.originalColor) {
            material.userData.originalColor = material.color.clone();
            material.userData.originalEmissive = material.emissive?.clone() || new THREE.Color(0x000000);
          }

          // Check if this mesh should be highlighted
          const shouldHighlight = isEmergency || (painRegion && 
            Object.entries(PAIN_REGION_BONES).some(([region, boneNames]) => {
              if (region !== painRegion) return false;
              return boneNames.some(boneName => 
                mesh.skeleton?.bones.some(b => b.name.includes(boneName))
              );
            })
          );

          if (shouldHighlight) {
            material.emissive = new THREE.Color(isEmergency ? "#ef4444" : "#f97316");
            material.emissiveIntensity = pulseIntensity * 0.5;
          } else {
            material.emissive = material.userData.originalEmissive;
            material.emissiveIntensity = 0;
          }
        }
      }
    });
  }, [clonedScene, painRegion, isEmergency, pulseIntensity]);

  // Debug: Track last log time to avoid console spam
  const lastLogRef = useRef<number>(0);
  
  // Animation frame - apply pose and effects
  useFrame((state) => {
    // Pulsing for pain/emergency
    if (painRegion || isEmergency) {
      const pulse = (Math.sin(state.clock.elapsedTime * 4) + 1) / 2;
      setPulseIntensity(pulse * 0.8);
    } else {
      setPulseIntensity(0);
    }

    // Apply pose rotations if available
    const hasPoseData = poseState?.poseLandmarks && poseState.poseLandmarks.length >= 33;
    const hasWorldData = poseState?.worldLandmarks && poseState.worldLandmarks.length >= 33;
    
    // Debug logging (once per second)
    const now = Date.now();
    if (now - lastLogRef.current > 2000) {
      lastLogRef.current = now;
      console.log("RPM Avatar state:", {
        modelLoaded,
        bonesCount: bonesRef.current.size,
        hasPoseData,
        hasWorldData,
        poseTimestamp: poseState?.timestamp,
      });
    }

    if (modelLoaded && hasPoseData && bonesRef.current.size > 0) {
      const poseRig = calculatePoseRotations(poseState);
      
      if (poseRig) {
        // Apply rotations to bones
        const bones = bonesRef.current;

        // Spine
        const spine = bones.get("Spine");
        if (spine && poseRig.Spine) {
          spine.rotation.x = THREE.MathUtils.lerp(
            spine.rotation.x,
            poseRig.Spine.x * 0.5,
            0.1
          );
          spine.rotation.y = THREE.MathUtils.lerp(
            spine.rotation.y,
            poseRig.Spine.y * 0.5,
            0.1
          );
          spine.rotation.z = THREE.MathUtils.lerp(
            spine.rotation.z,
            poseRig.Spine.z * 0.5,
            0.1
          );
        }

        // Left Arm
        const leftUpperArm = bones.get("LeftArm");
        if (leftUpperArm && poseRig.LeftUpperArm) {
          leftUpperArm.rotation.x = THREE.MathUtils.lerp(
            leftUpperArm.rotation.x,
            poseRig.LeftUpperArm.x,
            0.15
          );
          leftUpperArm.rotation.y = THREE.MathUtils.lerp(
            leftUpperArm.rotation.y,
            poseRig.LeftUpperArm.y,
            0.15
          );
          leftUpperArm.rotation.z = THREE.MathUtils.lerp(
            leftUpperArm.rotation.z,
            poseRig.LeftUpperArm.z,
            0.15
          );
        }

        const leftLowerArm = bones.get("LeftForeArm");
        if (leftLowerArm && poseRig.LeftLowerArm) {
          leftLowerArm.rotation.x = THREE.MathUtils.lerp(
            leftLowerArm.rotation.x,
            poseRig.LeftLowerArm.x,
            0.15
          );
          leftLowerArm.rotation.y = THREE.MathUtils.lerp(
            leftLowerArm.rotation.y,
            poseRig.LeftLowerArm.y,
            0.15
          );
          leftLowerArm.rotation.z = THREE.MathUtils.lerp(
            leftLowerArm.rotation.z,
            poseRig.LeftLowerArm.z,
            0.15
          );
        }

        // Right Arm
        const rightUpperArm = bones.get("RightArm");
        if (rightUpperArm && poseRig.RightUpperArm) {
          rightUpperArm.rotation.x = THREE.MathUtils.lerp(
            rightUpperArm.rotation.x,
            poseRig.RightUpperArm.x,
            0.15
          );
          rightUpperArm.rotation.y = THREE.MathUtils.lerp(
            rightUpperArm.rotation.y,
            poseRig.RightUpperArm.y,
            0.15
          );
          rightUpperArm.rotation.z = THREE.MathUtils.lerp(
            rightUpperArm.rotation.z,
            poseRig.RightUpperArm.z,
            0.15
          );
        }

        const rightLowerArm = bones.get("RightForeArm");
        if (rightLowerArm && poseRig.RightLowerArm) {
          rightLowerArm.rotation.x = THREE.MathUtils.lerp(
            rightLowerArm.rotation.x,
            poseRig.RightLowerArm.x,
            0.15
          );
          rightLowerArm.rotation.y = THREE.MathUtils.lerp(
            rightLowerArm.rotation.y,
            poseRig.RightLowerArm.y,
            0.15
          );
          rightLowerArm.rotation.z = THREE.MathUtils.lerp(
            rightLowerArm.rotation.z,
            poseRig.RightLowerArm.z,
            0.15
          );
        }

        // Hips position for fall detection
        const hips = bones.get("Hips");
        if (hips && poseRig.Hips && poseRig.Hips.rotation) {
          if (!isFallen) {
            const hipsRotation = poseRig.Hips.rotation;
            hips.rotation.x = THREE.MathUtils.lerp(
              hips.rotation.x,
              (hipsRotation.x || 0) * 0.3,
              0.1
            );
            hips.rotation.y = THREE.MathUtils.lerp(
              hips.rotation.y,
              (hipsRotation.y || 0) * 0.3,
              0.1
            );
            hips.rotation.z = THREE.MathUtils.lerp(
              hips.rotation.z,
              (hipsRotation.z || 0) * 0.3,
              0.1
            );
          }
        }
      }
    }

    // Fall rotation for the entire group
    if (groupRef.current) {
      const targetRotation = isFallen ? Math.PI / 2 : 0;
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        targetRotation,
        0.08
      );
      
      // Slight breathing animation when not tracking
      if (!poseState?.poseLandmarks) {
        groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.01;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, -1, 0]} scale={0.9}>
      <primitive object={clonedScene} />
    </group>
  );
}

/**
 * Fallback simple avatar when GLTF fails to load
 */
function FallbackAvatar({ painRegion, isEmergency }: { painRegion: PainRegion; isEmergency: boolean }) {
  const [pulseIntensity, setPulseIntensity] = useState(0);
  
  useFrame((state) => {
    if (painRegion || isEmergency) {
      const pulse = (Math.sin(state.clock.elapsedTime * 4) + 1) / 2;
      setPulseIntensity(pulse * 0.6);
    }
  });
  
  const getColor = (region: string) => {
    if (isEmergency) return "#ef4444";
    if (painRegion === region) return "#f97316";
    return "#94a3b8";
  };
  
  return (
    <group position={[0, 0, 0]} scale={0.5}>
      {/* Head */}
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.15, 32, 32]} />
        <meshStandardMaterial
          color={getColor("head")}
          emissive={painRegion === "head" ? "#f97316" : "#000000"}
          emissiveIntensity={painRegion === "head" ? pulseIntensity : 0}
        />
      </mesh>
      
      {/* Body */}
      <mesh position={[0, 1.0, 0]}>
        <capsuleGeometry args={[0.2, 0.6, 8, 16]} />
        <meshStandardMaterial
          color={getColor("chest")}
          emissive={painRegion === "chest" ? "#f97316" : "#000000"}
          emissiveIntensity={painRegion === "chest" ? pulseIntensity : 0}
        />
      </mesh>
      
      {/* Abdomen */}
      <mesh position={[0, 0.5, 0]}>
        <capsuleGeometry args={[0.18, 0.3, 8, 16]} />
        <meshStandardMaterial
          color={getColor("abdomen")}
          emissive={painRegion === "abdomen" ? "#f97316" : "#000000"}
          emissiveIntensity={painRegion === "abdomen" ? pulseIntensity : 0}
        />
      </mesh>
    </group>
  );
}

/**
 * Emergency effect particles
 */
function EmergencyEffect({ active }: { active: boolean }) {
  const particlesRef = useRef<THREE.Points>(null);
  
  const geometry = useMemo(() => {
    const count = 40;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1.8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2 - 0.2; // Centered around avatar
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);
  
  useFrame((state) => {
    if (particlesRef.current && active) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });
  
  if (!active) return null;
  
  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.04}
        color="#ef4444"
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Glow ring around avatar
 */
function GlowRing({ painRegion, isEmergency }: { painRegion: PainRegion; isEmergency: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.3;
    }
  });
  
  const color = isEmergency ? "#ef4444" : painRegion ? "#f97316" : "#00d4aa";
  
  return (
    <mesh ref={ringRef} position={[0, -0.9, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1, 0.01, 16, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </mesh>
  );
}

/**
 * Main Ready Player Me Avatar Component
 */
export default function ReadyPlayerMeAvatar({ painRegion, isEmergency = false, poseState }: Props) {
  const isFallen = poseState?.bodyState?.isFallen || false;
  const hasPoseData = poseState?.poseLandmarks && poseState.poseLandmarks.length > 0;
  const [loadError, setLoadError] = useState(false);

  return (
    <div className="relative h-full w-full min-h-[300px] rounded-2xl overflow-hidden border border-[var(--border-default)] bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)]">
      {/* Status badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        <span className="rounded-lg bg-black/60 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
          3D Avatar
        </span>
        {!loadError && (
          <span className="rounded-lg bg-purple-600/80 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-white">
            Ready Player Me
          </span>
        )}
        {hasPoseData && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg bg-green-500/80 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-white"
          >
            Live Tracking
          </motion.span>
        )}
        {isFallen && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg bg-[var(--alert-emergency)] px-2.5 py-1.5 text-xs font-bold text-white animate-pulse"
          >
            FALL DETECTED
          </motion.span>
        )}
        {painRegion && !isFallen && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg bg-orange-500/80 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-white"
          >
            Pain: {painRegion}
          </motion.span>
        )}
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0.2, 4], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        onError={() => setLoadError(true)}
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
        <directionalLight position={[-3, 3, -3]} intensity={0.3} />
        <spotLight
          position={[0, 4, 2]}
          angle={0.4}
          penumbra={1}
          intensity={isEmergency || painRegion ? 1.2 : 0.6}
          color={isEmergency ? "#ef4444" : painRegion ? "#f97316" : "#ffffff"}
          castShadow
        />
        
        {/* Environment for realistic reflections */}
        <Environment preset="studio" />
        
        {/* Glow ring */}
        <GlowRing painRegion={painRegion} isEmergency={isEmergency} />
        
        {/* Emergency particles */}
        <EmergencyEffect active={isEmergency || isFallen} />
        
        {/* Avatar with suspense fallback */}
        <Suspense fallback={<LoadingSpinner />}>
          {!loadError ? (
            <RPMAvatar
              painRegion={painRegion}
              isEmergency={isEmergency}
              poseState={poseState || null}
              isFallen={isFallen}
            />
          ) : (
            <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.15}>
              <FallbackAvatar painRegion={painRegion} isEmergency={isEmergency} />
            </Float>
          )}
        </Suspense>
        
        {/* Ground shadow */}
        <ContactShadows
          position={[0, -1, 0]}
          opacity={0.4}
          scale={3}
          blur={2}
          far={2}
        />
      </Canvas>

      {/* Emergency border overlay */}
      <AnimatePresence>
        {(isEmergency || isFallen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none border-4 border-[var(--alert-emergency)] rounded-2xl animate-pulse"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Preload the avatar model
useGLTF.preload(AVATAR_MODELS.neutral);
