
import React, { useRef, useEffect, useState } from 'react';
import { Environment, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Foliage } from './Foliage';
import { Ornaments } from './Ornaments';
import { Polaroids } from './Polaroids';
import { TreeStar } from './TreeStar';
import { ChronoStreamRibbon } from './ChronoStreamRibbon';
import { TreeMode, MemoryPhoto } from '../types';

// ---------------------------------------------------------------------------
// v0.5.3 Relative Hand Orbit Constants
// ---------------------------------------------------------------------------

/** Minimum hand delta before orbit rotation kicks in (filters jitter) */
const HAND_DRAG_DEAD_DELTA = 0.003;

/** Horizontal rotation speed multiplier */
const HAND_DRAG_AZIMUTH_SPEED = Math.PI * 2.4;

/** Vertical rotation speed multiplier */
const HAND_DRAG_POLAR_SPEED = Math.PI * 1.2;

/** Exponential damping factor for camera follow (higher = snappier) */
const HAND_ORBIT_DAMPING = 8.0;

/** Invert horizontal orbit direction if needed */
const INVERT_HAND_ORBIT_X = false;

/** Invert vertical orbit direction if needed */
const INVERT_HAND_ORBIT_Y = false;

/** Polar angle limits to prevent camera flip */
const MIN_POLAR = Math.PI / 5;       // ~36°
const MAX_POLAR = Math.PI * 0.86;    // ~155°

// ---------------------------------------------------------------------------
// v0.5.4: Chrono Transition Smoothing constants
// ---------------------------------------------------------------------------

/** Duration of the camera fly transition (ms) */
const CAMERA_TRANSITION_MS = 800;

/** Speed factor for background group lerp */
const BG_LERP_SPEED = 3.0;

/** Speed factor for chrono visual progress lerp */
const CHRONO_PROGRESS_SPEED = 3.5;

/** Ease-in-out cubic for smooth camera fly-through */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------------------

interface ExperienceProps {
  mode: TreeMode;
  handPosition: { x: number; y: number; detected: boolean };
  uploadedPhotos: string[];
  twoHandsDetected: boolean;
  /** v0.3: MemoryPhoto objects for click-to-open */
  memories?: MemoryPhoto[];
  /** v0.3/v0.3.1: Called when a polaroid is clicked to open the modal */
  onPhotoSelect?: (photo: MemoryPhoto) => void;
  /** v0.3: ID of the photo focused by two-hand detection (legacy) */
  focusedPhotoId?: string | null;
  /** v0.3: Two-hand focus updates this callback (legacy) */
  onFocusedPhotoIdChange?: (id: string | null) => void;
  /** v0.3.1: ID of the screen-center candidate photo */
  candidatePhotoId?: string | null;
  /** v0.3.1: Called when candidate photo changes */
  onCandidatePhotoChange?: (photo: MemoryPhoto | null) => void;
  /** v0.3.1: ID of the gesture-locked photo */
  lockedPhotoId?: string | null;
  /** v0.3.1: Pause candidate updates when modal is open */
  pauseSelection?: boolean;
  /** v0.4: Current focus index for Chrono Stream time river */
  focusIndex?: number;
  /** v0.5.5: Nebula order map — session-shuffled index by memory id */
  nebulaOrderById?: Record<string, number>;
  /** v0.5.5: Chrono order map — date-sorted index by memory id */
  chronoOrderById?: Record<string, number>;
}

export const Experience: React.FC<ExperienceProps> = ({
  mode,
  handPosition,
  uploadedPhotos,
  twoHandsDetected,
  memories,
  onPhotoSelect,
  focusedPhotoId,
  onFocusedPhotoIdChange,
  candidatePhotoId,
  onCandidatePhotoChange,
  lockedPhotoId,
  pauseSelection,
  focusIndex = 0,
  nebulaOrderById,
  chronoOrderById,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const isChrono = mode === TreeMode.CHRONO_STREAM;

  // v0.5.3: Relative hand orbit state — drag-based virtual trackball
  const handOrbitRef = useRef({
    initialized: false,
    lastX: 0.5,
    lastY: 0.5,
    azimuth: 0,
    polar: Math.PI / 2,
  });

  // v0.5.4: Chrono transition smoothing refs
  const backgroundGroupRef = useRef<THREE.Group>(null);
  const chronoVisualProgressRef = useRef(0);
  const cameraTransitionRef = useRef({
    active: false,
    startTime: 0,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(0, 1.2, 9),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(0, 0, -1),
    direction: 'none' as 'toChrono' | 'toNebula' | 'none',
  });
  const nebulaCameraPosRef = useRef(new THREE.Vector3(0, 2, 14));
  const nebulaTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const prevModeRef = useRef<TreeMode>(mode);
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  // v0.5.4: Detect mode changes → trigger camera fly transition
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    const controls = controlsRef.current;
    if (!controls) { prevModeRef.current = mode; return; }

    if (mode === TreeMode.CHRONO_STREAM && prevModeRef.current === TreeMode.CHAOS) {
      // Entering Chrono Stream: record nebula position, start fly transition
      nebulaCameraPosRef.current.copy(camera.position);
      nebulaTargetRef.current.copy(controls.target);

      cameraTransitionRef.current.fromPos.copy(camera.position);
      cameraTransitionRef.current.fromTarget.copy(controls.target);
      cameraTransitionRef.current.toPos.set(0, 1.2, 9);
      cameraTransitionRef.current.toTarget.set(0, 0, -1);
      cameraTransitionRef.current.startTime = performance.now();
      cameraTransitionRef.current.active = true;
      cameraTransitionRef.current.direction = 'toChrono';
      setOrbitEnabled(false);
    }

    if (mode === TreeMode.CHAOS && prevModeRef.current === TreeMode.CHRONO_STREAM) {
      // Exiting Chrono Stream: fly back to recorded nebula position
      cameraTransitionRef.current.fromPos.copy(camera.position);
      cameraTransitionRef.current.fromTarget.copy(controls.target);
      cameraTransitionRef.current.toPos.copy(nebulaCameraPosRef.current);
      cameraTransitionRef.current.toTarget.copy(nebulaTargetRef.current);
      cameraTransitionRef.current.startTime = performance.now();
      cameraTransitionRef.current.active = true;
      cameraTransitionRef.current.direction = 'toNebula';
      setOrbitEnabled(false);
    }

    prevModeRef.current = mode;
  }, [mode, camera]);

  // v0.5.4: Combined useFrame — camera transition, bg lerp, hand orbit
  useFrame((state, delta) => {
    const isChrono = mode === TreeMode.CHRONO_STREAM;
    const ct = cameraTransitionRef.current;

    // --- Camera fly transition (v0.5.4) ---
    if (ct.active) {
      const elapsed = performance.now() - ct.startTime;
      const rawT = Math.min(elapsed / CAMERA_TRANSITION_MS, 1);
      const t = easeInOutCubic(rawT);

      camera.position.lerpVectors(ct.fromPos, ct.toPos, t);

      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(ct.fromTarget, ct.toTarget, t);
        controlsRef.current.update();
      }

      if (rawT >= 1) {
        // Snap to exact target to prevent floating-point drift
        camera.position.copy(ct.toPos);
        if (controlsRef.current) {
          controlsRef.current.target.copy(ct.toTarget);
          controlsRef.current.update();
        }
        ct.active = false;
        if (ct.direction === 'toNebula') {
          setOrbitEnabled(true);
        }
        ct.direction = 'none';
      }
    }

    // --- Chrono visual progress lerp (v0.5.4) ---
    const targetProgress = isChrono ? 1 : 0;
    chronoVisualProgressRef.current = THREE.MathUtils.lerp(
      chronoVisualProgressRef.current,
      targetProgress,
      1 - Math.exp(-delta * CHRONO_PROGRESS_SPEED)
    );

    // --- Background group smooth reposition (v0.5.4) ---
    if (backgroundGroupRef.current) {
      const bg = backgroundGroupRef.current;
      const bgTargetZ = isChrono ? -12 : 0;
      const bgTargetScale = isChrono ? 1.35 : 1;

      bg.position.z = THREE.MathUtils.lerp(bg.position.z, bgTargetZ, 1 - Math.exp(-delta * BG_LERP_SPEED));
      const nextScale = THREE.MathUtils.lerp(bg.scale.x, bgTargetScale, 1 - Math.exp(-delta * BG_LERP_SPEED));
      bg.scale.setScalar(nextScale);
    }

    // --- Hand orbit (skip during camera transition or chrono mode) ---
    if (ct.active) return;
    if (isChrono) return;
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    const ho = handOrbitRef.current;
    const nebulaTarget = new THREE.Vector3(0, 0, 0);

    // When hand is lost, mark uninitialized so re-entry reads current camera
    if (!handPosition.detected) {
      ho.initialized = false;
      return;
    }

    // Skip orbit when two hands are detected (two-hand transition in progress)
    if (twoHandsDetected) {
      ho.initialized = false;
      return;
    }

    // Initialize from current camera position on first detection or re-entry
    if (!ho.initialized) {
      const offset = camera.position.clone().sub(nebulaTarget);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      ho.azimuth = spherical.theta;
      ho.polar = THREE.MathUtils.clamp(spherical.phi, MIN_POLAR, MAX_POLAR);
      ho.lastX = handPosition.x;
      ho.lastY = handPosition.y;
      ho.initialized = true;
      return; // First frame: no rotation, just initialize
    }

    // Calculate hand delta
    let dx = handPosition.x - ho.lastX;
    let dy = handPosition.y - ho.lastY;

    // Apply dead zone to filter jitter
    if (Math.abs(dx) < HAND_DRAG_DEAD_DELTA) dx = 0;
    if (Math.abs(dy) < HAND_DRAG_DEAD_DELTA) dy = 0;

    // Optionally invert direction
    if (INVERT_HAND_ORBIT_X) dx = -dx;
    if (INVERT_HAND_ORBIT_Y) dy = -dy;

    // Accumulate to spherical angles
    if (dx !== 0 || dy !== 0) {
      ho.azimuth -= dx * HAND_DRAG_AZIMUTH_SPEED;
      ho.polar += dy * HAND_DRAG_POLAR_SPEED;
      ho.polar = THREE.MathUtils.clamp(ho.polar, MIN_POLAR, MAX_POLAR);
    }

    // Update last known hand position
    ho.lastX = handPosition.x;
    ho.lastY = handPosition.y;

    // Smoothly move camera to accumulated spherical position
    const radius = camera.position.distanceTo(nebulaTarget);
    const follow = 1 - Math.exp(-delta * HAND_ORBIT_DAMPING);

    const targetSpherical = new THREE.Spherical(radius, ho.polar, ho.azimuth);
    const targetPosition = new THREE.Vector3().setFromSpherical(targetSpherical).add(nebulaTarget);

    camera.position.lerp(targetPosition, follow);
    camera.lookAt(nebulaTarget);

    // Keep OrbitControls in sync
    controls.target.copy(nebulaTarget);
    controls.update();
  });
  return (
    <>
      <OrbitControls 
        ref={controlsRef}
        enablePan={false} 
        minPolarAngle={Math.PI / 6} 
        maxPolarAngle={Math.PI / 1.6}
        minDistance={8}
        maxDistance={35}
        enableDamping
        dampingFactor={0.05}
        enabled={orbitEnabled}
      />

      {/* Lighting Setup for Deep Space Memory Nebula */}
      <Environment preset="night" background={false} blur={0.8} />
      
      <ambientLight intensity={0.25} color="#1a2a4a" /> {/* Deep navy ambient */}
      <spotLight 
        position={[8, 12, 8]} 
        angle={0.3} 
        penumbra={1} 
        intensity={1.8} 
        color="#D4AF37" 
        castShadow 
      />
      <pointLight position={[-8, 3, -8]} intensity={0.8} color="#6B5B95" /> {/* Violet fill */}
      <pointLight position={[5, -2, 5]} intensity={0.5} color="#88CCEE" /> {/* Cyan rim */}

      {/* v0.5.4: Background layer — smooth lerp via ref + useFrame */}
      <group ref={backgroundGroupRef}>
        <Foliage mode={mode} count={12000} />
        <Ornaments mode={mode} count={600} />
      </group>
        <Polaroids
          mode={mode}
          uploadedPhotos={uploadedPhotos}
          twoHandsDetected={twoHandsDetected}
          memories={memories}
          onPhotoSelect={onPhotoSelect}
          focusedPhotoId={focusedPhotoId}
          onFocusedPhotoIdChange={onFocusedPhotoIdChange}
          candidatePhotoId={candidatePhotoId}
          onCandidatePhotoChange={onCandidatePhotoChange}
          lockedPhotoId={lockedPhotoId}
          pauseSelection={pauseSelection}
          focusIndex={focusIndex}
          nebulaOrderById={nebulaOrderById}
          chronoOrderById={chronoOrderById}
        />
        {/* <TreeStar mode={mode} /> */}
        
        {/* v0.5.4: Chrono Stream time ribbon — always mounted, visible toggle to avoid geometry recreation */}
        <ChronoStreamRibbon
          memoryCount={uploadedPhotos.length}
          visible={mode === TreeMode.CHRONO_STREAM}
        />

      <EffectComposer enableNormalPass={false}>
        <Bloom 
          luminanceThreshold={0.8} 
          mipmapBlur 
          intensity={1.5} 
          radius={0.6}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.7} />
        <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    </>
  );
};
