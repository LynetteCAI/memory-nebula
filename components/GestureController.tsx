
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
const NAVIGATION_DEAD_ZONE = 0.10;

// ---------------------------------------------------------------------------
// v0.4.5 Soft Dead Zone Utility
// ---------------------------------------------------------------------------

/**
 * Smoothstep-based dead zone to eliminate center jump.
 * Inside the dead zone: returns center (no movement).
 * Outside: smooth transition from 0 using smoothstep easing.
 */
function applySoftDeadZone(value: number, center = 0.5, deadZone = 0.10): number {
  const offset = value - center;
  const abs = Math.abs(offset);
  if (abs <= deadZone) return center;

  const sign = Math.sign(offset);
  const normalized = (abs - deadZone) / (0.5 - deadZone);
  const eased = normalized * normalized * (3 - 2 * normalized); // smoothstep
  return center + sign * eased * 0.5;
}

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

// ---------------------------------------------------------------------------
// v0.3.2 Modal Close Gesture Constants
// ---------------------------------------------------------------------------

/** How long fist must be held to close the modal */
const MODAL_CLOSE_FIST_HOLD_MS = 600;
/** Cooldown after modal close before another close is allowed */
const MODAL_CLOSE_COOLDOWN_MS = 1000;
/** Grace period after modal opens before close gesture is accepted */
const MODAL_OPEN_GRACE_MS = 800;
/** Grace period after modal closes before fist can trigger mode switch */
const POST_MODAL_GRACE_MS = 800;

// ---------------------------------------------------------------------------
// v0.4.4 Chrono Stream Swipe Constants
// ---------------------------------------------------------------------------

/** Minimum horizontal palm displacement (screen width fraction) to trigger swipe */
const SWIPE_MIN_DISTANCE = 0.18;
/** Maximum swipe duration in ms */
const SWIPE_MAX_DURATION_MS = 700;
/** Minimum swipe duration in ms (to filter out jitter) */
const SWIPE_MIN_DURATION_MS = 120;
/** Maximum vertical drift during swipe (screen height fraction) */
const SWIPE_MAX_VERTICAL_DRIFT = 0.16;
/** Cooldown after a swipe before another is allowed */
const SWIPE_COOLDOWN_MS = 750;
/** Max age of palm history entries (ms) */
const SWIPE_HISTORY_MAX_AGE_MS = 1000;
/** Invert chrono swipe left/right direction if needed */
const INVERT_CHRONO_SWIPE = false;

// ---------------------------------------------------------------------------
// v0.5 Two-Hand Chrono Transition Constants
// ---------------------------------------------------------------------------

/** Minimum duration for a valid two-hand transition (ms) */
const TWO_HAND_TRANSITION_MIN_DURATION_MS = 300;
/** Maximum duration for a valid two-hand transition (ms) */
const TWO_HAND_TRANSITION_MAX_DURATION_MS = 1100;
/** Cooldown after a two-hand transition before another is allowed (ms) */
const TWO_HAND_TRANSITION_COOLDOWN_MS = 1400;

/** Max starting distance between hands for spread detection */
const SPREAD_START_MAX_DISTANCE = 0.38;
/** Min ending distance between hands for spread to trigger */
const SPREAD_END_MIN_DISTANCE = 0.56;
/** Min delta (increase) in hand distance for spread */
const SPREAD_DELTA_THRESHOLD = 0.20;

/** Min starting distance between hands for gather detection */
const GATHER_START_MIN_DISTANCE = 0.54;
/** Max ending distance between hands for gather to trigger */
const GATHER_END_MAX_DISTANCE = 0.36;
/** Min delta (decrease) in hand distance for gather */
const GATHER_DELTA_THRESHOLD = 0.20;

/** Max horizontal drift of the two-hand center during transition */
const TWO_HAND_MAX_CENTER_DRIFT = 0.24;
/** Max vertical drift of the two-hand center during transition */
const TWO_HAND_MAX_VERTICAL_DRIFT = 0.24;

type TwoHandTransitionType = 'spread' | 'gather' | 'none';

type TwoHandTransitionKind = 'none' | 'spread' | 'gather';

export interface TwoHandTransitionDebugState {
  twoHandsDetected: boolean;
  kind: TwoHandTransitionKind;
  distanceX: number;
  startDistanceX: number | null;
  durationMs: number;
  progress: number;
  cooldownRemainingMs: number;
  blockReason: string;
}

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
  // --- v0.3.2 Modal close gesture ---
  /** Whether the MemoryModal is currently open */
  modalOpen?: boolean;
  /** Timestamp (performance.now()) when modal was opened */
  modalOpenedAt?: number;
  /** Called when fist hold triggers in modal mode: close the modal */
  onModalCloseGesture?: () => void;
  /** v0.4.1: Completely disable all gesture actions (open/fist/pinch/nav/modal-close).
   *  Camera preview and debug HUD remain active.
   *  v0.4.4: Deprecated in favor of chrono-specific props. Kept for backward compat. */
  disableGestureActions?: boolean;
  /** v0.3.5: Completely stop webcam + hand tracking (no inference, no rAF loop).
   *  Saves CPU/GPU when Memory Manager or other heavy UI is open. */
  disableHandTracking?: boolean;
  // --- v0.4.4 Chrono Stream dedicated gestures ---
  /** Enable chrono stream swipe+pinch gestures (true when CHRONO_STREAM && !modalOpen) */
  chronoGestureEnabled?: boolean;
  /** Whether a chrono focus memory exists to open via pinch */
  hasChronoFocusMemory?: boolean;
  /** Called when chrono left swipe triggers: go to previous memory */
  onChronoSwipeLeft?: () => void;
  /** Called when chrono right swipe triggers: go to next memory */
  onChronoSwipeRight?: () => void;
  /** Called when chrono pinch hold triggers: open current focus memory */
  onChronoPinchOpen?: () => void;
  // --- v0.5 Two-Hand Chrono Transition ---
  /** Called when two-hand spread triggers: enter Chrono Stream from CHAOS */
  onEnterChronoGesture?: () => void;
  /** Called when two-hand gather triggers: exit Chrono Stream back to CHAOS */
  onExitChronoGesture?: () => void;
  /** Enable two-hand transition gestures (false when modal open) */
  chronoTransitionGestureEnabled?: boolean;
  // --- v0.5 Two-Hand Transition Debug ---
  /** Called when two-hand transition state changes (throttled) */
  onTwoHandTransitionStateChange?: (state: TwoHandTransitionDebugState) => void;
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
  modalOpen = false,
  modalOpenedAt = 0,
  onModalCloseGesture,
  disableGestureActions = false,
  disableHandTracking = false,
  // v0.4.4 Chrono Stream dedicated gestures
  chronoGestureEnabled = false,
  hasChronoFocusMemory = false,
  onChronoSwipeLeft,
  onChronoSwipeRight,
  onChronoPinchOpen,
  // v0.5 Two-Hand Chrono Transition
  onEnterChronoGesture,
  onExitChronoGesture,
  chronoTransitionGestureEnabled = false,
  onTwoHandTransitionStateChange,
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
  // v0.3.2: Modal close gesture refs
  const modalOpenRef = useRef(modalOpen);
  const modalOpenedAtRef = useRef(modalOpenedAt);
  const onModalCloseGestureRef = useRef(onModalCloseGesture);
  // v0.3.2: Post-modal grace to prevent accidental fist trigger after closing
  const modalClosedAtRef = useRef(0);
  const prevModalOpenRef = useRef(modalOpen);
  // v0.4.1: Ref for disableGestureActions to keep fresh in detection closure
  const disableActionsRef = useRef(disableGestureActions);
  // v0.3.5: Ref for disableHandTracking
  const disableHandTrackingRef = useRef(!!disableHandTracking);
  /** Ref to store predictWebcam so it can be restarted from outside the setup closure */
  const predictWebcamRef = useRef<() => void>(() => {});

  // -------------------------------------------------------------------------
  // v0.4.4 Chrono Stream swipe state
  // -------------------------------------------------------------------------
  const swipeState = useRef({
    palmHistory: [] as { x: number; y: number; time: number }[],
    lastSwipeTriggeredAt: 0,
  });

  // -------------------------------------------------------------------------
  // v0.4.4 Chrono Stream pinch state (separate from starfield pinch)
  // -------------------------------------------------------------------------
  const chronoPinchState = useRef({
    pinching: false,
    pinchSince: 0,
    lastPinchTriggeredAt: 0,
    pinchTriggered: false,
  });

  // v0.4.4: Refs for chrono-specific props to keep fresh in detection closure
  const chronoGestureEnabledRef = useRef(chronoGestureEnabled);
  const hasChronoFocusMemoryRef = useRef(hasChronoFocusMemory);
  const onChronoSwipeLeftRef = useRef(onChronoSwipeLeft);
  const onChronoSwipeRightRef = useRef(onChronoSwipeRight);
  const onChronoPinchOpenRef = useRef(onChronoPinchOpen);

  // -------------------------------------------------------------------------
  // v0.5 Two-Hand Chrono Transition state
  // -------------------------------------------------------------------------
  const twoHandTransition = useRef({
    startDistanceX: 0,
    startCenterX: 0,
    startCenterY: 0,
    startTime: 0,
    tracking: false,        // currently tracking a potential transition
    lastTransitionAt: 0,    // last transition trigger time (cooldown)
    lastTransitionType: 'none' as 'enterChrono' | 'exitChrono' | 'none',
    blockReason: 'none' as string,
  });
  const twoHandDebug = useRef({
    twoHandsDetected: false,
    twoHandDistanceX: 0,
    twoHandStartDistanceX: 0,
    twoHandDurationMs: 0,
    twoHandTransitionType: 'none' as TwoHandTransitionType,
    twoHandProgress: 0,
    twoHandCooldownRemaining: 0,
    twoHandBlockReason: 'none' as string,
  });

  // v0.5: Throttled callback ref + last emit time
  const onTwoHandStateChangeRef = useRef(onTwoHandTransitionStateChange);
  const lastTwoHandEmitTime = useRef(0);
  const TWO_HAND_EMIT_INTERVAL_MS = 100; // throttle to ~10fps
  
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
  // v0.3.2 Modal close fist state
  // -------------------------------------------------------------------------
  const modalCloseState = useRef({
    fistSince: 0,               // when fist started in modal mode
    lastCloseTriggeredAt: 0,    // last modal close fire time (cooldown)
    closeTriggered: false,      // has this fist hold already fired close?
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
    // v0.3.2 modal close debug
    modalOpen: false,
    modalCloseFist: false,
    modalCloseHoldMs: 0,
    modalGraceRemaining: 0,
    modalCloseCdRemaining: 0,
    modalCloseBlockReason: 'none' as string,
    // v0.5 two-hand transition debug
    twoHandsDetected: false,
    twoHandDistanceX: 0,
    twoHandStartDistanceX: 0,
    twoHandDurationMs: 0,
    twoHandTransitionType: 'none' as TwoHandTransitionType,
    twoHandProgress: 0,
    twoHandCooldownRemaining: 0,
    twoHandBlockReason: 'none' as string,
    // v0.5.3 hand orbit debug
    handOrbitMode: 'relative' as string,
    handDx: 0,
    handDy: 0,
    handPalmX: 0.5,
    handPalmY: 0.5,
    handOrbitActive: false,
  });
  const lastDebugRender = useRef(0);

  useEffect(() => {
    currentModeRef.current = currentMode;
  }, [currentMode]);
  useEffect(() => { hasCandidatePhotoRef.current = hasCandidatePhoto; }, [hasCandidatePhoto]);
  useEffect(() => { gestureNavigationEnabledRef.current = gestureNavigationEnabled; }, [gestureNavigationEnabled]);
  useEffect(() => { gesturePhotoSelectionEnabledRef.current = gesturePhotoSelectionEnabled; }, [gesturePhotoSelectionEnabled]);
  // v0.3.2: sync modal close gesture refs + detect close transition for post-modal grace
  useEffect(() => {
    modalOpenRef.current = modalOpen;
    // Detect modal close transition (true → false) and record timestamp
    if (prevModalOpenRef.current && !modalOpen) {
      modalClosedAtRef.current = performance.now();
    }
    prevModalOpenRef.current = modalOpen;
  }, [modalOpen]);
  useEffect(() => { modalOpenedAtRef.current = modalOpenedAt; }, [modalOpenedAt]);
  useEffect(() => { onModalCloseGestureRef.current = onModalCloseGesture; }, [onModalCloseGesture]);
  // v0.4.1: sync disableGestureActions ref
  useEffect(() => { disableActionsRef.current = disableGestureActions; }, [disableGestureActions]);
  // v0.3.5: sync disableHandTracking ref + handle lifecycle
  useEffect(() => {
    disableHandTrackingRef.current = !!disableHandTracking;

    if (disableHandTracking) {
      // Stop webcam to save power (rAF loop stops naturally via predictWebcam's early return)
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      if (canvasRef.current) {
        canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setIsLoaded(false);
      // Clear hand position so camera stops moving
      onHandPosition?.(0.5, 0.5, false);
      onTwoHandsDetected?.(false);
      setGestureStatus('Hand tracking paused');
    } else {
      // Restart webcam + prediction loop when Memory Manager closes
      const restart = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: 'user' }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setIsLoaded(true);
            setGestureStatus('Waiting for hand...');
            // predictWebcam will be called by the loadeddata event listener
          }
        } catch (err) {
          console.error('Error restarting webcam:', err);
          setGestureStatus('Camera unavailable');
        }
      };
      setTimeout(restart, 50);
    }
  }, [disableHandTracking]);
  // v0.4.4: sync chrono gesture refs
  useEffect(() => { chronoGestureEnabledRef.current = chronoGestureEnabled; }, [chronoGestureEnabled]);
  useEffect(() => { hasChronoFocusMemoryRef.current = hasChronoFocusMemory; }, [hasChronoFocusMemory]);
  useEffect(() => { onChronoSwipeLeftRef.current = onChronoSwipeLeft; }, [onChronoSwipeLeft]);
  useEffect(() => { onChronoSwipeRightRef.current = onChronoSwipeRight; }, [onChronoSwipeRight]);
  useEffect(() => { onChronoPinchOpenRef.current = onChronoPinchOpen; }, [onChronoPinchOpen]);
  // v0.5: sync two-hand transition gesture refs
  const chronoTransitionGestureEnabledRef = useRef(chronoTransitionGestureEnabled);
  const onEnterChronoGestureRef = useRef(onEnterChronoGesture);
  const onExitChronoGestureRef = useRef(onExitChronoGesture);
  useEffect(() => { chronoTransitionGestureEnabledRef.current = chronoTransitionGestureEnabled; }, [chronoTransitionGestureEnabled]);
  useEffect(() => { onEnterChronoGestureRef.current = onEnterChronoGesture; }, [onEnterChronoGesture]);
  useEffect(() => { onExitChronoGestureRef.current = onExitChronoGesture; }, [onExitChronoGesture]);
  // v0.5: sync two-hand transition state change callback
  useEffect(() => { onTwoHandStateChangeRef.current = onTwoHandTransitionStateChange; }, [onTwoHandTransitionStateChange]);

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

      // Only reset canvas dimensions when video size changes (avoids GPU re-allocation)
      if (canvas.width !== videoRef.current.videoWidth) {
        canvas.width = videoRef.current.videoWidth;
      }
      if (canvas.height !== videoRef.current.videoHeight) {
        canvas.height = videoRef.current.videoHeight;
      }

      // Clear canvas once
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw each hand
      allLandmarks.forEach(landmarks => {
        drawSingleHandSkeleton(landmarks, ctx, canvas);
      });
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current) return;

      // v0.3.5: Pause hand tracking when Memory Manager (or similar heavy UI) is open
      if (disableHandTrackingRef.current) {
        if (canvasRef.current) {
          canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        return; // Don't chain rAF — loop pauses here
      }

      const startTimeMs = performance.now();
      if (videoRef.current.videoWidth > 0) { // Ensure video is ready
        try {
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
        } catch (error) {
          console.error('Hand detection error:', error);
          // Keep the animation loop alive even if detection fails
        }
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    // v0.3.5: Store reference so disableHandTracking effect can restart it
    predictWebcamRef.current = predictWebcam;

    const detectGesture = (landmarks: any[], allLandmarks?: any[][]) => {
      // 0 is Wrist
      // Tips: 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
      // Bases (MCP): 5, 9, 13, 17

      // v0.5: Throttled emitter for two-hand transition state
      const emitTwoHandState = (now: number) => {
        const cb = onTwoHandStateChangeRef.current;
        if (!cb) return;
        if (now - lastTwoHandEmitTime.current < TWO_HAND_EMIT_INTERVAL_MS) return;
        lastTwoHandEmitTime.current = now;
        const td = twoHandDebug.current;
        const state: TwoHandTransitionDebugState = {
          twoHandsDetected: td.twoHandsDetected,
          kind: td.twoHandTransitionType as TwoHandTransitionKind,
          distanceX: td.twoHandDistanceX,
          startDistanceX: td.twoHandStartDistanceX > 0 ? td.twoHandStartDistanceX : null,
          durationMs: td.twoHandDurationMs,
          progress: td.twoHandProgress,
          cooldownRemainingMs: td.twoHandCooldownRemaining,
          blockReason: td.twoHandBlockReason,
        };
        cb(state);
      };

      const wrist = landmarks[0];
      
      // Calculate palm center (average of wrist and finger bases)
      const palmCenterX = (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5;
      const palmCenterY = (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5;

      // -----------------------------------------------------------------------
      // v0.2.1 Hand position → camera navigation with soft dead zone (v0.4.5)
      // v0.5.3: For CHAOS relative orbit, pass raw palm center (no dead zone);
      //         the Experience.tsx HAND_DRAG_DEAD_DELTA handles jitter filtering.
      // -----------------------------------------------------------------------
      // Soft dead zone: smoothstep transition eliminates center jump (visual indicator only)
      const smoothX = applySoftDeadZone(palmCenterX, 0.5, NAVIGATION_DEAD_ZONE);
      const smoothY = applySoftDeadZone(palmCenterY, 0.5, NAVIGATION_DEAD_ZONE);
      
      setHandPos({ x: smoothX, y: smoothY });
      
      // v0.5: In CHAOS, suppress navigation when two hands are detected
      // (hands are waiting for spread → time stream transition, don't move camera)
      const suppressNav = currentModeRef.current === TreeMode.CHAOS
        && allLandmarks && allLandmarks.length >= 2;
      
      // Only send navigation updates when navigation is enabled (v0.3 hook)
      if (onHandPosition && gestureNavigationEnabledRef.current && !suppressNav) {
        // v0.5.3: Use raw palm center for relative orbit (no center dead zone)
        onHandPosition(palmCenterX, palmCenterY, true);
      } else if (onHandPosition) {
        // Navigation paused or suppressed — signal presence without position
        onHandPosition(0.5, 0.5, false);
      }

      // v0.4.1: Backward compat — if disableGestureActions is explicitly set
      // AND we're not in chrono mode, bail out completely
      // v0.4.4: In chrono mode, we use the chrono-specific branch below instead
      if (disableActionsRef.current && currentModeRef.current !== TreeMode.CHRONO_STREAM) {
        setGestureStatus('Chrono Stream: gestures paused');
        return;
      }

      // ======================================================================
      // v0.4.4: CHRONO_STREAM DEDICATED GESTURES
      // ======================================================================
      if (currentModeRef.current === TreeMode.CHRONO_STREAM) {
        const chronoNow = performance.now();

        // ----------------------------------------------------------------
        // Layer 1: CHRONO_STREAM + modal open → only fist close
        // ----------------------------------------------------------------
        if (modalOpenRef.current) {
          const mcs = modalCloseState.current;
          let mCloseBlockReason = 'none';
          let shouldAttemptClose = false;

          // Compute fist inline
          const ftCheck = [8, 12, 16, 20], fbCheck = [5, 9, 13, 17];
          let extF = 0;
          for (let i = 0; i < 4; i++) {
            const dt = Math.hypot(landmarks[ftCheck[i]].x - wrist.x, landmarks[ftCheck[i]].y - wrist.y);
            const db = Math.hypot(landmarks[fbCheck[i]].x - wrist.x, landmarks[fbCheck[i]].y - wrist.y);
            if (dt > db * 1.5) extF++;
          }
          const dtThumb = Math.hypot(landmarks[4].x - wrist.x, landmarks[4].y - wrist.y);
          const dbThumb = Math.hypot(landmarks[2].x - wrist.x, landmarks[2].y - wrist.y);
          if (dtThumb > dbThumb * 1.2) extF++;
          const isFistNow = extF <= 1;

          // Check gate conditions
          const graceElapsed = (chronoNow - modalOpenedAtRef.current) >= MODAL_OPEN_GRACE_MS;
          if (!onModalCloseGestureRef.current) mCloseBlockReason = 'callback missing';
          else if (!graceElapsed) mCloseBlockReason = 'grace period';
          else shouldAttemptClose = true;

          if (isFistNow && shouldAttemptClose) {
            if (mcs.fistSince === 0) mcs.fistSince = chronoNow;
            mcs.closeTriggered = false;
            const fistDur = chronoNow - mcs.fistSince;
            const inCd = (chronoNow - mcs.lastCloseTriggeredAt) < MODAL_CLOSE_COOLDOWN_MS;
            if (fistDur >= MODAL_CLOSE_FIST_HOLD_MS && !inCd && !mcs.closeTriggered) {
              mcs.closeTriggered = true;
              mcs.lastCloseTriggeredAt = chronoNow;
              onModalCloseGestureRef.current();
            }
          } else if (isFistNow && !shouldAttemptClose) {
            if (mcs.fistSince === 0) mcs.fistSince = chronoNow;
          } else {
            if (mcs.fistSince !== 0) { mcs.fistSince = 0; mcs.closeTriggered = false; }
          }

          // Chrono modal gesture status + debug HUD
          if (DEBUG_GESTURES) {
            const mGraceR = Math.max(0, Math.ceil((MODAL_OPEN_GRACE_MS - (chronoNow - modalOpenedAtRef.current)) / 100) / 10);
            const mCdR = Math.max(0, Math.ceil((MODAL_CLOSE_COOLDOWN_MS - (chronoNow - mcs.lastCloseTriggeredAt)) / 100) / 10);
            setDebugInfo({
              candidate: false,
              pinchRatio: 0,
              pinchDetected: false,
              pinchHoldMs: 0,
              pinchCooldownRemaining: 0,
              lastBlockReason: 'none',
              modalOpen: true,
              modalCloseFist: isFistNow,
              modalCloseHoldMs: isFistNow ? Math.round(chronoNow - mcs.fistSince) : 0,
              modalGraceRemaining: mGraceR,
              modalCloseCdRemaining: mCdR,
              modalCloseBlockReason: isFistNow && !shouldAttemptClose ? mCloseBlockReason : 'none',
              // v0.5: modal blocks two-hand transitions
              twoHandsDetected: false,
              twoHandDistanceX: 0,
              twoHandStartDistanceX: 0,
              twoHandDurationMs: 0,
              twoHandTransitionType: 'none' as TwoHandTransitionType,
              twoHandProgress: 0,
              twoHandCooldownRemaining: 0,
              twoHandBlockReason: 'modal open',
            });
          }

          if (isFistNow) {
            const fistDur = chronoNow - mcs.fistSince;
            const graceElapsedNow = (chronoNow - modalOpenedAtRef.current) >= MODAL_OPEN_GRACE_MS;
            if (!graceElapsedNow) {
              setGestureStatus(`Chrono Modal grace ${Math.round((MODAL_OPEN_GRACE_MS-(chronoNow-modalOpenedAtRef.current))/100)/10}s...`);
            } else {
              setGestureStatus(`Chrono Fist to close ${Math.round(fistDur)}ms / ${MODAL_CLOSE_FIST_HOLD_MS}ms`);
            }
          } else {
            setGestureStatus('Chrono: Fist hold to close modal');
          }
          return; // CHRONO modal: no swipe, no pinch, no mode switch
        }

        // ----------------------------------------------------------------
        // Layer 2: CHRONO_STREAM + no modal → two-hand gather + chrono pinch + swipe
        // ----------------------------------------------------------------
        // Reset modal close state when not in modal
        const mcs = modalCloseState.current;
        if (mcs.fistSince !== 0) { mcs.fistSince = 0; mcs.closeTriggered = false; }

        // --- v0.5 Two-Hand Gather: exit Chrono Stream back to CHAOS ---
        if (allLandmarks && allLandmarks.length >= 2) {
          const tht = twoHandTransition.current;
          // Compute palm centers for each hand
          const centers = allLandmarks.map((h: any[]) => {
            const w = h[0], iMcp = h[5], pMcp = h[17];
            return {
              x: (w.x + iMcp.x + pMcp.x) / 3,
              y: (w.y + iMcp.y + pMcp.y) / 3,
            };
          });
          const a = centers[0], b = centers[1];
          const leftH = a.x < b.x ? a : b;
          const rightH = a.x < b.x ? b : a;
          const distanceX = rightH.x - leftH.x;
          const centerX = (leftH.x + rightH.x) / 2;
          const centerY = (leftH.y + rightH.y) / 2;

          const enabled = chronoTransitionGestureEnabledRef.current
            && currentModeRef.current === TreeMode.CHRONO_STREAM
            && !modalOpenRef.current;

          // Start tracking gather candidate
          if (!tht.tracking && enabled) {
            if (distanceX >= GATHER_START_MIN_DISTANCE) {
              tht.tracking = true;
              tht.startDistanceX = distanceX;
              tht.startCenterX = centerX;
              tht.startCenterY = centerY;
              tht.startTime = chronoNow;
              tht.blockReason = 'none';
            } else {
              tht.blockReason = 'start too narrow';
            }
          }

          // Continue tracking
          let transitionTriggered = false;
          if (tht.tracking && enabled) {
            const duration = chronoNow - tht.startTime;
            const delta = tht.startDistanceX - distanceX;
            const centerDriftX = Math.abs(centerX - tht.startCenterX);
            const centerDriftY = Math.abs(centerY - tht.startCenterY);
            const inCooldown = (chronoNow - tht.lastTransitionAt) < TWO_HAND_TRANSITION_COOLDOWN_MS;

            const conditionsMet =
              duration >= TWO_HAND_TRANSITION_MIN_DURATION_MS &&
              duration <= TWO_HAND_TRANSITION_MAX_DURATION_MS &&
              tht.startDistanceX >= GATHER_START_MIN_DISTANCE &&
              distanceX <= GATHER_END_MAX_DISTANCE &&
              delta >= GATHER_DELTA_THRESHOLD &&
              centerDriftX <= TWO_HAND_MAX_CENTER_DRIFT &&
              centerDriftY <= TWO_HAND_MAX_VERTICAL_DRIFT &&
              !inCooldown;

            if (conditionsMet) {
              tht.lastTransitionAt = chronoNow;
              tht.lastTransitionType = 'exitChrono';
              tht.tracking = false;
              onExitChronoGestureRef.current?.();
              transitionTriggered = true;
            } else if (duration > TWO_HAND_TRANSITION_MAX_DURATION_MS) {
              tht.tracking = false;
            }
          }

          // Update debug info
          if (tht.tracking) {
            const progress = Math.min(1, Math.max(0, (tht.startDistanceX - distanceX) / GATHER_DELTA_THRESHOLD));
            const cdR = Math.max(0, Math.ceil((TWO_HAND_TRANSITION_COOLDOWN_MS - (chronoNow - tht.lastTransitionAt)) / 100) / 10);
            twoHandDebug.current = {
              twoHandsDetected: true,
              twoHandDistanceX: Math.round(distanceX * 100) / 100,
              twoHandStartDistanceX: Math.round(tht.startDistanceX * 100) / 100,
              twoHandDurationMs: Math.round(chronoNow - tht.startTime),
              twoHandTransitionType: 'gather',
              twoHandProgress: Math.round(progress * 100) / 100,
              twoHandCooldownRemaining: cdR,
              twoHandBlockReason: tht.blockReason,
            };
            emitTwoHandState(chronoNow);
          } else if (distanceX >= GATHER_START_MIN_DISTANCE && enabled) {
            twoHandDebug.current = {
              twoHandsDetected: true,
              twoHandDistanceX: Math.round(distanceX * 100) / 100,
              twoHandStartDistanceX: 0,
              twoHandDurationMs: 0,
              twoHandTransitionType: 'gather',
              twoHandProgress: 0,
              twoHandCooldownRemaining: Math.max(0, Math.ceil((TWO_HAND_TRANSITION_COOLDOWN_MS - (chronoNow - tht.lastTransitionAt)) / 100) / 10),
              twoHandBlockReason: tht.blockReason,
            };
            emitTwoHandState(chronoNow);
          }

          if (transitionTriggered) {
            setGestureStatus('Gather: returning to Constellation');
            return; // skip chrono swipe/pinch this frame
          }
        } else if (twoHandTransition.current.tracking) {
          twoHandTransition.current.tracking = false;
          twoHandDebug.current = {
            ...twoHandDebug.current,
            twoHandsDetected: false,
            twoHandTransitionType: 'none',
            twoHandBlockReason: 'one hand only',
          };
          emitTwoHandState(chronoNow);
        }

        // Reset two-hand debug when not tracking gather
        if (!twoHandTransition.current.tracking && allLandmarks && allLandmarks.length < 2) {
          twoHandDebug.current = {
            ...twoHandDebug.current,
            twoHandsDetected: false,
            twoHandTransitionType: 'none',
            twoHandBlockReason: 'one hand only',
          };
          emitTwoHandState(chronoNow);
        }

        // --- Chromo Pinch Detection ---
        const checkPinch = (h: any[]): number => {
          const w = h[0], tTip = h[4], iTip = h[8], mMcp = h[9];
          const pd = Math.hypot(tTip.x - iTip.x, tTip.y - iTip.y);
          const palm = Math.hypot(w.x - mMcp.x, w.y - mMcp.y);
          return palm === 0 ? 999 : pd / palm;
        };
        const areNonPinchFingersExtended = (h: any[]): boolean => {
          const w = h[0];
          const checks: [number, number][] = [[12, 9], [16, 13], [20, 17]];
          let extended = 0;
          for (const [tipIdx, baseIdx] of checks) {
            const dt = Math.hypot(h[tipIdx].x - w.x, h[tipIdx].y - w.y);
            const db = Math.hypot(h[baseIdx].x - w.x, h[baseIdx].y - w.y);
            if (dt > db * 1.3) extended++;
          }
          return extended >= 2;
        };
        let bestRatio = 999;
        let pinchHand: any[] | null = null;
        const hands = (allLandmarks && allLandmarks.length > 0) ? allLandmarks : [landmarks];
        for (const h of hands) {
          const r = checkPinch(h);
          if (r < bestRatio) { bestRatio = r; pinchHand = h; }
        }
        const rawPinchChrono = bestRatio < PINCH_RATIO_THRESHOLD;
        const chronoPinchDetected = rawPinchChrono && pinchHand !== null && areNonPinchFingersExtended(pinchHand);

        const cps = chronoPinchState.current;
        let chronoBlockReason = 'none';
        let shouldChronoPinch = false;
        if (!chronoGestureEnabledRef.current) chronoBlockReason = 'chrono gestures disabled';
        else if (!hasChronoFocusMemoryRef.current) chronoBlockReason = 'no chrono focus memory';
        else if (!onChronoPinchOpenRef.current) chronoBlockReason = 'no callback';
        else shouldChronoPinch = true;

        if (chronoPinchDetected && shouldChronoPinch) {
          if (!cps.pinching) { cps.pinching = true; cps.pinchSince = chronoNow; cps.pinchTriggered = false; }
          const dur = chronoNow - cps.pinchSince;
          if (dur >= PINCH_HOLD_MS && !cps.pinchTriggered && (chronoNow - cps.lastPinchTriggeredAt) >= PINCH_COOLDOWN_MS) {
            cps.pinchTriggered = true;
            cps.lastPinchTriggeredAt = chronoNow;
            onChronoPinchOpenRef.current();
          }
        } else if (chronoPinchDetected && !shouldChronoPinch) {
          if (!cps.pinching) cps.pinching = true;
        } else {
          if (cps.pinching) { cps.pinching = false; cps.pinchSince = 0; cps.pinchTriggered = false; }
        }

        // --- Chrono Swipe Detection ---
        const ss = swipeState.current;
        const nowMs = chronoNow;
        // Prune old history entries
        ss.palmHistory = ss.palmHistory.filter(e => nowMs - e.time < SWIPE_HISTORY_MAX_AGE_MS);
        // Add current palm center
        ss.palmHistory.push({ x: palmCenterX, y: palmCenterY, time: nowMs });

        let swipeDirection: 'none' | 'left' | 'right' = 'none';
        let swipeDetected = false;

        if (chronoGestureEnabledRef.current && ss.palmHistory.length >= 2) {
          const first = ss.palmHistory[0];
          const last = ss.palmHistory[ss.palmHistory.length - 1];
          const dx = last.x - first.x;
          const dy = last.y - first.y;
          const duration = last.time - first.time;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          const inCooldown = (nowMs - ss.lastSwipeTriggeredAt) < SWIPE_COOLDOWN_MS;

          if (!inCooldown && absDx >= SWIPE_MIN_DISTANCE && duration >= SWIPE_MIN_DURATION_MS && duration <= SWIPE_MAX_DURATION_MS && absDy < SWIPE_MAX_VERTICAL_DRIFT) {
            if (dx < 0) {
              swipeDirection = INVERT_CHRONO_SWIPE ? 'right' : 'left';
            } else {
              swipeDirection = INVERT_CHRONO_SWIPE ? 'left' : 'right';
            }
            swipeDetected = true;

            if (swipeDirection === 'left' && onChronoSwipeLeftRef.current) {
              onChronoSwipeLeftRef.current();
            } else if (swipeDirection === 'right' && onChronoSwipeRightRef.current) {
              onChronoSwipeRightRef.current();
            }
            ss.lastSwipeTriggeredAt = nowMs;
            ss.palmHistory = []; // Reset history after swipe
          }
        }

        // Debug HUD update for chrono mode
        if (DEBUG_GESTURES && chronoNow - lastDebugRender.current > DEBUG_HUD_INTERVAL_MS) {
          lastDebugRender.current = chronoNow;
          const cdR = Math.max(0, Math.ceil((PINCH_COOLDOWN_MS - (chronoNow - cps.lastPinchTriggeredAt)) / 100) / 10);
          const swipeCdR = Math.max(0, Math.ceil((SWIPE_COOLDOWN_MS - (chronoNow - ss.lastSwipeTriggeredAt)) / 100) / 10);
          const td = twoHandDebug.current;
          setDebugInfo({
            candidate: hasChronoFocusMemoryRef.current,
            pinchRatio: Math.round(bestRatio * 100) / 100,
            pinchDetected: chronoPinchDetected,
            pinchHoldMs: chronoPinchDetected ? Math.round(chronoNow - cps.pinchSince) : 0,
            pinchCooldownRemaining: cdR,
            lastBlockReason: chronoPinchDetected && !shouldChronoPinch ? chronoBlockReason : 'none',
            modalOpen: false,
            modalCloseFist: false,
            modalCloseHoldMs: 0,
            modalGraceRemaining: 0,
            modalCloseCdRemaining: swipeCdR,
            modalCloseBlockReason: 'none',
            // v0.5 two-hand fields
            twoHandsDetected: td.twoHandsDetected,
            twoHandDistanceX: td.twoHandDistanceX,
            twoHandStartDistanceX: td.twoHandStartDistanceX,
            twoHandDurationMs: td.twoHandDurationMs,
            twoHandTransitionType: td.twoHandTransitionType,
            twoHandProgress: td.twoHandProgress,
            twoHandCooldownRemaining: td.twoHandCooldownRemaining,
            twoHandBlockReason: td.twoHandBlockReason,
            // v0.5.3 hand orbit debug (inactive in chrono mode)
            handOrbitMode: 'inactive (chrono)',
            handPalmX: 0.5,
            handPalmY: 0.5,
            handOrbitActive: false,
          });
        }

        // Chrono gesture status text
        if (cps.pinching) {
          setGestureStatus(`Chrono Pinch ${Math.round(chronoNow - cps.pinchSince)}ms / ${PINCH_HOLD_MS}ms`);
        } else if (swipeDetected) {
          setGestureStatus(`Chrono Swipe: ${swipeDirection}`);
        } else if (twoHandTransition.current.tracking) {
          const td = twoHandDebug.current;
          setGestureStatus(`Gather progress ${Math.round(td.twoHandProgress * 100)}%`);
        } else {
          setGestureStatus('Chrono: Swipe ↔ · Pinch to open');
        }
        return; // CHRONO branch done
      }

      // ======================================================================
      // BELOW: Original starfield gesture logic (non-CHRONO_STREAM mode only)
      // ======================================================================

      const now = performance.now();

      // v0.4.1: If disableGestureActions is set and we somehow got here (non-chrono),
      // bail out (backward compat safety net)
      if (disableActionsRef.current) {
        setGestureStatus('Gestures paused');
        return;
      }

      // v0.5: FORMED mode — no two-hand transition allowed
      if (currentModeRef.current === TreeMode.FORMED) {
        // Reset two-hand tracking if we're in FORMED
        if (twoHandTransition.current.tracking) {
          twoHandTransition.current.tracking = false;
        }
        twoHandDebug.current = {
          ...twoHandDebug.current,
          twoHandsDetected: false,
          twoHandTransitionType: 'none',
          twoHandBlockReason: 'not chaos',
        };
        emitTwoHandState(now);
      }

      // ======================================================================
      // v0.5: TWO-HAND SPREAD → enter Chrono Stream (CHAOS only)
      // ======================================================================
      let spreadTransitionTriggered = false;
      if (currentModeRef.current === TreeMode.CHAOS && allLandmarks && allLandmarks.length >= 2) {
        const tht = twoHandTransition.current;
        // Compute palm centers for each hand
        const centers = allLandmarks.map((h: any[]) => {
          const w = h[0], iMcp = h[5], pMcp = h[17];
          return {
            x: (w.x + iMcp.x + pMcp.x) / 3,
            y: (w.y + iMcp.y + pMcp.y) / 3,
          };
        });
        const a = centers[0], b = centers[1];
        const leftH = a.x < b.x ? a : b;
        const rightH = a.x < b.x ? b : a;
        const distanceX = rightH.x - leftH.x;
        const centerX = (leftH.x + rightH.x) / 2;
        const centerY = (leftH.y + rightH.y) / 2;

        const enabled = chronoTransitionGestureEnabledRef.current
          && !modalOpenRef.current;

        // Start tracking spread candidate
        if (!tht.tracking && enabled) {
          if (distanceX <= SPREAD_START_MAX_DISTANCE) {
            tht.tracking = true;
            tht.startDistanceX = distanceX;
            tht.startCenterX = centerX;
            tht.startCenterY = centerY;
            tht.startTime = now;
            tht.blockReason = 'none';
          } else {
            tht.blockReason = 'start too wide';
          }
        }

        // Continue tracking
        if (tht.tracking && enabled) {
          const duration = now - tht.startTime;
          const delta = distanceX - tht.startDistanceX;
          const centerDriftX = Math.abs(centerX - tht.startCenterX);
          const centerDriftY = Math.abs(centerY - tht.startCenterY);
          const inCooldown = (now - tht.lastTransitionAt) < TWO_HAND_TRANSITION_COOLDOWN_MS;

          const conditionsMet =
            duration >= TWO_HAND_TRANSITION_MIN_DURATION_MS &&
            duration <= TWO_HAND_TRANSITION_MAX_DURATION_MS &&
            tht.startDistanceX <= SPREAD_START_MAX_DISTANCE &&
            distanceX >= SPREAD_END_MIN_DISTANCE &&
            delta >= SPREAD_DELTA_THRESHOLD &&
            centerDriftX <= TWO_HAND_MAX_CENTER_DRIFT &&
            centerDriftY <= TWO_HAND_MAX_VERTICAL_DRIFT &&
            !inCooldown;

          if (conditionsMet) {
            tht.lastTransitionAt = now;
            tht.lastTransitionType = 'enterChrono';
            tht.tracking = false;
            onEnterChronoGestureRef.current?.();
            spreadTransitionTriggered = true;
          } else if (duration > TWO_HAND_TRANSITION_MAX_DURATION_MS) {
            tht.tracking = false;
          }
        }

        // Update debug info
        if (tht.tracking) {
          const progress = Math.min(1, Math.max(0, (distanceX - tht.startDistanceX) / SPREAD_DELTA_THRESHOLD));
          const cdR = Math.max(0, Math.ceil((TWO_HAND_TRANSITION_COOLDOWN_MS - (now - tht.lastTransitionAt)) / 100) / 10);
          twoHandDebug.current = {
            twoHandsDetected: true,
            twoHandDistanceX: Math.round(distanceX * 100) / 100,
            twoHandStartDistanceX: Math.round(tht.startDistanceX * 100) / 100,
            twoHandDurationMs: Math.round(now - tht.startTime),
            twoHandTransitionType: 'spread',
            twoHandProgress: Math.round(progress * 100) / 100,
            twoHandCooldownRemaining: cdR,
            twoHandBlockReason: tht.blockReason,
          };
          emitTwoHandState(now);
        } else if (distanceX <= SPREAD_START_MAX_DISTANCE && enabled) {
          twoHandDebug.current = {
            twoHandsDetected: true,
            twoHandDistanceX: Math.round(distanceX * 100) / 100,
            twoHandStartDistanceX: 0,
            twoHandDurationMs: 0,
            twoHandTransitionType: 'spread',
            twoHandProgress: 0,
            twoHandCooldownRemaining: Math.max(0, Math.ceil((TWO_HAND_TRANSITION_COOLDOWN_MS - (now - tht.lastTransitionAt)) / 100) / 10),
            twoHandBlockReason: tht.blockReason,
          };
          emitTwoHandState(now);
        }
      } else if (twoHandTransition.current.tracking) {
        twoHandTransition.current.tracking = false;
        twoHandDebug.current = {
          ...twoHandDebug.current,
          twoHandsDetected: false,
          twoHandTransitionType: 'none',
          twoHandBlockReason: 'one hand only',
        };
        emitTwoHandState(now);
      }

      // v0.5: If spread triggered, skip all other starfield gestures this frame
      if (spreadTransitionTriggered) {
        setGestureStatus('Spread: entering Chrono Stream');
        return;
      }

      // v0.5: Two hands active in CHAOS — suppress pinch/open/fist, wait for spread
      if (currentModeRef.current === TreeMode.CHAOS && allLandmarks && allLandmarks.length >= 2) {
        if (twoHandTransition.current.tracking) {
          const td = twoHandDebug.current;
          setGestureStatus(`Spread progress ${Math.round(td.twoHandProgress * 100)}%`);
        } else {
          setGestureStatus('Two hands: spread apart to enter time stream');
        }
        return;
      }

      // ======================================================================
      // v0.3.1-lite: PINCH DETECTION — runs FIRST, independent of open/fist
      // ======================================================================
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
        const td = twoHandDebug.current;
        const navActive = gestureNavigationEnabledRef.current && !suppressNav;
        setDebugInfo(prev => ({
          ...prev,
          candidate: hasCandidatePhotoRef.current,
          pinchRatio: Math.round(bestRatio*100)/100,
          pinchDetected: anyPinch,
          pinchHoldMs: anyPinch?Math.round(now-ps.pinchSince):0,
          pinchCooldownRemaining: cdR,
          lastBlockReason: anyPinch&&!shouldPinch?blockReason:'none',
          modalOpen: false,
          modalCloseFist: false,
          modalCloseHoldMs: 0,
          modalGraceRemaining: 0,
          modalCloseCdRemaining: 0,
          modalCloseBlockReason: 'none',
          // v0.5 two-hand fields
          twoHandsDetected: td.twoHandsDetected,
          twoHandDistanceX: td.twoHandDistanceX,
          twoHandStartDistanceX: td.twoHandStartDistanceX,
          twoHandDurationMs: td.twoHandDurationMs,
          twoHandTransitionType: td.twoHandTransitionType,
          twoHandProgress: td.twoHandProgress,
          twoHandCooldownRemaining: td.twoHandCooldownRemaining,
          twoHandBlockReason: td.twoHandBlockReason,
          // v0.5.3 hand orbit debug
          handOrbitMode: 'relative',
          handPalmX: Math.round(palmCenterX * 1000) / 1000,
          handPalmY: Math.round(palmCenterY * 1000) / 1000,
          handOrbitActive: navActive,
        }));
      }

      // ======================================================================
      // v0.3.2: MODAL CLOSE FIST — only gesture active when modal is open
      // ======================================================================
      if (modalOpenRef.current) {
        const mcs = modalCloseState.current;
        let mCloseBlockReason = 'none';
        let shouldAttemptClose = false;

        // Compute fist inline (don't depend on rawGesture which is declared later)
        const ftCheck = [8, 12, 16, 20], fbCheck = [5, 9, 13, 17];
        let extF = 0;
        for (let i = 0; i < 4; i++) {
          const dt = Math.hypot(landmarks[ftCheck[i]].x - wrist.x, landmarks[ftCheck[i]].y - wrist.y);
          const db = Math.hypot(landmarks[fbCheck[i]].x - wrist.x, landmarks[fbCheck[i]].y - wrist.y);
          if (dt > db * 1.5) extF++;
        }
        const dtThumb = Math.hypot(landmarks[4].x - wrist.x, landmarks[4].y - wrist.y);
        const dbThumb = Math.hypot(landmarks[2].x - wrist.x, landmarks[2].y - wrist.y);
        if (dtThumb > dbThumb * 1.2) extF++;
        const isFistNow = extF <= 1;

        // Check gate conditions
        const graceElapsed = (now - modalOpenedAtRef.current) >= MODAL_OPEN_GRACE_MS;
        if (!onModalCloseGestureRef.current) mCloseBlockReason = 'callback missing';
        else if (!graceElapsed) mCloseBlockReason = 'grace period';
        else shouldAttemptClose = true;

        if (isFistNow && shouldAttemptClose) {
          if (mcs.fistSince === 0) mcs.fistSince = now;
          mcs.closeTriggered = false;
          const fistDur = now - mcs.fistSince;
          const inCd = (now - mcs.lastCloseTriggeredAt) < MODAL_CLOSE_COOLDOWN_MS;
          if (fistDur >= MODAL_CLOSE_FIST_HOLD_MS && !inCd && !mcs.closeTriggered) {
            mcs.closeTriggered = true;
            mcs.lastCloseTriggeredAt = now;
            onModalCloseGestureRef.current();
          }
        } else if (isFistNow && !shouldAttemptClose) {
          if (mcs.fistSince === 0) mcs.fistSince = now;
        } else {
          if (mcs.fistSince !== 0) { mcs.fistSince = 0; mcs.closeTriggered = false; }
        }

        // Modal debug HUD row + status + skip everything else
        if (DEBUG_GESTURES) {
          const mGraceR = Math.max(0, Math.ceil((MODAL_OPEN_GRACE_MS - (now - modalOpenedAtRef.current)) / 100) / 10);
          const mCdR = Math.max(0, Math.ceil((MODAL_CLOSE_COOLDOWN_MS - (now - mcs.lastCloseTriggeredAt)) / 100) / 10);
          setDebugInfo(prev => ({
            ...prev,
            modalOpen: true,
            modalCloseFist: isFistNow,
            modalCloseHoldMs: isFistNow ? Math.round(now - mcs.fistSince) : 0,
            modalGraceRemaining: mGraceR,
            modalCloseCdRemaining: mCdR,
            modalCloseBlockReason: isFistNow && !shouldAttemptClose ? mCloseBlockReason : 'none',
            // v0.5: modal blocks two-hand transitions
            twoHandsDetected: false,
            twoHandTransitionType: 'none' as TwoHandTransitionType,
            twoHandBlockReason: 'modal open',
          }));
        }

        if (isFistNow) {
          const fistDur = now - mcs.fistSince;
          const graceElapsedNow = (now - modalOpenedAtRef.current) >= MODAL_OPEN_GRACE_MS;
          if (!graceElapsedNow) {
            setGestureStatus(`Modal grace ${Math.round((MODAL_OPEN_GRACE_MS-(now-modalOpenedAtRef.current))/100)/10}s...`);
          } else {
            setGestureStatus(`Fist to close ${Math.round(fistDur)}ms / ${MODAL_CLOSE_FIST_HOLD_MS}ms`);
          }
        } else {
          setGestureStatus('Fist hold to close modal');
        }
        return; // SKIP open/fist mode switch entirely
      } else {
        // Not in modal mode — reset modal close state
        const mcs = modalCloseState.current;
        if (mcs.fistSince !== 0) { mcs.fistSince = 0; mcs.closeTriggered = false; }
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

      // v0.3.2: Post-modal grace — suppress fist if modal was just closed;
      // reset early if user opens hand (they're now intentionally navigating)
      const inPostModalGrace = modalClosedAtRef.current > 0 && (now - modalClosedAtRef.current) < POST_MODAL_GRACE_MS;
      if (inPostModalGrace && isOpen) {
        modalClosedAtRef.current = 0; // user opened hand → cancel grace
      }

      // 5. Trigger fist → FORMED (gather memory core)
      if (isFist && heldLongEnough && notYetTriggered && !inCooldown && !inPostModalGrace && currentModeNow !== targetModeFist) {
        hs.triggerConsumed = true;
        hs.lastTriggeredAt = now;
        hs.lastTriggeredGesture = 'fist';
        onModeChange(targetModeFist);
        setGestureStatus('Gathered: Memory Core');
      }

      // --- v0.3.1-lite: Status text (pinch takes display priority) ---
      if (ps.pinching) {
        setGestureStatus(`Pinch ${Math.round(now-ps.pinchSince)}ms / ${PINCH_HOLD_MS}ms`);
      } else if (twoHandTransition.current.tracking) {
        const td = twoHandDebug.current;
        setGestureStatus(`Spread progress ${Math.round(td.twoHandProgress * 100)}%`);
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

      {/* v0.3.2: Pinch + Modal Close Debug HUD */}
      {DEBUG_GESTURES && (
        <div className="mt-2 w-[18.75vw] pointer-events-auto">
          <div className="bg-black/70 backdrop-blur-sm border border-[#D4AF37]/20 rounded p-2 text-right">
            {/* v0.4.4: Chrono mode indicator */}
            <p className="text-[10px] text-[#D4AF37]/50 font-mono leading-tight">
              mode: {currentMode === TreeMode.CHRONO_STREAM ? 'CHRONO' : currentMode === TreeMode.CHAOS ? 'CHAOS' : 'FORMED'}
            </p>
            {/* v0.5.3: Hand orbit debug */}
            <div className="mt-1 pt-1 border-t border-[#D4AF37]/10">
              <p className="text-[10px] text-[#D4AF37]/50 font-mono leading-tight">
                orbit: {debugInfo.handOrbitMode}
                {' | '}active: {debugInfo.handOrbitActive ? 'YES' : 'no'}
              </p>
              <p className="text-[10px] text-[#D4AF37]/40 font-mono leading-tight">
                palm: ({debugInfo.handPalmX}, {debugInfo.handPalmY})
              </p>
            </div>
            {/* v0.5: Two-hand transition debug */}
            <div className="mt-1 pt-1 border-t border-[#D4AF37]/10">
              <p className="text-[10px] text-[#D4AF37]/50 font-mono leading-tight">
                2hands: {debugInfo.twoHandsDetected ? 'YES' : 'no'}
                {' | '}type: {debugInfo.twoHandTransitionType}
                {' | '}dist: {debugInfo.twoHandDistanceX}
              </p>
              <p className="text-[10px] text-[#D4AF37]/40 font-mono leading-tight">
                start: {debugInfo.twoHandStartDistanceX}
                {' | '}dur: {debugInfo.twoHandDurationMs}ms
                {' | '}prog: {Math.round(debugInfo.twoHandProgress * 100)}%
              </p>
              <p className="text-[10px] text-[#D4AF37]/40 font-mono leading-tight">
                cd: {debugInfo.twoHandCooldownRemaining}s
                {debugInfo.twoHandBlockReason !== 'none' && (
                  <span className="text-red-400/60">{' | '}BLOCK: {debugInfo.twoHandBlockReason}</span>
                )}
              </p>
            </div>
            {debugInfo.modalOpen && (
              <>
                <p className="text-[10px] text-[#D4AF37]/60 font-mono leading-tight">
                  modal: YES
                  {' | '}fist: {debugInfo.modalCloseFist ? 'YES' : 'no'}
                  {' | '}hold: {debugInfo.modalCloseHoldMs}/{MODAL_CLOSE_FIST_HOLD_MS}ms
                </p>
                <p className="text-[10px] text-[#D4AF37]/40 font-mono leading-tight">
                  grace: {debugInfo.modalGraceRemaining}s
                  {' | '}cd: {debugInfo.modalCloseCdRemaining}s
                  {debugInfo.modalCloseBlockReason !== 'none' && (
                    <span className="text-red-400/60">{' | '}BLOCK: {debugInfo.modalCloseBlockReason}</span>
                  )}
                </p>
              </>
            )}
            {!debugInfo.modalOpen && (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
