"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Video, VideoOff, Loader2, Camera, Activity, User } from "lucide-react";
import { inferGestureTokensFromHands, inferClinicalInterpretation } from "@/lib/medicalReasoning";
import { analyzeBodyState, getFallEmergencyTokens } from "@/lib/poseDetection";
import type { GestureState, BodyPoseState, Landmark } from "@/lib/types";

// MediaPipe model URLs
const HAND_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
const POSE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

// Camera constraints optimized for body tracking
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 640, min: 480 },
    height: { ideal: 480, min: 360 },
    frameRate: { ideal: 30, min: 15 },
    facingMode: "user",
  },
  audio: false,
};

// MediaPipe configuration
const MEDIAPIPE_CONFIG = {
  hand: {
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    numHands: 2,
  },
  pose: {
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    numPoses: 1,
  },
};

// Gesture smoothing
const SMOOTHING_CONFIG = {
  debounceMs: 100,
  stableFrames: 2,
};

const DEMO_GESTURES = [
  { id: "point_chest", label: "Chest pain", tokens: ["point_chest", "pain"] },
  { id: "point_abdomen", label: "Abdominal pain", tokens: ["point_abdomen", "pain"] },
  { id: "point_head", label: "Headache", tokens: ["point_head", "pain"] },
  { id: "point_lower_right", label: "Lower Right Pain", tokens: ["point_lower_right", "pain"] },
  { id: "emergency", label: "Emergency (Collapse)", tokens: ["fallen", "collapse", "emergency"] },
] as const;

interface Props {
  onGestureUpdate: (state: GestureState | null) => void;
  onInterpretation: (text: string | null) => void;
  onPoseUpdate?: (pose: BodyPoseState | null) => void;
}

export default function CameraCapture({ onGestureUpdate, onInterpretation, onPoseUpdate }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [videoReady, setVideoReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [useDemoMode, setUseDemoMode] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [poseDetected, setPoseDetected] = useState(false);
  const [mediaPipeReady, setMediaPipeReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  
  const handLandmarkerRef = useRef<unknown>(null);
  const poseLandmarkerRef = useRef<unknown>(null);
  const rafRef = useRef<number>(0);
  const isRunningRef = useRef(false);
  
  // Smoothing state
  const lastGestureRef = useRef<string[]>([]);
  const gestureStableCountRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);
  const frameTimesRef = useRef<number[]>([]);
  const lastPoseStateRef = useRef<BodyPoseState["bodyState"] | null>(null);

  // Initialize MediaPipe on mount
  useEffect(() => {
    let cancelled = false;
    
    const initMediaPipe = async () => {
      if (typeof window === "undefined") return;
      
      setDebugInfo("Loading MediaPipe...");
      
      for (const delegate of ["GPU", "CPU"] as const) {
        if (cancelled) return;
        
        try {
          const { FilesetResolver, HandLandmarker, PoseLandmarker } = await import(
            "@mediapipe/tasks-vision"
          );
          
          setDebugInfo(`Initializing ${delegate}...`);
          
          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
          );
          
          if (cancelled) return;
          
          // Initialize Hand Landmarker
          const handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: HAND_LANDMARKER_MODEL,
              delegate: delegate,
            },
            numHands: MEDIAPIPE_CONFIG.hand.numHands,
            runningMode: "VIDEO",
            minHandDetectionConfidence: MEDIAPIPE_CONFIG.hand.minHandDetectionConfidence,
            minHandPresenceConfidence: MEDIAPIPE_CONFIG.hand.minHandPresenceConfidence,
            minTrackingConfidence: MEDIAPIPE_CONFIG.hand.minTrackingConfidence,
          });
          
          if (cancelled) return;
          
          // Initialize Pose Landmarker
          const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: POSE_LANDMARKER_MODEL,
              delegate: delegate,
            },
            numPoses: MEDIAPIPE_CONFIG.pose.numPoses,
            runningMode: "VIDEO",
            minPoseDetectionConfidence: MEDIAPIPE_CONFIG.pose.minPoseDetectionConfidence,
            minPosePresenceConfidence: MEDIAPIPE_CONFIG.pose.minPosePresenceConfidence,
            minTrackingConfidence: MEDIAPIPE_CONFIG.pose.minTrackingConfidence,
          });
          
          if (cancelled) return;
          
          handLandmarkerRef.current = handLandmarker;
          poseLandmarkerRef.current = poseLandmarker;
          setMediaPipeReady(true);
          setDebugInfo(`Ready (${delegate})`);
          console.log("MediaPipe initialized with", delegate);
          return;
        } catch (err) {
          console.warn("MediaPipe init failed with", delegate, err);
          setDebugInfo(`${delegate} failed...`);
        }
      }
      
      if (!cancelled) {
        setDebugInfo("MediaPipe failed");
      }
    };
    
    initMediaPipe();
    
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVideoCanPlay = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      console.log("Video ready:", video.videoWidth, "x", video.videoHeight);
    }
    setVideoReady(true);
  }, []);

  const hasGestureChanged = useCallback((newTokens: string[], oldTokens: string[]): boolean => {
    if (newTokens.length !== oldTokens.length) return true;
    const sortedNew = [...newTokens].sort();
    const sortedOld = [...oldTokens].sort();
    return sortedNew.some((t, i) => t !== sortedOld[i]);
  }, []);

  // Detection loop
  useEffect(() => {
    if (cameraState !== "active" || !videoReady || useDemoMode) {
      isRunningRef.current = false;
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let frameCount = 0;
    isRunningRef.current = true;

    const detect = () => {
      if (!isRunningRef.current) return;

      const handDetector = handLandmarkerRef.current as {
        detectForVideo?: (v: HTMLVideoElement, t: number) => { 
          landmarks: Array<Array<{ x: number; y: number; z?: number }>>;
          handedness?: Array<{ categoryName: string; score: number }[]>;
        };
      } | null;

      const poseDetector = poseLandmarkerRef.current as {
        detectForVideo?: (v: HTMLVideoElement, t: number) => { 
          landmarks: Array<Array<{ x: number; y: number; z?: number; visibility?: number }>>;
          worldLandmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number }>>;
        };
      } | null;

      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        frameCount++;
        
        // Calculate FPS
        const now = performance.now();
        frameTimesRef.current.push(now);
        if (frameTimesRef.current.length > 30) {
          frameTimesRef.current.shift();
        }
        if (frameTimesRef.current.length > 1) {
          const elapsed = now - frameTimesRef.current[0];
          const currentFps = Math.round((frameTimesRef.current.length - 1) / (elapsed / 1000));
          setFps(currentFps);
        }
        
        try {
          const timestamp = performance.now();
          
          // Detect hands
          let handLandmarks: Array<Array<{ x: number; y: number; z?: number }>> = [];
          let handConfidence = 0;
          if (handDetector?.detectForVideo) {
            const handResult = handDetector.detectForVideo(video, timestamp);
            handLandmarks = handResult?.landmarks ?? [];
            if (handResult?.handedness?.[0]?.[0]?.score) {
              handConfidence = handResult.handedness[0][0].score;
            }
          }
          
          // Detect pose
          let poseLandmarks: Landmark[] | null = null;
          if (poseDetector?.detectForVideo) {
            const poseResult = poseDetector.detectForVideo(video, timestamp + 1);
            if (poseResult?.landmarks?.[0]) {
              poseLandmarks = poseResult.landmarks[0].map(l => ({
                x: l.x,
                y: l.y,
                z: l.z ?? 0,
                visibility: l.visibility,
              }));
            }
          }
          
          // Update detection status
          setHandDetected(handLandmarks.length > 0);
          setPoseDetected(poseLandmarks !== null);
          
          // Analyze body state
          let bodyState: BodyPoseState["bodyState"] | null = null;
          if (poseLandmarks) {
            bodyState = analyzeBodyState(poseLandmarks);
          }
          
          // Create pose state for 3D avatar
          if (poseLandmarks || handLandmarks.length > 0) {
            const poseState: BodyPoseState = {
              poseLandmarks,
              leftHandLandmarks: handLandmarks[0]?.map(l => ({ x: l.x, y: l.y, z: l.z ?? 0 })) || null,
              rightHandLandmarks: handLandmarks[1]?.map(l => ({ x: l.x, y: l.y, z: l.z ?? 0 })) || null,
              bodyState: bodyState || {
                isStanding: true,
                isSitting: false,
                isFallen: false,
                isCrouching: false,
                bodyAngle: 0,
                headPosition: null,
                torsoCenter: null,
              },
              confidence: Math.max(handConfidence, poseLandmarks ? 0.9 : 0),
              timestamp: Date.now(),
            };
            
            onPoseUpdate?.(poseState);
            lastPoseStateRef.current = bodyState;
          } else {
            onPoseUpdate?.(null);
          }
          
          // Generate gesture tokens
          let tokens: string[] = [];
          if (handLandmarks.length > 0) {
            tokens = inferGestureTokensFromHands(handLandmarks);
          }
          
          // Add fall/collapse tokens
          if (bodyState) {
            const fallTokens = getFallEmergencyTokens(bodyState);
            tokens = [...tokens, ...fallTokens];
          }
          
          // Apply smoothing
          if (tokens.length > 0 || handLandmarks.length > 0 || poseLandmarks) {
            const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
            
            if (hasGestureChanged(tokens, lastGestureRef.current)) {
              gestureStableCountRef.current = 1;
              lastGestureRef.current = tokens;
            } else {
              gestureStableCountRef.current++;
            }
            
            const isStable = gestureStableCountRef.current >= SMOOTHING_CONFIG.stableFrames;
            const debounceOk = timeSinceLastUpdate >= SMOOTHING_CONFIG.debounceMs;
            
            if (isStable && debounceOk) {
              lastUpdateTimeRef.current = now;
              setConfidence(Math.max(handConfidence, 0.9));
              
              const gestureState: GestureState = {
                handLandmarks: handLandmarks[0]?.map(l => [l.x, l.y, l.z ?? 0]) || [],
                bodyPose: poseLandmarks?.map(l => [l.x, l.y, l.z]) || undefined,
                gestureTokens: tokens.length > 0 ? tokens : ["body_detected"],
                confidence: Math.max(handConfidence, 0.9),
                timestamp: Date.now(),
              };
              
              onGestureUpdate(gestureState);
              const interpretation = inferClinicalInterpretation(gestureState);
              onInterpretation(interpretation);
            }
            
            if (frameCount % 30 === 0) {
              const status: string[] = [];
              if (poseLandmarks) status.push("Body");
              if (handLandmarks.length > 0) status.push(`${handLandmarks.length} hand${handLandmarks.length > 1 ? "s" : ""}`);
              if (bodyState?.isFallen) status.push("FALLEN");
              setDebugInfo(status.join(" + ") || "Scanning...");
            }
          } else {
            setHandDetected(false);
            setPoseDetected(false);
            setConfidence(0);
            
            if (gestureStableCountRef.current > 0) {
              gestureStableCountRef.current = 0;
              lastGestureRef.current = [];
              
              const timeSinceLastUpdate = performance.now() - lastUpdateTimeRef.current;
              if (timeSinceLastUpdate >= SMOOTHING_CONFIG.debounceMs * 2) {
                onGestureUpdate(null);
                onInterpretation(null);
              }
            }
            
            if (frameCount % 30 === 0) {
              setDebugInfo("Scanning...");
            }
          }
        } catch (err) {
          console.error("Detection error:", err);
          if (frameCount % 60 === 0) {
            setDebugInfo("Detection error");
          }
        }
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    console.log("Starting detection loop");
    rafRef.current = requestAnimationFrame(detect);

    return () => {
      console.log("Stopping detection loop");
      isRunningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [cameraState, videoReady, useDemoMode, mediaPipeReady, hasGestureChanged, onGestureUpdate, onInterpretation, onPoseUpdate]);

  const startCamera = useCallback(async () => {
    setCameraState("starting");
    setErrorMessage(null);
    setVideoReady(false);
    setDebugInfo("Requesting camera...");
    
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraState("error");
        setErrorMessage("Camera not supported. Use HTTPS or localhost.");
        setUseDemoMode(true);
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      
      const videoTrack = mediaStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      console.log("Camera settings:", settings);
      
      streamRef.current = mediaStream;
      
      const video = videoRef.current;
      if (!video) {
        throw new Error("Video element not found");
      }
      
      video.srcObject = mediaStream;
      setDebugInfo(`Camera: ${settings.width}x${settings.height}`);
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Video load timeout"));
        }, 10000);
        
        const onCanPlay = () => {
          clearTimeout(timeout);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("error", onError);
          resolve();
        };
        
        const onError = () => {
          clearTimeout(timeout);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("error", onError);
          reject(new Error("Video load error"));
        };
        
        if (video.readyState >= 3) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        
        video.addEventListener("canplay", onCanPlay);
        video.addEventListener("error", onError);
      });
      
      await video.play();
      
      setCameraState("active");
      setVideoReady(true);
      setUseDemoMode(false);
      setDebugInfo("Camera active");
      onGestureUpdate(null);
      onInterpretation(null);
      
    } catch (err) {
      console.error("Camera error:", err);
      setCameraState("error");
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setErrorMessage("Camera permission denied. Allow camera access in browser settings.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setErrorMessage("No camera found. Connect a camera and try again.");
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          setErrorMessage("Camera is in use by another application.");
        } else {
          setErrorMessage(`Camera error: ${err.message}`);
        }
      } else {
        setErrorMessage("Camera access failed. Try demo mode instead.");
      }
      
      setUseDemoMode(true);
    }
  }, [onGestureUpdate, onInterpretation]);

  const stopCamera = useCallback(() => {
    isRunningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCameraState("idle");
    setVideoReady(false);
    setHandDetected(false);
    setPoseDetected(false);
    setDebugInfo("");
    setConfidence(0);
    setFps(0);
    frameTimesRef.current = [];
    gestureStableCountRef.current = 0;
    lastGestureRef.current = [];
    onGestureUpdate(null);
    onInterpretation(null);
    onPoseUpdate?.(null);
  }, [onGestureUpdate, onInterpretation, onPoseUpdate]);

  const handleDemoGesture = useCallback(
    (tokens: string[]) => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      
      setCameraState("idle");
      setUseDemoMode(true);
      setVideoReady(false);
      
      // Create demo pose state
      const isFallen = tokens.includes("fallen") || tokens.includes("collapse");
      const demoPoseState: BodyPoseState = {
        poseLandmarks: null,
        leftHandLandmarks: null,
        rightHandLandmarks: null,
        bodyState: {
          isStanding: !isFallen,
          isSitting: false,
          isFallen: isFallen,
          isCrouching: false,
          bodyAngle: isFallen ? 85 : 0,
          headPosition: { x: 0.5, y: isFallen ? 0.9 : 0.2, z: 0 },
          torsoCenter: { x: 0.5, y: isFallen ? 0.85 : 0.5, z: 0 },
        },
        confidence: 1,
        timestamp: Date.now(),
      };
      
      onPoseUpdate?.(demoPoseState);
      
      const gestureState: GestureState = {
        handLandmarks: [],
        gestureTokens: tokens,
        confidence: 1,
        timestamp: Date.now(),
      };
      onGestureUpdate(gestureState);
      const interpretation = inferClinicalInterpretation(gestureState);
      onInterpretation(interpretation);
    },
    [onGestureUpdate, onInterpretation, onPoseUpdate]
  );

  const isShowingVideo = cameraState === "starting" || cameraState === "active";

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden shadow-lg">
      {/* Video / Preview area */}
      <div className="relative aspect-video bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-secondary)]">
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onCanPlay={handleVideoCanPlay}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            isShowingVideo && videoReady ? "opacity-100" : "opacity-0"
          }`}
          style={{ transform: "scaleX(-1)" }}
        />
        
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full pointer-events-none"
          width={640}
          height={480}
          style={{ display: "none" }}
        />
        
        {/* Idle state */}
        {cameraState === "idle" && !useDemoMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/20 backdrop-blur-sm border border-[var(--accent-primary)]/30">
              <Video className="h-10 w-10 text-[var(--accent-primary)]" />
            </div>
            {errorMessage ? (
              <div className="rounded-xl bg-[var(--alert-emergency)]/10 border border-[var(--alert-emergency)]/30 px-4 py-3 max-w-sm backdrop-blur-sm">
                <p className="text-center text-[var(--alert-emergency)] text-sm">
                  {errorMessage}
                </p>
              </div>
            ) : (
              <p className="text-center text-[var(--text-secondary)] text-sm max-w-sm">
                Enable camera to track body movements and gestures in real-time
              </p>
            )}
            <button
              onClick={startCamera}
              className="inline-flex items-center gap-2 min-h-[48px] rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-sm font-semibold text-[var(--bg-primary)] transition-all hover:opacity-90 hover:scale-105 shadow-lg shadow-[var(--accent-primary)]/20"
            >
              <Video className="h-4 w-4" />
              {errorMessage ? "Try Again" : "Start Camera"}
            </button>
            <p className="text-xs text-[var(--text-muted)]">
              {mediaPipeReady ? "Body + hand tracking ready" : "Loading tracking models..."}
            </p>
          </div>
        )}
        
        {/* Starting state */}
        {cameraState === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-[var(--bg-primary)]/80 backdrop-blur-md">
            <div className="relative">
              <Camera className="h-12 w-12 text-[var(--accent-primary)]" />
              <Loader2 className="absolute -top-2 -right-2 h-6 w-6 text-[var(--accent-primary)] animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-[var(--text-primary)] font-medium">Initializing camera...</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{debugInfo}</p>
            </div>
          </div>
        )}
        
        {/* Demo mode */}
        {useDemoMode && cameraState !== "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--text-muted)]/10 backdrop-blur-sm">
              <VideoOff className="h-8 w-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-center text-[var(--text-secondary)] text-sm">
              Demo mode — tap a gesture below to simulate
            </p>
          </div>
        )}
        
        {/* Active camera overlay */}
        {cameraState === "active" && videoReady && (
          <>
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {/* Live indicator */}
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                Live
              </div>
              
              {/* FPS */}
              {fps > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-blue-400">
                  <Activity className="h-3 w-3" />
                  {fps} FPS
                </div>
              )}
              
              {/* Detection status */}
              <div className={`rounded-lg bg-black/60 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium ${
                mediaPipeReady ? "text-green-400" : "text-amber-400"
              }`}>
                {debugInfo || "Initializing..."}
              </div>
              
              {/* Pose detected badge */}
              {poseDetected && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-lg bg-purple-500/90 backdrop-blur-sm px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <User className="h-3 w-3" />
                    Body tracked
                  </div>
                </motion.div>
              )}
              
              {/* Hand detected */}
              {handDetected && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-lg bg-[var(--accent-primary)]/90 backdrop-blur-sm px-2.5 py-1.5"
                >
                  <div className="text-xs font-semibold text-[var(--bg-primary)]">
                    Hand detected
                  </div>
                  <div className="mt-1 h-1 w-full bg-[var(--bg-primary)]/30 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${confidence * 100}%` }}
                      transition={{ duration: 0.2 }}
                      className="h-full bg-[var(--bg-primary)] rounded-full"
                    />
                  </div>
                </motion.div>
              )}
            </div>
            
            {/* Stop button */}
            <button
              onClick={stopCamera}
              className="absolute top-3 right-3 rounded-lg bg-black/50 backdrop-blur-sm p-2 text-white hover:bg-black/70 transition-colors"
              aria-label="Stop camera"
            >
              <VideoOff className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Demo gesture buttons */}
      <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-elevated)]">
        <p className="text-xs font-medium text-[var(--text-muted)] mb-3">
          {cameraState === "active" ? "Or simulate a gesture:" : "Simulate a gesture:"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_GESTURES.map((g) => (
            <motion.button
              key={g.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleDemoGesture([...g.tokens])}
              className={`min-h-[44px] rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all backdrop-blur-sm ${
                g.id === "emergency"
                  ? "border-[var(--alert-emergency)]/50 bg-[var(--alert-emergency)]/10 hover:bg-[var(--alert-emergency)]/20 text-[var(--alert-emergency)]"
                  : "border-[var(--border-default)] bg-[var(--bg-primary)]/50 hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/10"
              }`}
            >
              {g.label}
            </motion.button>
          ))}
        </div>
        
        {(useDemoMode || cameraState === "error") && cameraState !== "active" && (
          <button
            onClick={startCamera}
            className="mt-3 w-full min-h-[44px] rounded-xl border border-dashed border-[var(--border-default)] text-sm text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--accent-primary)] transition-colors"
          >
            Try camera again
          </button>
        )}
      </div>
    </div>
  );
}
