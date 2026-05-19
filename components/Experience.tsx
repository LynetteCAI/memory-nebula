
import React, { useRef, useEffect } from 'react';
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

  // v0.4.1: Initialize camera to fixed position when entering Chrono Stream
  useEffect(() => {
    if (!isChrono || !controlsRef.current) return;
    const controls = controlsRef.current;
    // Set a stable, centered view for the time river
    camera.position.set(0, 1.2, 9);
    controls.target.set(0, 0, -1);
    controls.update();
  }, [isChrono, camera]);

  // v0.5.3: Relative drag-based hand orbit (replaces absolute position mapping)
  useFrame((_, delta) => {
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
        enabled={!isChrono}
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

      {/* v0.4.1: Background layer — Foliage & Ornaments shift back in Chrono Stream */}
      <group
        position={isChrono ? [0, 0, -12] : [0, 0, 0]}
        scale={isChrono ? 1.35 : 1}
      >
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
        />
        {/* <TreeStar mode={mode} /> */}
        
        {/* v0.4: Chrono Stream time ribbon */}
        {mode === TreeMode.CHRONO_STREAM && (
          <ChronoStreamRibbon memoryCount={uploadedPhotos.length} />
        )}

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
