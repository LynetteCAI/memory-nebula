
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { TreeMode } from '../types';

// ---------------------------------------------------------------------------
// v0.2.1 Gesture Stabilization Constants
// ---------------------------------------------------------------------------

/** How long a gesture must be held steadily before it triggers a mode switch */
const GESTURE_HOLD_MS = 500;

/** Cooldown after a mode switch before another switch is allowed */
const GESTURE_COOLDOWN_MS = 1000;

/** How long an ambiguous/unknown gesture is tolerated before resetting the hold timer */
const GESTURE_UNKNOWN_RESET_MS = 300;

/** Dead zone fraction: hand movements within ±DEAD_ZONE from center are ignored */
const NAVIGATION_DEAD_ZONE = 0.08;

type RawGesture = 'open' | 'fist' | 'unknown' | 'none';

interface GestureControllerProps {
  onModeChange: (mode: TreeMode) => void;
  currentMode: TreeMode;
  onHandPosition?: (x: number, y: number, detected: boolean) => void;
  onTwoHandsDetected?: (detected: boolean) => void;
  /** Pause gesture-driven camera navigation (e.g. when a detail modal is open). v0.3 hook. */
  gestureNavigationEnabled?: boolean;
}

export const GestureController: React.FC<GestureControllerProps> = ({ 
  onModeChange, 
  currentMode, 
  onHandPosition, 
  onTwoHandsDetected,
  gestureNavigationEnabled = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [gestureStatus, setGestureStatus] = useState<string>('Initializing...');
  const [handPos, setHandPos] = useState<{ x: number; y: number } | null>(null);
  
  // Keep a ref to currentMode for the rAF closure
  const currentModeRef = useRef<TreeMode>(currentMode);
  
  // -------------------------------------------------------------------------
  // v0.2.1 Stable-hold trigger state (replaces old frame-count debounce)
  // -------------------------------------------------------------------------
  const holdState = useRef({
    candidateGesture: 'none' as RawGesture,
    candidateSince: 0,         // performance.now() when candidate was first seen
    lastUnknownSince: 0,       // when we last entered 'unknown' state
    lastTriggeredAt: 0,        // performance.now() when last mode switch fired
    lastTriggeredGesture: 'none' as RawGesture,
    triggerConsumed: false,    // has this hold already triggered? (prevent re-fire)
  });

  useEffect(() => {
    currentModeRef.current = currentMode;
  }, [currentMode]);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        // Use jsDelivr CDN (accessible in China)
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        // Use local model file to avoid loading from Google Storage (blocked in China)
        // Model file should be downloaded using: npm run download-model or download-model.bat/.sh
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `/models/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        startWebcam();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        console.warn("Gesture control is unavailable. The app will still work without it.");
        setGestureStatus("Gesture control unavailable");
        // Don't block the app if gesture control fails
      }
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: "user" }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", predictWebcam);
            setIsLoaded(true);
            setGestureStatus("Waiting for hand...");
          }
        } catch (err) {
          console.error("Error accessing webcam:", err);
          setGestureStatus("Permission Denied");
        }
      }
    };

    // Draw a single hand without clearing canvas
    const drawSingleHandSkeleton = (landmarks: any[], ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      // Hand connections (MediaPipe hand model)
      const connections = [
        // Thumb
        [0, 1], [1, 2], [2, 3], [3, 4],
        // Index finger
        [0, 5], [5, 6], [6, 7], [7, 8],
        // Middle finger
        [0, 9], [9, 10], [10, 11], [11, 12],
        // Ring finger
        [0, 13], [13, 14], [14, 15], [15, 16],
        // Pinky
        [0, 17], [17, 18], [18, 19], [19, 20],
        // Palm
        [5, 9], [9, 13], [13, 17]
      ];

      // Draw connections (lines)
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#D4AF37'; // Gold color
      connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        ctx.beginPath();
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
        ctx.stroke();
      });

      // Draw landmarks (points)
      landmarks.forEach((landmark, index) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        
        // Use green for all points
        ctx.fillStyle = '#228B22'; // Forest green color
        ctx.fill();
        
        // Add outline
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
    };

    // Draw all detected hands
    const drawAllHands = (allLandmarks: any[][]) => {
      if (!canvasRef.current || !videoRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size to match video
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      // Clear canvas once
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw each hand
      allLandmarks.forEach(landmarks => {
        drawSingleHandSkeleton(landmarks, ctx, canvas);
      });
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current) return;

      const startTimeMs = performance.now();
      if (videoRef.current.videoWidth > 0) { // Ensure video is ready
        const result = handLandmarker.detectForVideo(videoRef.current, startTimeMs);

        if (result.landmarks && result.landmarks.length > 0) {
          // Check if two hands are detected
          const twoHandsDetected = result.landmarks.length >= 2;
          if (onTwoHandsDetected) {
            onTwoHandsDetected(twoHandsDetected);
          }

          // Draw all detected hands at once
          drawAllHands(result.landmarks);
          
          // Use first hand for gesture detection
          const landmarks = result.landmarks[0];
          detectGesture(landmarks);
        } else {
            // v0.2.1: Hand lost — do NOT change mode, just stop navigation
            const modeName = currentModeRef.current === TreeMode.CHAOS ? 'Constellation' : 'Core';
            setGestureStatus(`No hand — ${modeName} locked`);
            setHandPos(null);
            if (onHandPosition) {
              onHandPosition(0.5, 0.5, false);
            }
            if (onTwoHandsDetected) {
              onTwoHandsDetected(false);
            }
            // Clear canvas when no hand detected
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              }
            }
            // Reset hold state to 'none' so next detection starts fresh
            // (but don't reset cooldown — that's time-based)
            const hs = holdState.current;
            if (hs.candidateGesture !== 'none') {
              hs.candidateGesture = 'none';
              hs.candidateSince = performance.now();
              hs.triggerConsumed = false;
            }
        }
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    const detectGesture = (landmarks: any[]) => {
      // 0 is Wrist
      // Tips: 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
      // Bases (MCP): 5, 9, 13, 17
      
      const wrist = landmarks[0];
      
      // Calculate palm center (average of wrist and finger bases)
      const palmCenterX = (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5;
      const palmCenterY = (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5;

      // -----------------------------------------------------------------------
      // v0.2.1 Hand position → camera navigation with dead zone
      // -----------------------------------------------------------------------
      // Apply dead zone: ignore small movements around center to reduce jitter
      const offsetX = palmCenterX - 0.5;
      const offsetY = palmCenterY - 0.5;
      const deadX = Math.abs(offsetX) < NAVIGATION_DEAD_ZONE ? 0.5 : palmCenterX;
      const deadY = Math.abs(offsetY) < NAVIGATION_DEAD_ZONE ? 0.5 : palmCenterY;
      
      setHandPos({ x: deadX, y: deadY });
      
      // Only send navigation updates when navigation is enabled (v0.3 hook)
      if (onHandPosition && gestureNavigationEnabled) {
        onHandPosition(deadX, deadY, true);
      } else if (onHandPosition && !gestureNavigationEnabled) {
        // Navigation paused but hand IS detected — signal presence without position
        onHandPosition(0.5, 0.5, false);
      }
      
      // -----------------------------------------------------------------------
      // v0.2.1 Determine raw gesture type
      // -----------------------------------------------------------------------
      const fingerTips = [8, 12, 16, 20];
      const fingerBases = [5, 9, 13, 17];
      
      let extendedFingers = 0;

      for (let i = 0; i < 4; i++) {
        const tip = landmarks[fingerTips[i]];
        const base = landmarks[fingerBases[i]];
        const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const distBase = Math.hypot(base.x - wrist.x, base.y - wrist.y);
        if (distTip > distBase * 1.5) {
          extendedFingers++;
        }
      }
      
      // Thumb check (Tip 4 vs Base 2)
      const thumbTip = landmarks[4];
      const thumbBase = landmarks[2];
      const distThumbTip = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
      const distThumbBase = Math.hypot(thumbBase.x - wrist.x, thumbBase.y - wrist.y);
      if (distThumbTip > distThumbBase * 1.2) extendedFingers++;

      // Determine raw gesture
      let rawGesture: RawGesture;
      if (extendedFingers >= 4) {
        rawGesture = 'open';
      } else if (extendedFingers <= 1) {
        rawGesture = 'fist';
      } else {
        rawGesture = 'unknown';
      }

      // -----------------------------------------------------------------------
      // v0.2.1 Stable-hold trigger logic (replaces old frame-counter system)
      // -----------------------------------------------------------------------
      const now = performance.now();
      const hs = holdState.current;

      // 1. Determine if gesture changed
      if (rawGesture !== hs.candidateGesture) {
        // Gesture changed — reset hold timer
        hs.candidateGesture = rawGesture;
        hs.candidateSince = now;
        hs.triggerConsumed = false;
        
        if (rawGesture === 'unknown') {
          hs.lastUnknownSince = now;
        }
      }

      // 2. If unknown persists too long, reset to prevent stale holds
      if (rawGesture === 'unknown' && now - hs.lastUnknownSince > GESTURE_UNKNOWN_RESET_MS) {
        hs.triggerConsumed = false;
        hs.candidateSince = now; // keep timing fresh
      }

      // 3. Check if hold threshold is met
      const holdDuration = now - hs.candidateSince;
      const inCooldown = (now - hs.lastTriggeredAt) < GESTURE_COOLDOWN_MS;
      
      const isOpen = rawGesture === 'open';
      const isFist = rawGesture === 'fist';
      const heldLongEnough = holdDuration >= GESTURE_HOLD_MS;
      const notYetTriggered = !hs.triggerConsumed;
      
      const targetModeOpen = TreeMode.CHAOS;   // Memory Constellation
      const targetModeFist = TreeMode.FORMED;  // Memory Core
      const currentModeNow = currentModeRef.current;

      // 4. Trigger open → CHAOS (release memory constellation)
      if (isOpen && heldLongEnough && notYetTriggered && !inCooldown && currentModeNow !== targetModeOpen) {
        hs.triggerConsumed = true;
        hs.lastTriggeredAt = now;
        hs.lastTriggeredGesture = 'open';
        onModeChange(targetModeOpen);
        setGestureStatus('Released: Memory Constellation');
      }

      // 5. Trigger fist → FORMED (gather memory core)
      if (isFist && heldLongEnough && notYetTriggered && !inCooldown && currentModeNow !== targetModeFist) {
        hs.triggerConsumed = true;
        hs.lastTriggeredAt = now;
        hs.lastTriggeredGesture = 'fist';
        onModeChange(targetModeFist);
        setGestureStatus('Gathered: Memory Core');
      }

      // 6. Update status text (only if not in triggered state)
      if (hs.triggerConsumed) {
        // Already triggered — show locked state
        const modeName = currentModeNow === TreeMode.CHAOS ? 'Memory Constellation' : 'Memory Core';
        if (inCooldown) {
          setGestureStatus(`Locked: ${modeName} (cooldown)`);
        } else {
          setGestureStatus(`Locked: ${modeName}`);
        }
      } else if (inCooldown) {
        const cdRemaining = Math.ceil((GESTURE_COOLDOWN_MS - (now - hs.lastTriggeredAt)) / 100) / 10;
        setGestureStatus(`Cooldown ${cdRemaining}s...`);
      } else if (isOpen && heldLongEnough) {
        setGestureStatus('Hold steady... releasing');
      } else if (isFist && heldLongEnough) {
        setGestureStatus('Hold steady... gathering');
      } else if (isOpen) {
        setGestureStatus(`Open palm — hold ${(GESTURE_HOLD_MS / 1000).toFixed(1)}s to release`);
      } else if (isFist) {
        setGestureStatus(`Fist — hold ${(GESTURE_HOLD_MS / 1000).toFixed(1)}s to gather`);
      } else {
        setGestureStatus('Detected: ...');
      }
    };

    setupMediaPipe();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (handLandmarker) handLandmarker.close();
    };
  }, [onModeChange]);

  return (
    <div className="absolute top-6 right-[8%] z-50 flex flex-col items-end pointer-events-none">

      
      {/* Camera Preview Frame */}
      <div className="relative w-[18.75vw] h-[14.0625vw] border-2 border-[#D4AF37] rounded-lg overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.3)] bg-black">
        {/* Decorative Lines */}
        <div className="absolute inset-0 border border-[#F5E6BF]/20 m-1 rounded-sm z-10"></div>
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {/* Canvas for hand skeleton overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none z-20"
        />
        
        {/* Hand Position Debug */}
        {/* {handPos && (
          <div className="absolute top-2 left-2 text-[10px] text-[#D4AF37] bg-black/70 px-2 py-1 rounded font-mono">
            X: {handPos.x.toFixed(2)} Y: {handPos.y.toFixed(2)}
          </div>
        )} */}
        
        {/* Hand Position Indicator */}
        {handPos && (
          <div 
            className="absolute w-2 h-2 bg-[#D4AF37] rounded-full border border-white"
            style={{
              left: `${(1 - handPos.x) * 100}%`,
              top: `${handPos.y * 100}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        )}
    
      </div>

      {/* v0.2.1 Gesture status label */}
      <div className="mt-2 w-[18.75vw] pointer-events-auto">
        <p className="text-right text-[10px] md:text-xs text-[#D4AF37]/80 font-mono leading-tight px-1">
          {gestureStatus}
        </p>
      </div>
    </div>
  );
};
