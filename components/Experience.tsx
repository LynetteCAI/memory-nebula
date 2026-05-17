
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

  // v0.4.1: Initialize camera to fixed position when entering Chrono Stream
  useEffect(() => {
    if (!isChrono || !controlsRef.current) return;
    const controls = controlsRef.current;
    // Set a stable, centered view for the time river
    camera.position.set(0, 1.2, 9);
    controls.target.set(0, 0, -1);
    controls.update();
  }, [isChrono, camera]);

  // Update camera rotation based on hand position (v0.4.1: skip in Chrono Stream)
  useFrame((_, delta) => {
    if (isChrono) return;
    if (controlsRef.current && handPosition.detected) {
      const controls = controlsRef.current;
      
      // v0.4.5: Reduced azimuth range for gentler horizontal rotation
      const HAND_AZIMUTH_RANGE = Math.PI * 1.35;
      const targetAzimuth = (handPosition.x - 0.5) * HAND_AZIMUTH_RANGE;
      
      // v0.4.5: Smoother Y mapping — direct norm clamp, no offset
      const yNorm = Math.max(0, Math.min(1, handPosition.y));
      const minPolar = Math.PI / 3.2;
      const maxPolar = Math.PI / 1.75;
      const targetPolar = THREE.MathUtils.lerp(minPolar, maxPolar, yNorm);
      
      // Get current angles
      const currentAzimuth = controls.getAzimuthalAngle();
      const currentPolar = controls.getPolarAngle();
      
      // Calculate angle differences (handle wrapping for azimuth)
      let azimuthDiff = targetAzimuth - currentAzimuth;
      if (azimuthDiff > Math.PI) azimuthDiff -= Math.PI * 2;
      if (azimuthDiff < -Math.PI) azimuthDiff += Math.PI * 2;
      
      // v0.4.5: Exponential easing for smooth camera follow
      const follow = 1 - Math.exp(-delta * 3.5);
      const newAzimuth = currentAzimuth + azimuthDiff * follow;
      const newPolar = currentPolar + (targetPolar - currentPolar) * follow;
      
      // Calculate new camera position in spherical coordinates
      const radius = controls.getDistance();
      const targetY = 0; // Nebula core center
      
      const x = radius * Math.sin(newPolar) * Math.sin(newAzimuth);
      const y = targetY + radius * Math.cos(newPolar);
      const z = radius * Math.sin(newPolar) * Math.cos(newAzimuth);
      
      // Update camera position and target
      controls.object.position.set(x, y, z);
      controls.target.set(0, targetY, 0);
      controls.update();
    }
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
