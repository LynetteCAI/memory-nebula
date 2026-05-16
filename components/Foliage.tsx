import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';
import { getNebulaCorePosition } from '../utils/nebulaLayout';
import { getConstellationDustPosition } from '../utils/constellationLayout';

interface FoliageProps {
  mode: TreeMode;
  count: number;
}

const vertexShader = `
  uniform float uTime;
  uniform float uProgress;
  
  attribute vec3 aChaosPos;
  attribute vec3 aTargetPos;
  attribute float aRandom;
  
  varying vec3 vColor;
  varying float vAlpha;

  // Cubic Ease In Out
  float cubicInOut(float t) {
    return t < 0.5
      ? 4.0 * t * t * t
      : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }

  void main() {
    // Add some individual variation to the progress so they don't all move at once
    float localProgress = clamp(uProgress * 1.2 - aRandom * 0.2, 0.0, 1.0);
    float easedProgress = cubicInOut(localProgress);

    // Interpolate position
    vec3 newPos = mix(aChaosPos, aTargetPos, easedProgress);
    
    // Add subtle drift/breathing for both states
    if (easedProgress > 0.9) {
      // Core state: tighter breathing
      newPos.x += sin(uTime * 1.3 + newPos.y * 1.7 + aRandom * 6.28) * 0.04;
      newPos.y += cos(uTime * 1.1 + newPos.x * 1.3 + aRandom * 6.28) * 0.03;
      newPos.z += cos(uTime * 1.5 + newPos.y * 1.5 + aRandom * 6.28) * 0.04;
    } else if (easedProgress < 0.1) {
      // Constellation state: gentler, larger-amplitude drift
      newPos.x += sin(uTime * 0.6 + newPos.y * 0.4 + aRandom * 6.28) * 0.06;
      newPos.y += cos(uTime * 0.5 + newPos.x * 0.3 + aRandom * 6.28) * 0.05;
      newPos.z += cos(uTime * 0.7 + newPos.y * 0.5 + aRandom * 6.28) * 0.06;
    }

    vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
    
    // Size attenuation
    gl_PointSize = (4.0 * aRandom + 2.0) * (20.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // Color logic: Mix between Constellation (warm nebula blend) and Formed Nebula Core (deep blue/violet)
    // Constellation: mix of amber, champagne, cyan, and soft violet — varied per particle
    vec3 nebulaBlue = vec3(0.04, 0.10, 0.23);      // Deep space blue
    vec3 champagne = vec3(0.83, 0.69, 0.22);        // Champagne gold
    vec3 nebulaViolet = vec3(0.42, 0.36, 0.58);     // Nebula violet
    vec3 cyanMist = vec3(0.53, 0.80, 0.93);         // Cyan mist
    vec3 ivory = vec3(0.96, 0.90, 0.75);            // Soft ivory
    vec3 warmAmber = vec3(0.91, 0.58, 0.20);        // Warm amber
    
    // Pick base color for formed (core) state
    float colorSelect = fract(aRandom * 7.13);
    vec3 coreColor;
    if (colorSelect < 0.30) {
      coreColor = champagne;
    } else if (colorSelect < 0.50) {
      coreColor = nebulaViolet;
    } else if (colorSelect < 0.65) {
      coreColor = cyanMist;
    } else if (colorSelect < 0.80) {
      coreColor = ivory;
    } else {
      coreColor = nebulaBlue;
    }
    
    // Constellation color: varied warm + cool blend, different per particle
    float constSelect = fract(aRandom * 11.37);
    vec3 constColor;
    if (constSelect < 0.25) {
      constColor = warmAmber;
    } else if (constSelect < 0.50) {
      constColor = champagne;
    } else if (constSelect < 0.70) {
      constColor = cyanMist;
    } else if (constSelect < 0.85) {
      constColor = nebulaViolet;
    } else {
      constColor = ivory;
    }
    
    // Mix constellation color with core color based on progress
    vColor = mix(constColor, coreColor, easedProgress);
    
    // Subtle sparkle/twinkle effect
    float sparkle = sin(uTime * 4.0 + aRandom * 100.0);
    if (sparkle > 0.92) {
      vColor += vec3(0.2, 0.15, 0.3);
    }

    vAlpha = 1.0;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Circular particle
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;

    // Soft edge
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);

    gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`;

export const Foliage: React.FC<FoliageProps> = ({ mode, count }) => {
  const meshRef = useRef<THREE.Points>(null);
  
  // Target progress reference for smooth JS-side dampening logic for the uniform
  const progressRef = useRef(0);

  const { chaosPositions, targetPositions, randoms } = useMemo(() => {
    const chaos = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const rnd = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // 1. CHAOS / Constellation Positions: Memory Constellation field (v0.2)
      // Replaces the old random-sphere explosion with a structured nebula field:
      // Core Residue (r 1.5-4.5) + Constellation Ring (r 4.5-8.5) + Memory Cloud (r 7-12)
      // With 2 gentle spiral arms woven through Layer B
      const constPos = getConstellationDustPosition(i, count);
      
      chaos[i * 3] = constPos.x;
      chaos[i * 3 + 1] = constPos.y;
      chaos[i * 3 + 2] = constPos.z;

      // 2. Target Positions: Memory Nebula Core sphere
      // FORMED = Memory Core aggregated state
      const nebulaPos = getNebulaCorePosition(i, count);
      
      target[i * 3] = nebulaPos.x;
      target[i * 3 + 1] = nebulaPos.y;
      target[i * 3 + 2] = nebulaPos.z;

      // 3. Randoms
      rnd[i] = Math.random();
    }

    return {
      chaosPositions: chaos,
      targetPositions: target,
      randoms: rnd
    };
  }, [count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
  }), []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      // Update time
      material.uniforms.uTime.value = state.clock.elapsedTime;
      
      // Smoothly interpolate the progress uniform
      const target = mode === TreeMode.FORMED ? 1 : 0;
      // Using a simple lerp for the uniform value
      progressRef.current = THREE.MathUtils.lerp(progressRef.current, target, delta * 1.5);
      material.uniforms.uProgress.value = progressRef.current;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position" // Required by three.js, though we override in shader
          count={count}
          array={chaosPositions} // Initial state
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aChaosPos"
          count={count}
          array={chaosPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aTargetPos"
          count={count}
          array={targetPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={count}
          array={randoms}
          itemSize={1}
        />
      </bufferGeometry>
      {/* @ts-ignore */}
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};