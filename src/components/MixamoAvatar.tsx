"use client";

/**
 * Mixamo-style Avatar Component
 * 
 * A programmatic 3D avatar that uses Mixamo bone naming conventions and
 * directly maps MediaPipe pose landmarks to bone rotations via Kalidokit.
 * 
 * Features:
 * - Programmatic skeleton (no external model dependencies)
 * - Direct Kalidokit integration for pose solving
 * - Pain region highlighting with emissive effects
 * - Emergency visualization
 * - Fall detection display
 * - Smooth joint interpolation
 * 
 * Documentation:
 * - Mixamo: https://www.mixamo.com/
 * - Kalidokit: https://github.com/yeemachine/kalidokit
 * - MediaPipe Pose: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 */

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import * as Kalidokit from "kalidokit";
import type { PainRegion, BodyPoseState } from "@/lib/types";

// Mixamo bone naming convention (standard skeleton)
const MIXAMO_BONES = {
  // Core
  HIPS: "Hips",
  SPINE: "Spine",
  SPINE1: "Spine1",
  SPINE2: "Spine2",
  NECK: "Neck",
  HEAD: "Head",
  // Left Arm
  LEFT_SHOULDER: "LeftShoulder",
  LEFT_ARM: "LeftArm",
  LEFT_FOREARM: "LeftForeArm",
  LEFT_HAND: "LeftHand",
  // Right Arm
  RIGHT_SHOULDER: "RightShoulder",
  RIGHT_ARM: "RightArm",
  RIGHT_FOREARM: "RightForeArm",
  RIGHT_HAND: "RightHand",
  // Left Leg
  LEFT_UP_LEG: "LeftUpLeg",
  LEFT_LEG: "LeftLeg",
  LEFT_FOOT: "LeftFoot",
  // Right Leg
  RIGHT_UP_LEG: "RightUpLeg",
  RIGHT_LEG: "RightLeg",
  RIGHT_FOOT: "RightFoot",
} as const;

// Pain region to body part mapping
const PAIN_REGION_PARTS: Record<string, string[]> = {
  "head": ["head", "neck"],
  "chest": ["chest", "spine"],
  "abdomen": ["abdomen", "hips"],
  "lower-right": ["rightThigh", "rightShin"],
  "lower-left": ["leftThigh", "leftShin"],
};

// Body part dimensions and positions (in meters, Y-up)
const BODY_PARTS = {
  // Core
  hips: { position: [0, 0.95, 0], size: [0.25, 0.12, 0.15], type: "box" },
  spine: { position: [0, 1.1, 0], size: [0.22, 0.15, 0.12], type: "box" },
  chest: { position: [0, 1.3, 0], size: [0.3, 0.2, 0.15], type: "box" },
  neck: { position: [0, 1.5, 0], size: [0.08, 0.08], type: "capsule" },
  head: { position: [0, 1.65, 0], size: [0.12], type: "sphere" },
  // Arms
  leftShoulder: { position: [-0.22, 1.4, 0], size: [0.08, 0.05], type: "capsule" },
  leftUpperArm: { position: [-0.35, 1.25, 0], size: [0.05, 0.15], type: "capsule" },
  leftLowerArm: { position: [-0.35, 1.0, 0], size: [0.04, 0.13], type: "capsule" },
  leftHand: { position: [-0.35, 0.82, 0], size: [0.04, 0.06], type: "box" },
  rightShoulder: { position: [0.22, 1.4, 0], size: [0.08, 0.05], type: "capsule" },
  rightUpperArm: { position: [0.35, 1.25, 0], size: [0.05, 0.15], type: "capsule" },
  rightLowerArm: { position: [0.35, 1.0, 0], size: [0.04, 0.13], type: "capsule" },
  rightHand: { position: [0.35, 0.82, 0], size: [0.04, 0.06], type: "box" },
  // Legs
  leftThigh: { position: [-0.1, 0.7, 0], size: [0.07, 0.2], type: "capsule" },
  leftShin: { position: [-0.1, 0.35, 0], size: [0.05, 0.2], type: "capsule" },
  leftFoot: { position: [-0.1, 0.05, 0.05], size: [0.05, 0.03, 0.12], type: "box" },
  rightThigh: { position: [0.1, 0.7, 0], size: [0.07, 0.2], type: "capsule" },
  rightShin: { position: [0.1, 0.35, 0], size: [0.05, 0.2], type: "capsule" },
  rightFoot: { position: [0.1, 0.05, 0.05], size: [0.05, 0.03, 0.12], type: "box" },
} as const;

interface Props {
  painRegion: PainRegion;
  isEmergency?: boolean;
  poseState?: BodyPoseState | null;
}

interface BodyPartProps {
  name: string;
  position: readonly number[];
  size: readonly number[];
  type: string;
  color: string;
  emissive: string;
  emissiveIntensity: number;
  rotation?: THREE.Euler;
}

/**
 * Calculate bone rotations from MediaPipe landmarks using Kalidokit
 */
function calculatePoseRotations(poseState: BodyPoseState | null) {
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
    const worldLandmarks = poseState.worldLandmarks?.length === 33
      ? poseState.worldLandmarks.map(lm => ({
          x: lm.x,
          y: lm.y,
          z: lm.z || 0,
          visibility: lm.visibility || 1,
        }))
      : normalizedLandmarks;

    // Use Kalidokit to solve pose - CRITICAL: worldLandmarks first
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
 * Convert MediaPipe landmarks to simple joint positions
 */
function landmarksToJoints(poseState: BodyPoseState | null) {
  if (!poseState?.poseLandmarks || poseState.poseLandmarks.length < 33) {
    return null;
  }

  const lm = poseState.poseLandmarks;
  
  // MediaPipe landmark indices
  const NOSE = 0;
  const LEFT_SHOULDER = 11;
  const RIGHT_SHOULDER = 12;
  const LEFT_ELBOW = 13;
  const RIGHT_ELBOW = 14;
  const LEFT_WRIST = 15;
  const RIGHT_WRIST = 16;
  const LEFT_HIP = 23;
  const RIGHT_HIP = 24;
  const LEFT_KNEE = 25;
  const RIGHT_KNEE = 26;
  const LEFT_ANKLE = 27;
  const RIGHT_ANKLE = 28;

  // Convert normalized coords (0-1, Y down) to 3D space (centered, Y up)
  const convert = (l: { x: number; y: number; z: number }) => ({
    x: (l.x - 0.5) * 2,
    y: -(l.y - 0.5) * 2,
    z: -l.z * 2,
  });

  return {
    head: convert(lm[NOSE]),
    leftShoulder: convert(lm[LEFT_SHOULDER]),
    rightShoulder: convert(lm[RIGHT_SHOULDER]),
    leftElbow: convert(lm[LEFT_ELBOW]),
    rightElbow: convert(lm[RIGHT_ELBOW]),
    leftWrist: convert(lm[LEFT_WRIST]),
    rightWrist: convert(lm[RIGHT_WRIST]),
    leftHip: convert(lm[LEFT_HIP]),
    rightHip: convert(lm[RIGHT_HIP]),
    leftKnee: convert(lm[LEFT_KNEE]),
    rightKnee: convert(lm[RIGHT_KNEE]),
    leftAnkle: convert(lm[LEFT_ANKLE]),
    rightAnkle: convert(lm[RIGHT_ANKLE]),
  };
}

/**
 * Single body part mesh
 */
function BodyPart({ name, position, size, type, color, emissive, emissiveIntensity, rotation }: BodyPartProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh
      ref={meshRef}
      position={position as [number, number, number]}
      rotation={rotation}
    >
      {type === "sphere" && (
        <sphereGeometry args={[size[0], 16, 16]} />
      )}
      {type === "capsule" && (
        <capsuleGeometry args={[size[0], size[1], 8, 16]} />
      )}
      {type === "box" && (
        <boxGeometry args={size as [number, number, number]} />
      )}
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={0.6}
        metalness={0.2}
      />
    </mesh>
  );
}

/**
 * Skeleton Avatar with animated joints
 */
function SkeletonAvatar({ painRegion, isEmergency, poseState, isFallen }: {
  painRegion: PainRegion;
  isEmergency: boolean;
  poseState: BodyPoseState | null;
  isFallen: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [pulseIntensity, setPulseIntensity] = useState(0);
  const lastLogRef = useRef<number>(0);
  
  // Store animated positions for body parts
  const animatedPositions = useRef<Record<string, THREE.Vector3>>({});
  const animatedRotations = useRef<Record<string, THREE.Euler>>({});

  // Initialize animated positions
  useEffect(() => {
    Object.entries(BODY_PARTS).forEach(([name, part]) => {
      animatedPositions.current[name] = new THREE.Vector3(...part.position);
      animatedRotations.current[name] = new THREE.Euler(0, 0, 0);
    });
  }, []);

  useFrame((state) => {
    // Pulsing for pain/emergency
    if (painRegion || isEmergency) {
      const pulse = (Math.sin(state.clock.elapsedTime * 4) + 1) / 2;
      setPulseIntensity(pulse * 0.8);
    } else {
      setPulseIntensity(0);
    }

    // Get pose data
    const hasPoseData = poseState?.poseLandmarks && poseState.poseLandmarks.length >= 33;
    const hasWorldData = poseState?.worldLandmarks && poseState.worldLandmarks.length >= 33;
    
    // Debug logging
    const now = Date.now();
    if (now - lastLogRef.current > 3000) {
      lastLogRef.current = now;
      console.log("Mixamo Avatar:", {
        hasPoseData,
        hasWorldData,
        isFallen,
        timestamp: poseState?.timestamp,
      });
    }

    // Apply pose if available
    if (hasPoseData) {
      const joints = landmarksToJoints(poseState);
      const poseRig = calculatePoseRotations(poseState);
      
      if (joints) {
        // Smoothly interpolate positions based on landmarks
        const lerp = 0.15;
        
        // Update head position
        if (animatedPositions.current.head) {
          const targetY = 1.65 + joints.head.y * 0.3;
          const targetX = joints.head.x * 0.2;
          animatedPositions.current.head.x = THREE.MathUtils.lerp(
            animatedPositions.current.head.x,
            targetX,
            lerp
          );
          animatedPositions.current.head.y = THREE.MathUtils.lerp(
            animatedPositions.current.head.y,
            targetY,
            lerp
          );
        }

        // Update arm positions based on landmarks
        if (animatedPositions.current.leftHand) {
          animatedPositions.current.leftHand.x = THREE.MathUtils.lerp(
            animatedPositions.current.leftHand.x,
            -0.35 + joints.leftWrist.x * 0.5,
            lerp
          );
          animatedPositions.current.leftHand.y = THREE.MathUtils.lerp(
            animatedPositions.current.leftHand.y,
            0.82 + joints.leftWrist.y * 0.5,
            lerp
          );
        }

        if (animatedPositions.current.rightHand) {
          animatedPositions.current.rightHand.x = THREE.MathUtils.lerp(
            animatedPositions.current.rightHand.x,
            0.35 + joints.rightWrist.x * 0.5,
            lerp
          );
          animatedPositions.current.rightHand.y = THREE.MathUtils.lerp(
            animatedPositions.current.rightHand.y,
            0.82 + joints.rightWrist.y * 0.5,
            lerp
          );
        }

        // Update elbow positions
        if (animatedPositions.current.leftLowerArm) {
          animatedPositions.current.leftLowerArm.x = THREE.MathUtils.lerp(
            animatedPositions.current.leftLowerArm.x,
            -0.35 + joints.leftElbow.x * 0.4,
            lerp
          );
          animatedPositions.current.leftLowerArm.y = THREE.MathUtils.lerp(
            animatedPositions.current.leftLowerArm.y,
            1.0 + joints.leftElbow.y * 0.3,
            lerp
          );
        }

        if (animatedPositions.current.rightLowerArm) {
          animatedPositions.current.rightLowerArm.x = THREE.MathUtils.lerp(
            animatedPositions.current.rightLowerArm.x,
            0.35 + joints.rightElbow.x * 0.4,
            lerp
          );
          animatedPositions.current.rightLowerArm.y = THREE.MathUtils.lerp(
            animatedPositions.current.rightLowerArm.y,
            1.0 + joints.rightElbow.y * 0.3,
            lerp
          );
        }
      }

      // Apply rotations from Kalidokit
      if (poseRig) {
        const rotLerp = 0.12;

        // Spine rotation
        if (poseRig.Spine && animatedRotations.current.spine) {
          animatedRotations.current.spine.x = THREE.MathUtils.lerp(
            animatedRotations.current.spine.x,
            poseRig.Spine.x * 0.5,
            rotLerp
          );
          animatedRotations.current.spine.z = THREE.MathUtils.lerp(
            animatedRotations.current.spine.z,
            poseRig.Spine.z * 0.5,
            rotLerp
          );
        }

        // Left arm rotation
        if (poseRig.LeftUpperArm && animatedRotations.current.leftUpperArm) {
          animatedRotations.current.leftUpperArm.x = THREE.MathUtils.lerp(
            animatedRotations.current.leftUpperArm.x,
            poseRig.LeftUpperArm.x,
            rotLerp
          );
          animatedRotations.current.leftUpperArm.z = THREE.MathUtils.lerp(
            animatedRotations.current.leftUpperArm.z,
            poseRig.LeftUpperArm.z,
            rotLerp
          );
        }

        // Right arm rotation
        if (poseRig.RightUpperArm && animatedRotations.current.rightUpperArm) {
          animatedRotations.current.rightUpperArm.x = THREE.MathUtils.lerp(
            animatedRotations.current.rightUpperArm.x,
            poseRig.RightUpperArm.x,
            rotLerp
          );
          animatedRotations.current.rightUpperArm.z = THREE.MathUtils.lerp(
            animatedRotations.current.rightUpperArm.z,
            poseRig.RightUpperArm.z,
            rotLerp
          );
        }
      }
    } else {
      // Idle animation when no pose data
      const breathe = Math.sin(state.clock.elapsedTime * 1.5) * 0.005;
      if (animatedPositions.current.chest) {
        animatedPositions.current.chest.y = 1.3 + breathe;
      }
    }

    // Fall rotation for entire group
    if (groupRef.current) {
      const targetRotation = isFallen ? Math.PI / 2 : 0;
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        targetRotation,
        0.08
      );
    }
  });

  // Determine colors based on pain/emergency
  const getColor = (partName: string) => {
    const baseSkinColor = "#c9a08a";
    const baseClothColor = "#4a5568";
    
    // Skin parts
    const skinParts = ["head", "neck", "leftHand", "rightHand", "leftLowerArm", "rightLowerArm"];
    const baseColor = skinParts.includes(partName) ? baseSkinColor : baseClothColor;
    
    if (isEmergency) return "#ef4444";
    
    // Check if this part should be highlighted for pain
    if (painRegion) {
      const painParts = PAIN_REGION_PARTS[painRegion] || [];
      if (painParts.includes(partName)) {
        return "#f97316";
      }
    }
    
    return baseColor;
  };

  const getEmissive = (partName: string) => {
    if (isEmergency) return "#ef4444";
    
    if (painRegion) {
      const painParts = PAIN_REGION_PARTS[painRegion] || [];
      if (painParts.includes(partName)) {
        return "#f97316";
      }
    }
    
    return "#000000";
  };

  const getEmissiveIntensity = (partName: string) => {
    if (isEmergency) return pulseIntensity * 0.6;
    
    if (painRegion) {
      const painParts = PAIN_REGION_PARTS[painRegion] || [];
      if (painParts.includes(partName)) {
        return pulseIntensity * 0.5;
      }
    }
    
    return 0;
  };

  return (
    <group ref={groupRef} position={[0, -0.85, 0]}>
      {Object.entries(BODY_PARTS).map(([name, part]) => {
        const animPos = animatedPositions.current[name];
        const animRot = animatedRotations.current[name];
        const position = animPos 
          ? [animPos.x, animPos.y, animPos.z] 
          : part.position;
        
        return (
          <BodyPart
            key={name}
            name={name}
            position={position}
            size={part.size}
            type={part.type}
            color={getColor(name)}
            emissive={getEmissive(name)}
            emissiveIntensity={getEmissiveIntensity(name)}
            rotation={animRot}
          />
        );
      })}
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
      positions[i * 3] = (Math.random() - 0.5) * 1.5;
      positions[i * 3 + 1] = Math.random() * 2 - 0.3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
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
        color="#ef4444"
        size={0.04}
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  );
}

/**
 * Ground glow ring
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
    <mesh ref={ringRef} position={[0, -0.84, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.8, 0.01, 16, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} />
    </mesh>
  );
}

/**
 * Loading spinner
 */
function LoadingSpinner() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 2;
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[0.3, 0.05, 8, 32]} />
      <meshStandardMaterial color="#00d4aa" wireframe />
    </mesh>
  );
}

/**
 * Main Mixamo Avatar Component
 */
export default function MixamoAvatar({ painRegion, isEmergency = false, poseState }: Props) {
  const isFallen = poseState?.bodyState?.isFallen || false;
  const hasPoseData = poseState?.poseLandmarks && poseState.poseLandmarks.length > 0;
  const hasWorldData = poseState?.worldLandmarks && poseState.worldLandmarks.length > 0;

  return (
    <div className="relative h-full w-full min-h-[300px] rounded-2xl overflow-hidden border border-[var(--border-default)] bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)]">
      {/* Status badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        <span className="rounded-lg bg-black/60 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
          3D Avatar
        </span>
        <span className="rounded-lg bg-blue-600/80 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-white">
          Mixamo Style
        </span>
        {hasPoseData && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg bg-green-500/80 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-white"
          >
            Live Tracking
          </motion.span>
        )}
        {hasWorldData && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg bg-purple-500/80 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-white"
          >
            3D Data
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
        camera={{ position: [0, 0.3, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        {/* Lighting */}
        <ambientLight intensity={0.6} />
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
        
        {/* Environment */}
        <Environment preset="studio" />
        
        {/* Glow ring */}
        <GlowRing painRegion={painRegion} isEmergency={isEmergency} />
        
        {/* Emergency particles */}
        <EmergencyEffect active={isEmergency || isFallen} />
        
        {/* Avatar */}
        <SkeletonAvatar
          painRegion={painRegion}
          isEmergency={isEmergency}
          poseState={poseState || null}
          isFallen={isFallen}
        />
        
        {/* Ground shadow */}
        <ContactShadows
          position={[0, -0.85, 0]}
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
