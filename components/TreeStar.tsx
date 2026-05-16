import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

/**
 * ==================================================================================
 *  MEMORY CORE
 * ==================================================================================
 * Formerly TreeStar. Now the central luminous core of the Memory Nebula.
 * 
 * In FORMED state (Memory Core aggregated), this is the glowing heart 
 * at the center of the nebula sphere [0, 0, 0].
 * Features: warm gold center, blue/violet halo, subtle orbital rings, slow rotation.
 */

interface TreeStarProps {
  mode: TreeMode;
}

export const TreeStar: React.FC<TreeStarProps> = ({ mode }) => {
  const coreRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const innerGlowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Memory Core: warm champagne gold center sphere
  const targetFormedPos = new THREE.Vector3(0, 0, 0); // Center of nebula
  const chaosPos = new THREE.Vector3(
    Math.random() * 20 - 10,
    8 + Math.random() * 8,
    Math.random() * 20 - 10
  );

  useFrame((state, delta) => {
    if (!coreRef.current) return;

    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;

    // Position animation
    const targetPos = isFormed ? targetFormedPos : chaosPos;
    coreRef.current.position.lerp(targetPos, delta * 1.5);

    // Rotation animation
    if (isFormed) {
      // Very slow rotation and gentle breathing float
      coreRef.current.rotation.y += delta * 0.15;
      coreRef.current.rotation.x = Math.sin(time * 0.3) * 0.05;
      coreRef.current.position.y = Math.sin(time * 0.7) * 0.08;
    } else {
      // Gentle drift in chaos mode
      coreRef.current.rotation.x += delta * 1.5;
      coreRef.current.rotation.y += delta * 2;
    }

    // Inner glow pulsation
    if (innerGlowRef.current) {
      const material = innerGlowRef.current.material as THREE.MeshStandardMaterial;
      const pulse = 1.5 + Math.sin(time * 2.5) * 0.4;
      material.emissiveIntensity = pulse;
    }

    // Pulsating light
    if (lightRef.current) {
      const pulse = 2.5 + Math.sin(time * 2) * 0.8;
      lightRef.current.intensity = pulse;
    }
  });

  return (
    <group ref={coreRef} position={[0, 0, 0]}>
      {/* Inner luminous core - warm champagne gold */}
      <mesh ref={innerGlowRef}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color="#F5E6BF"
          emissive="#D4AF37"
          emissiveIntensity={1.5}
          metalness={0.2}
          roughness={0.1}
          toneMapped={false}
        />
      </mesh>

      {/* Outer glowing halo - violet/blue nebula aura */}
      <mesh>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshStandardMaterial
          color="#6B5B95"
          emissive="#4A3B6E"
          emissiveIntensity={0.6}
          metalness={0.1}
          roughness={0.3}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Subtle orbital ring 1 - champagne gold */}
      <mesh rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[0.7, 0.015, 16, 64]} />
        <meshStandardMaterial
          color="#D4AF37"
          emissive="#D4AF37"
          emissiveIntensity={0.8}
          metalness={0.9}
          roughness={0.1}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>

      {/* Subtle orbital ring 2 - pale blue, tilted differently */}
      <mesh rotation={[Math.PI / 1.6, Math.PI / 4, 0]}>
        <torusGeometry args={[0.8, 0.01, 16, 64]} />
        <meshStandardMaterial
          color="#A8C8E8"
          emissive="#88CCEE"
          emissiveIntensity={0.5}
          metalness={0.7}
          roughness={0.2}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Point Light for glow effect */}
      <pointLight
        ref={lightRef}
        color="#D4AF37"
        intensity={2.5}
        distance={8}
        decay={2}
      />
    </group>
  );
};

