"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import type { Group, Mesh } from "three";
import * as THREE from "three";
import type { PainRegion, BodyPoseState, AvatarJoints } from "@/lib/types";
import { poseToAvatarJoints, smoothJoints } from "@/lib/poseDetection";

interface Props {
  painRegion: PainRegion;
  isEmergency?: boolean;
  poseState?: BodyPoseState | null;
}

// Convert pose landmarks to avatar joints with smoothing
function useSmoothJoints(poseState: BodyPoseState | null | undefined): AvatarJoints | null {
  const prevJointsRef = useRef<AvatarJoints | null>(null);
  
  return useMemo(() => {
    if (!poseState?.poseLandmarks) {
      // If no pose data but had previous, keep showing last position briefly
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

// Animated limb component (cylinder between two joints)
function AnimatedLimb({
  start,
  end,
  thickness = 0.06,
  color = "#94a3b8",
  emissive = "#000000",
  emissiveIntensity = 0,
}: {
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  thickness?: number;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  const meshRef = useRef<Mesh>(null);
  
  useFrame(() => {
    if (!meshRef.current) return;
    
    // Calculate midpoint
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const midZ = (start.z + end.z) / 2;
    
    // Calculate length
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Position at midpoint
    meshRef.current.position.set(midX, midY, midZ);
    
    // Scale to length
    meshRef.current.scale.set(1, length / 2, 1);
    
    // Rotate to point from start to end
    meshRef.current.lookAt(end.x, end.y, end.z);
    meshRef.current.rotateX(Math.PI / 2);
  });
  
  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[thickness, thickness, 2, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={0.4}
        metalness={0.3}
      />
    </mesh>
  );
}

// Joint sphere
function JointSphere({
  position,
  size = 0.08,
  color = "#64748b",
  emissive = "#000000",
  emissiveIntensity = 0,
}: {
  position: { x: number; y: number; z: number };
  size?: number;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  const meshRef = useRef<Mesh>(null);
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.set(position.x, position.y, position.z);
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={0.3}
        metalness={0.4}
      />
    </mesh>
  );
}

// Animated skeleton body following pose data
function SkeletonBody({
  joints,
  painRegion,
  isEmergency,
  isFallen,
}: {
  joints: AvatarJoints;
  painRegion: PainRegion;
  isEmergency: boolean;
  isFallen: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const [pulseIntensity, setPulseIntensity] = useState(0);
  
  // Pulsing animation for pain/emergency
  useFrame((state) => {
    if (painRegion || isEmergency) {
      const pulse = (Math.sin(state.clock.elapsedTime * 4) + 1) / 2;
      setPulseIntensity(pulse * 0.8);
    } else {
      setPulseIntensity(0);
    }
    
    // Fallen rotation
    if (groupRef.current) {
      const targetRotation = isFallen ? Math.PI / 2 : 0;
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        targetRotation,
        0.1
      );
    }
  });
  
  // Determine colors based on state
  const getColor = (region: string) => {
    if (isEmergency) return "#ef4444";
    if (painRegion === region) return "#f97316";
    return "#94a3b8";
  };
  
  const getEmissive = (region: string) => {
    if (isEmergency) return "#ef4444";
    if (painRegion === region) return "#f97316";
    return "#000000";
  };
  
  const limbThickness = 0.05;
  const jointSize = 0.07;
  
  return (
    <group ref={groupRef}>
      {/* Head */}
      <JointSphere
        position={joints.head}
        size={0.12}
        color={getColor("head")}
        emissive={getEmissive("head")}
        emissiveIntensity={painRegion === "head" ? pulseIntensity : 0}
      />
      
      {/* Neck */}
      <AnimatedLimb
        start={joints.head}
        end={joints.neck}
        thickness={limbThickness * 0.8}
        color="#94a3b8"
      />
      
      {/* Shoulders */}
      <AnimatedLimb
        start={joints.leftShoulder}
        end={joints.rightShoulder}
        thickness={limbThickness}
        color={getColor("chest")}
        emissive={getEmissive("chest")}
        emissiveIntensity={painRegion === "chest" ? pulseIntensity : 0}
      />
      
      {/* Left arm */}
      <JointSphere position={joints.leftShoulder} size={jointSize} />
      <AnimatedLimb
        start={joints.leftShoulder}
        end={joints.leftElbow}
        thickness={limbThickness}
        color="#94a3b8"
      />
      <JointSphere position={joints.leftElbow} size={jointSize} />
      <AnimatedLimb
        start={joints.leftElbow}
        end={joints.leftWrist}
        thickness={limbThickness * 0.8}
        color="#94a3b8"
      />
      <JointSphere position={joints.leftWrist} size={jointSize * 0.9} color="#00d4aa" />
      
      {/* Right arm */}
      <JointSphere position={joints.rightShoulder} size={jointSize} />
      <AnimatedLimb
        start={joints.rightShoulder}
        end={joints.rightElbow}
        thickness={limbThickness}
        color="#94a3b8"
      />
      <JointSphere position={joints.rightElbow} size={jointSize} />
      <AnimatedLimb
        start={joints.rightElbow}
        end={joints.rightWrist}
        thickness={limbThickness * 0.8}
        color="#94a3b8"
      />
      <JointSphere position={joints.rightWrist} size={jointSize * 0.9} color="#00d4aa" />
      
      {/* Spine */}
      <AnimatedLimb
        start={joints.neck}
        end={joints.spine}
        thickness={limbThickness * 1.2}
        color={getColor("chest")}
        emissive={getEmissive("chest")}
        emissiveIntensity={painRegion === "chest" ? pulseIntensity : 0}
      />
      
      {/* Torso to hips */}
      <JointSphere
        position={joints.spine}
        size={jointSize * 1.2}
        color={getColor("abdomen")}
        emissive={getEmissive("abdomen")}
        emissiveIntensity={painRegion === "abdomen" ? pulseIntensity : 0}
      />
      
      {/* Hips */}
      <AnimatedLimb
        start={joints.leftHip}
        end={joints.rightHip}
        thickness={limbThickness}
        color={painRegion?.includes("lower") ? getColor(painRegion) : "#94a3b8"}
        emissive={painRegion?.includes("lower") ? getEmissive(painRegion) : "#000000"}
        emissiveIntensity={painRegion?.includes("lower") ? pulseIntensity : 0}
      />
      
      {/* Left leg */}
      <JointSphere position={joints.leftHip} size={jointSize} />
      <AnimatedLimb
        start={joints.leftHip}
        end={joints.leftKnee}
        thickness={limbThickness}
        color={painRegion === "lower-left" ? getColor("lower-left") : "#94a3b8"}
        emissive={painRegion === "lower-left" ? getEmissive("lower-left") : "#000000"}
        emissiveIntensity={painRegion === "lower-left" ? pulseIntensity : 0}
      />
      <JointSphere position={joints.leftKnee} size={jointSize} />
      <AnimatedLimb
        start={joints.leftKnee}
        end={joints.leftAnkle}
        thickness={limbThickness * 0.9}
        color="#94a3b8"
      />
      <JointSphere position={joints.leftAnkle} size={jointSize * 0.8} />
      
      {/* Right leg */}
      <JointSphere position={joints.rightHip} size={jointSize} />
      <AnimatedLimb
        start={joints.rightHip}
        end={joints.rightKnee}
        thickness={limbThickness}
        color={painRegion === "lower-right" ? getColor("lower-right") : "#94a3b8"}
        emissive={painRegion === "lower-right" ? getEmissive("lower-right") : "#000000"}
        emissiveIntensity={painRegion === "lower-right" ? pulseIntensity : 0}
      />
      <JointSphere position={joints.rightKnee} size={jointSize} />
      <AnimatedLimb
        start={joints.rightKnee}
        end={joints.rightAnkle}
        thickness={limbThickness * 0.9}
        color="#94a3b8"
      />
      <JointSphere position={joints.rightAnkle} size={jointSize * 0.8} />
    </group>
  );
}

// Static humanoid body (when no pose data)
function StaticHumanBody({
  painRegion,
  isEmergency,
}: {
  painRegion: PainRegion;
  isEmergency: boolean;
}) {
  const groupRef = useRef<Group>(null);
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
  
  const getEmissive = (region: string) => {
    if (isEmergency) return "#ef4444";
    if (painRegion === region) return "#f97316";
    return "#000000";
  };
  
  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={0.55}>
      {/* Head */}
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.15, 32, 32]} />
        <meshStandardMaterial
          color={getColor("head")}
          emissive={getEmissive("head")}
          emissiveIntensity={painRegion === "head" ? pulseIntensity : 0}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
      
      {/* Neck */}
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.15, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Torso */}
      <mesh position={[0, 1.0, 0]}>
        <capsuleGeometry args={[0.2, 0.5, 8, 16]} />
        <meshStandardMaterial
          color={getColor("chest")}
          emissive={getEmissive("chest")}
          emissiveIntensity={painRegion === "chest" ? pulseIntensity : 0}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
      
      {/* Abdomen */}
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.18, 0.3, 8, 16]} />
        <meshStandardMaterial
          color={getColor("abdomen")}
          emissive={getEmissive("abdomen")}
          emissiveIntensity={painRegion === "abdomen" ? pulseIntensity : 0}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
      
      {/* Left shoulder */}
      <mesh position={[-0.3, 1.25, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.4} />
      </mesh>
      
      {/* Left upper arm */}
      <mesh position={[-0.35, 1.0, 0]} rotation={[0, 0, 0.2]}>
        <capsuleGeometry args={[0.05, 0.3, 8, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Left forearm */}
      <mesh position={[-0.4, 0.65, 0]} rotation={[0, 0, 0.1]}>
        <capsuleGeometry args={[0.04, 0.25, 8, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Left hand */}
      <mesh position={[-0.42, 0.4, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#00d4aa" roughness={0.3} metalness={0.4} />
      </mesh>
      
      {/* Right shoulder */}
      <mesh position={[0.3, 1.25, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.4} />
      </mesh>
      
      {/* Right upper arm */}
      <mesh position={[0.35, 1.0, 0]} rotation={[0, 0, -0.2]}>
        <capsuleGeometry args={[0.05, 0.3, 8, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Right forearm */}
      <mesh position={[0.4, 0.65, 0]} rotation={[0, 0, -0.1]}>
        <capsuleGeometry args={[0.04, 0.25, 8, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Right hand */}
      <mesh position={[0.42, 0.4, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#00d4aa" roughness={0.3} metalness={0.4} />
      </mesh>
      
      {/* Pelvis */}
      <mesh position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.15, 0.15, 8, 16]} />
        <meshStandardMaterial
          color={painRegion?.includes("lower") ? getColor(painRegion) : "#94a3b8"}
          emissive={painRegion?.includes("lower") ? getEmissive(painRegion) : "#000000"}
          emissiveIntensity={painRegion?.includes("lower") ? pulseIntensity : 0}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
      
      {/* Left hip */}
      <mesh position={[-0.12, 0.2, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color={painRegion === "lower-left" ? getColor("lower-left") : "#64748b"}
          emissive={painRegion === "lower-left" ? getEmissive("lower-left") : "#000000"}
          emissiveIntensity={painRegion === "lower-left" ? pulseIntensity : 0}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
      
      {/* Left thigh */}
      <mesh position={[-0.12, -0.1, 0]}>
        <capsuleGeometry args={[0.06, 0.35, 8, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Left knee */}
      <mesh position={[-0.12, -0.35, 0]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.4} />
      </mesh>
      
      {/* Left shin */}
      <mesh position={[-0.12, -0.6, 0]}>
        <capsuleGeometry args={[0.045, 0.3, 8, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Left foot */}
      <mesh position={[-0.12, -0.85, 0.03]}>
        <boxGeometry args={[0.08, 0.05, 0.15]} />
        <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Right hip */}
      <mesh position={[0.12, 0.2, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color={painRegion === "lower-right" ? getColor("lower-right") : "#64748b"}
          emissive={painRegion === "lower-right" ? getEmissive("lower-right") : "#000000"}
          emissiveIntensity={painRegion === "lower-right" ? pulseIntensity : 0}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
      
      {/* Right thigh */}
      <mesh position={[0.12, -0.1, 0]}>
        <capsuleGeometry args={[0.06, 0.35, 8, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Right knee */}
      <mesh position={[0.12, -0.35, 0]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.4} />
      </mesh>
      
      {/* Right shin */}
      <mesh position={[0.12, -0.6, 0]}>
        <capsuleGeometry args={[0.045, 0.3, 8, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
      
      {/* Right foot */}
      <mesh position={[0.12, -0.85, 0.03]}>
        <boxGeometry args={[0.08, 0.05, 0.15]} />
        <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

// Emergency particles
function EmergencyParticles({ active }: { active: boolean }) {
  const particlesRef = useRef<THREE.Points>(null);
  
  const geometry = useMemo(() => {
    const count = 50;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);
  
  useFrame((state) => {
    if (particlesRef.current && active) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.3;
      particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });
  
  if (!active) return null;
  
  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.03}
        color="#ef4444"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// Glow ring effect
function GlowRing({ painRegion, isEmergency }: { painRegion: PainRegion; isEmergency: boolean }) {
  const ringRef = useRef<Mesh>(null);
  
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.5;
    }
  });
  
  const color = isEmergency ? "#ef4444" : painRegion ? "#f97316" : "#00d4aa";
  
  return (
    <mesh ref={ringRef} position={[0, 0.4, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.8, 0.01, 16, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} />
    </mesh>
  );
}

export default function BodyAvatar3D({ painRegion, isEmergency = false, poseState }: Props) {
  const smoothedJoints = useSmoothJoints(poseState);
  const isFallen = poseState?.bodyState?.isFallen || false;
  const hasPoseData = smoothedJoints !== null;
  
  return (
    <div className="relative h-full w-full min-h-[300px] rounded-2xl overflow-hidden border border-[var(--border-default)] bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)]">
      {/* Status badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        <span className="rounded-lg bg-black/60 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
          3D Body Map
        </span>
        {hasPoseData && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg bg-purple-500/80 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-white"
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
            className="rounded-lg bg-[var(--alert-emergency)]/80 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-white"
          >
            Pain: {painRegion}
          </motion.span>
        )}
      </div>
      
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0.3, 2.5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-5, 3, -5]} intensity={0.3} />
        <spotLight
          position={[0, 3, 2]}
          angle={0.5}
          penumbra={1}
          intensity={isEmergency || painRegion ? 1.5 : 0.8}
          color={isEmergency ? "#ef4444" : painRegion ? "#f97316" : "#ffffff"}
        />
        
        {/* Glow ring */}
        <GlowRing painRegion={painRegion} isEmergency={isEmergency} />
        
        {/* Emergency particles */}
        <EmergencyParticles active={isEmergency || isFallen} />
        
        {/* Avatar body - either skeleton (with pose) or static */}
        {hasPoseData ? (
          <SkeletonBody
            joints={smoothedJoints}
            painRegion={painRegion}
            isEmergency={isEmergency}
            isFallen={isFallen}
          />
        ) : (
          <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.15}>
            <StaticHumanBody painRegion={painRegion} isEmergency={isEmergency} />
          </Float>
        )}
      </Canvas>
      
      {/* Emergency overlay */}
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
