
import React, { useRef } from 'react';
import { Environment, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useFrame } from '@react-three/fiber';
import { Foliage } from './Foliage';
import { Ornaments } from './Ornaments';
import { Polaroids } from './Polaroids';
import { TreeStar } from './TreeStar';
import { TreeMode } from '../types';

interface ExperienceProps {
  mode: TreeMode;
  handPosition: { x: number; y: number; detected: boolean };
  uploadedPhotos: string[];
  twoHandsDetected: boolean;
  onClosestPhotoChange?: (photoUrl: string | null) => void;
}

export const Experience: React.FC<ExperienceProps> = ({ mode, handPosition, uploadedPhotos, twoHandsDetected, onClosestPhotoChange }) => {
  const controlsRef = useRef<any>(null);

  // Update camera rotation based on hand position
  useFrame((_, delta) => {
    if (controlsRef.current && handPosition.detected) {
      const controls = controlsRef.current;
      
      // Map hand position to spherical coordinates
      // x: 0 (left) to 1 (right) -> azimuthal angle (horizontal rotation)
      // y: 0 (top) to 1 (bottom) -> polar angle (vertical tilt)
      
      // Target azimuthal angle: increased range for larger rotation
      const targetAzimuth = (handPosition.x - 0.5) * Math.PI * 3; // Increased from 2 to 3
      
      // Adjust Y mapping so natural hand position gives best view
      // Offset Y so hand at 0.4-0.5 range gives centered view
      const adjustedY = (handPosition.y - 0.2) * 2.0; // Increased sensitivity from 1.5 to 2.0
      const clampedY = Math.max(0, Math.min(1, adjustedY)); // Clamp to 0-1
      
      // Target polar angle: PI/4 to PI/1.8 (constrained vertical angle)
      const minPolar = Math.PI / 4;
      const maxPolar = Math.PI / 1.8;
      const targetPolar = minPolar + clampedY * (maxPolar - minPolar);
      
      // Get current angles
      const currentAzimuth = controls.getAzimuthalAngle();
      const currentPolar = controls.getPolarAngle();
      
      // Calculate angle differences (handle wrapping for azimuth)
      let azimuthDiff = targetAzimuth - currentAzimuth;
      if (azimuthDiff > Math.PI) azimuthDiff -= Math.PI * 2;
      if (azimuthDiff < -Math.PI) azimuthDiff += Math.PI * 2;
      
      // Smoothly interpolate angles
      const lerpSpeed = 8; // Increased from 5 to 8 for faster response
      const newAzimuth = currentAzimuth + azimuthDiff * delta * lerpSpeed;
      const newPolar = currentPolar + (targetPolar - currentPolar) * delta * lerpSpeed;
      
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
        enabled={true}
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

      <group position={[0, 0, 0]}>
        <Foliage mode={mode} count={12000} />
        <Ornaments mode={mode} count={600} />
        <Polaroids mode={mode} uploadedPhotos={uploadedPhotos} twoHandsDetected={twoHandsDetected} onClosestPhotoChange={onClosestPhotoChange} />
        {/* <TreeStar mode={mode} /> */}
      </group>

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
