
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

// ---------------------------------------------------------------------------
// v0.3.1 Photo Selection Constants
// ---------------------------------------------------------------------------

/** How long both hands must be detected before firing lock photo gesture */
const TWO_HANDS_LOCK_HOLD_MS = 500;

/** Cooldown after a lock photo gesture before another lock is allowed */
const TWO_HANDS_LOCK_COOLDOWN_MS = 1000;

/** Pinch ratio threshold: pinchDistance / palmSize below this is a pinch */
const PINCH_RATIO_THRESHOLD = 0.5;

/** How long pinch must be held before confirming open */
const PINCH_HOLD_MS = 300;

/** Cooldown after pinch confirm before another pinch is allowed */
const PINCH_COOLDOWN_MS = 1000;

/** Debug HUD for gesture photo selection */
const DEBUG_GESTURES = true;
/** Min interval between debug HUD re-renders (ms) */
const DEBUG_HUD_INTERVAL_MS = 100;

type RawGesture = 'open' | 'fist' | 'unknown' | 'none';

interface GestureControllerProps {
  onModeChange: (mode: TreeMode) => void;
  currentMode: TreeMode;
  onHandPosition?: (x: number, y: number, detected: boolean) => void;
  onTwoHandsDetected?: (detected: boolean) => void;
  /** Pause gesture-driven camera navigation (e.g. when a detail modal is open). v0.3 hook. */
  gestureNavigationEnabled?: boolean;
  // --- v0.3.1 Photo selection gestures ---
  /** Enable gesture-based photo selection (pinch). Should be false when modal is open. */
  gesturePhotoSelectionEnabled?: boolean;
  /** Whether a candidate photo exists near screen center */
  hasCandidatePhoto?: boolean;
  /** Called when two-hands hold triggers: lock current candidate photo (v0.3.1-lite: not used) */
  onLockPhotoGesture?: () => void;
  /** Called when pinch hold triggers: open current candidate photo */
  onPinchConfirm?: () => void;
}

export const GestureController: React.FC<GestureControllerProps> = ({ 
  onModeChange, 
  currentMode, 
  onHandPosition, 
  onTwoHandsDetected,
  gestureNavigationEnabled = true,
  gesturePhotoSelectionEnabled = true,
  hasCandidatePhoto = false,
  onLockPhotoGesture,
  onPinchConfirm,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [gestureStatus, setGestureStatus] = useState<string>('Initializing...');
  const [handPos, setHandPos] = useState<{ x: number; y: number } | null>(null);
  
  // Keep a ref to currentMode for the rAF closure
  const currentModeRef = useRef<TreeMode>(currentMode);
  // v0.3.1-lite: Refs for props used inside detectGesture (avoid stale closure)
  const hasCandidatePhotoRef = useRef(hasCandidatePhoto);
  const gestureNavigationEnabledRef = useRef(gestureNavigationEnabled);
  const gesturePhotoSelectionEnabledRef = useRef(gesturePhotoSelectionEnabled);
  
  // -------------------------------------------------------------------------
  // v0.2.1 Stable-hold trigger state (replaces old frame-count debounce)
  // -------------------------------------------------------------------------
  const holdState = useRef({
    candidateGesture: 'none' as RawGesture,
    candidateSince: 0,
    lastUnknownSince: 0,
    lastTriggeredAt: 0,
    lastTriggeredGesture: 'none' as RawGesture,
    triggerConsumed: false,
  });

  // -------------------------------------------------------------------------
  // v0.3.1 Two-hands lock state
  // -------------------------------------------------------------------------
  const twoHandsHold = useRef({
    twoHandsSince: 0,           // performance.now() when both hands first detected
    twoHandsLocked: false,      // has this two-hands period already fired lock?
    lastLockTriggeredAt: 0,     // last lock fire time (for cooldown)
  });

  // -------------------------------------------------------------------------
  // v0.3.1 Pinch gesture state
  // -------------------------------------------------------------------------
  const pinchState = useRef({
    pinching: false,            // is a pinch currently in progress?
    pinchSince: 0,              // when pinch started
    lastPinchTriggeredAt: 0,    // last pinch confirm fire time
    pinchTriggered: false,      // has this pinch already fired?
  });

  // -------------------------------------------------------------------------
  // v0.3.1 Debug HUD state (throttled at ~10fps)
  // -------------------------------------------------------------------------
  const [debugInfo, setDebugInfo] = useState({
    candidate: false,
    pinchRatio: 0,
    pinchDetected: false,
    pinchHoldMs: 0,
    pinchCooldownRemaining: 0,
    lastBlockReason: 'none' as string,
  });
  const lastDebugRender = useRef(0);

  useEffect(() => {
    currentModeRef.current = currentMode;
  }, [currentMode]);
  useEffect(() => { hasCandidatePhotoRef.current = hasCandidatePhoto; }, [hasCandidatePhoto]);
  useEffect(() => { gestureNavigationEnabledRef.current = gestureNavigationEnabled; }, [gestureNavigationEnabled]);
  useEffect(() => { gesturePhotoSelectionEnabledRef.current = gesturePhotoSelectionEnabled; }, [gesturePhotoSelectionEnabled]);

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
          
          // Use first hand for gesture detection (includes pinch)
          const landmarks = result.landmarks[0];
          // Pass all landmarks for pinch detection across any hand
          detectGesture(landmarks, result.landmarks);
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

    const detectGesture = (landmarks: any[], allLandmarks?: any[][]) => {
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
      if (onHandPosition && gestureNavigationEnabledRef.current) {
        onHandPosition(deadX, deadY, true);
      } else if (onHandPosition && !gestureNavigationEnabledRef.current) {
        // Navigation paused but hand IS detected — signal presence without position
        onHandPosition(0.5, 0.5, false);
      }
      
      // ======================================================================
      // v0.3.1-lite: PINCH DETECTION — runs FIRST, independent of open/fist
      // ======================================================================
      const now = performance.now();
      const checkPinch = (h: any[]): number => {
        const w = h[0], tTip = h[4], iTip = h[8], mMcp = h[9];
        const pd = Math.hypot(tTip.x - iTip.x, tTip.y - iTip.y);
        const palm = Math.hypot(w.x - mMcp.x, w.y - mMcp.y);
        return palm === 0 ? 999 : pd / palm;
      };
      // v0.3.2: Verify middle/ring/pinky are extended — true pinch requires them open, not curled like a fist
      const areNonPinchFingersExtended = (h: any[]): boolean => {
        const w = h[0];
        const checks: [number, number][] = [[12, 9], [16, 13], [20, 17]];
        let extended = 0;
        for (const [tipIdx, baseIdx] of checks) {
          const dt = Math.hypot(h[tipIdx].x - w.x, h[tipIdx].y - w.y);
          const db = Math.hypot(h[baseIdx].x - w.x, h[baseIdx].y - w.y);
          if (dt > db * 1.3) extended++;
        }
        return extended >= 2;  // at least 2 of 3 non-pinch fingers must be extended
      };
      let bestRatio = 999;
      let pinchHand: any[] | null = null;
      const hands = (allLandmarks && allLandmarks.length > 0) ? allLandmarks : [landmarks];
      for (const h of hands) {
        const r = checkPinch(h);
        if (r < bestRatio) { bestRatio = r; pinchHand = h; }
      }
      const rawPinch = bestRatio < PINCH_RATIO_THRESHOLD;
      const anyPinch = rawPinch && pinchHand !== null && areNonPinchFingersExtended(pinchHand);

      const ps = pinchState.current;
      let blockReason = 'none', shouldPinch = false;
      if (!gesturePhotoSelectionEnabledRef.current) blockReason = 'selection disabled';
      else if (!hasCandidatePhotoRef.current) blockReason = 'no candidate';
      else if (!onPinchConfirm) blockReason = 'no callback';
      else shouldPinch = true;

      if (anyPinch && shouldPinch) {
        if (!ps.pinching) { ps.pinching = true; ps.pinchSince = now; ps.pinchTriggered = false; }
        const dur = now - ps.pinchSince;
        if (dur >= PINCH_HOLD_MS && !ps.pinchTriggered && (now - ps.lastPinchTriggeredAt) >= PINCH_COOLDOWN_MS) {
          ps.pinchTriggered = true; ps.lastPinchTriggeredAt = now; onPinchConfirm();
        }
      } else if (anyPinch && !shouldPinch) {
        if (!ps.pinching) ps.pinching = true;
      } else {
        if (ps.pinching) { ps.pinching = false; ps.pinchSince = 0; ps.pinchTriggered = false; }
      }

      if (DEBUG_GESTURES && now - lastDebugRender.current > DEBUG_HUD_INTERVAL_MS) {
        lastDebugRender.current = now;
        const cdR = Math.max(0, Math.ceil((PINCH_COOLDOWN_MS - (now - ps.lastPinchTriggeredAt)) / 100) / 10);
        setDebugInfo({ candidate: hasCandidatePhotoRef.current, pinchRatio: Math.round(bestRatio*100)/100,
          pinchDetected: anyPinch, pinchHoldMs: anyPinch?Math.round(now-ps.pinchSince):0,
          pinchCooldownRemaining: cdR, lastBlockReason: anyPinch&&!shouldPinch?blockReason:'none' });
      }

      // ======================================================================
      // v0.2.1 Determine raw gesture type (runs AFTER pinch)
      // ======================================================================
      const ft = [8, 12, 16, 20], fb = [5, 9, 13, 17];
      
      let extendedFingers = 0;

      for (let i = 0; i < 4; i++) {
        const tip = landmarks[ft[i]];
        const base = landmarks[fb[i]];
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
      // v0.2.1 Stable-hold trigger logic
      // -----------------------------------------------------------------------
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

      // --- v0.3.1-lite: Status text (pinch takes display priority) ---
      if (ps.pinching) {
        setGestureStatus(`Pinch ${Math.round(now-ps.pinchSince)}ms / ${PINCH_HOLD_MS}ms`);
      } else if (hs.triggerConsumed) {
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

      {/* v0.3.1-lite: Pinch Debug HUD */}
      {DEBUG_GESTURES && (
        <div className="mt-2 w-[18.75vw] pointer-events-auto">
          <div className="bg-black/70 backdrop-blur-sm border border-[#D4AF37]/20 rounded p-2 text-right">
            <p className="text-[10px] text-[#D4AF37]/60 font-mono leading-tight">
              cand: {debugInfo.candidate ? 'YES' : 'no'}
              {' | '}ratio: {debugInfo.pinchRatio}
              {' | '}pinch: {debugInfo.pinchDetected ? 'YES' : 'no'}
            </p>
            <p className="text-[10px] text-[#D4AF37]/40 font-mono leading-tight">
              hold: {debugInfo.pinchHoldMs}/{PINCH_HOLD_MS}ms
              {' | '}cd: {debugInfo.pinchCooldownRemaining}s
              {debugInfo.lastBlockReason !== 'none' && (
                <span className="text-red-400/60">{' | '}BLOCK: {debugInfo.lastBlockReason}</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
