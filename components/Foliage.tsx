import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';
import { getNebulaCorePosition } from '../utils/nebulaLayout';
import { getConstellationDustPosition } from '../utils/constellationLayout';

// ===========================================================================
// v0.4.3 Dust Lighting Config
// ===========================================================================

const DUST_LIGHTING = {
  // --- Proportions (deterministic from index) ---
  baseRatio: 0.75,
  highlightRatio: 0.20,
  sparkRatio: 0.05,

  // --- Fragment brightness multipliers per kind ---
  baseIntensity: 0.22,
  highlightIntensity: 0.48,
  sparkIntensity: 1.05,

  // --- Fragment alpha multipliers per kind ---
  baseAlpha: 0.22,
  highlightAlpha: 0.45,
  sparkAlpha: 0.85,

  // --- Sparkle probability thresholds per kind ---
  baseSparkleThreshold: 0.99,    // essentially never
  highlightSparkleThreshold: 0.95,
  sparkSparkleThreshold: 0.88,

  // --- Sparkle strength per kind ---
  baseSparkleStrength: 0.0,
  highlightSparkleStrength: 0.18,
  sparkSparkleStrength: 0.35,

  // --- Size multipliers per kind ---
  baseSizeMul: 0.75,
  highlightSizeMul: 0.95,
  sparkSizeMul: 1.15,

  // --- Global mode intensity ---
  formedIntensity: 0.85,
  chaosIntensity: 0.75,
  chronoIntensity: 0.48,
};

// ===========================================================================
// Deterministic pseudo-random [0, 1] from index (for dust kind)
// ===========================================================================
function dRand(idx: number, seed: number): number {
  const x = Math.sin(idx * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Deterministic dust kind: 0=baseDust, 1=reflectedHighlight, 2=sparkStar */
function getDustKind(index: number): number {
  const r = dRand(index, 701);
  if (r < DUST_LIGHTING.baseRatio) return 0;
  if (r < DUST_LIGHTING.baseRatio + DUST_LIGHTING.highlightRatio) return 1;
  return 2;
}

/** Deterministic luminosity factor per particle [0, 1] — slight variation within kind */
function getLuminosity(index: number, kind: number): number {
  const base = dRand(index, 703);
  if (kind === 0) return 0.5 + base * 0.5;          // 0.50–1.00
  if (kind === 1) return 0.6 + base * 0.4;          // 0.60–1.00
  return 0.7 + base * 0.3;                            // 0.70–1.00
}

// ===========================================================================
// Component props
// ===========================================================================

interface FoliageProps {
  mode: TreeMode;
  count: number;
}

// ===========================================================================
// Vertex Shader
// ===========================================================================

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;

  attribute vec3 aChaosPos;
  attribute vec3 aTargetPos;
  attribute float aRandom;
  attribute float aDustKind;
  attribute float aLuminosity;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vDustKind;
  varying float vLuminosity;
  varying float vGlowFactor;

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
    
    // Size attenuation with per-kind scaling
    float kind = aDustKind;
    float sizeMul;
    if (kind < 0.5) {
      sizeMul = ${DUST_LIGHTING.baseSizeMul.toFixed(2)};
    } else if (kind < 1.5) {
      sizeMul = ${DUST_LIGHTING.highlightSizeMul.toFixed(2)};
    } else {
      sizeMul = ${DUST_LIGHTING.sparkSizeMul.toFixed(2)};
    }
    gl_PointSize = (4.0 * aRandom + 2.0) * sizeMul * (20.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // --- Color logic ---
    vec3 deepNavy   = vec3(0.04, 0.08, 0.19);        // #0B1430
    vec3 mutedBlue  = vec3(0.12, 0.20, 0.36);        // #1E335C
    vec3 smokeVio   = vec3(0.16, 0.15, 0.29);        // #2A254A
    vec3 dimIvory   = vec3(0.48, 0.45, 0.37);        // #7A735E

    vec3 cyanMist   = vec3(0.55, 0.74, 0.85);        // #8DBBD6
    vec3 paleBlue   = vec3(0.66, 0.78, 0.91);        // #A8C8E8
    vec3 softGold   = vec3(0.85, 0.71, 0.42);        // #D8B66A
    vec3 muteViolet = vec3(0.55, 0.53, 0.66);        // #8C88A8

    vec3 warmWhite  = vec3(1.0, 0.96, 0.84);         // #FFF4D6
    vec3 blueWhite  = vec3(0.81, 0.91, 1.0);         // #CFE8FF
    vec3 champagne  = vec3(0.95, 0.83, 0.54);        // #F2D38A

    float colorSelect = fract(aRandom * 7.13);

    // --- Core (FORMED) color per kind ---
    vec3 coreColor;
    if (kind < 0.5) {
      // baseDust core: dark muted tones
      if (colorSelect < 0.30)      coreColor = deepNavy;
      else if (colorSelect < 0.55) coreColor = mutedBlue;
      else if (colorSelect < 0.78) coreColor = smokeVio;
      else                         coreColor = dimIvory;
    } else if (kind < 1.5) {
      // reflectedHighlight core: mid-tone blue-gold
      if (colorSelect < 0.30)      coreColor = cyanMist;
      else if (colorSelect < 0.55) coreColor = paleBlue;
      else if (colorSelect < 0.78) coreColor = softGold;
      else                         coreColor = muteViolet;
    } else {
      // sparkStar core: bright luminous tones
      if (colorSelect < 0.40)      coreColor = warmWhite;
      else if (colorSelect < 0.72) coreColor = blueWhite;
      else                         coreColor = champagne;
    }

    // --- Constellation color per kind ---
    vec3 constColor;
    float constSelect = fract(aRandom * 11.37);
    if (kind < 0.5) {
      if (constSelect < 0.30)      constColor = deepNavy;
      else if (constSelect < 0.55) constColor = smokeVio;
      else if (constSelect < 0.78) constColor = mutedBlue;
      else                         constColor = dimIvory;
    } else if (kind < 1.5) {
      if (constSelect < 0.30)      constColor = cyanMist;
      else if (constSelect < 0.55) constColor = softGold;
      else if (constSelect < 0.78) constColor = paleBlue;
      else                         constColor = muteViolet;
    } else {
      if (constSelect < 0.40)      constColor = champagne;
      else if (constSelect < 0.72) constColor = warmWhite;
      else                         constColor = blueWhite;
    }
    
    // Mix constellation color with core color based on progress
    vColor = mix(constColor, coreColor, easedProgress);

    // --- Sparkle — per-kind control ---
    float sparkle = sin(uTime * 4.5 + aRandom * 100.0);
    float sparkThreshold, sparkStrength;
    if (kind < 0.5) {
      sparkThreshold = ${DUST_LIGHTING.baseSparkleThreshold.toFixed(2)};
      sparkStrength  = ${DUST_LIGHTING.baseSparkleStrength.toFixed(2)};
    } else if (kind < 1.5) {
      sparkThreshold = ${DUST_LIGHTING.highlightSparkleThreshold.toFixed(2)};
      sparkStrength  = ${DUST_LIGHTING.highlightSparkleStrength.toFixed(2)};
    } else {
      sparkThreshold = ${DUST_LIGHTING.sparkSparkleThreshold.toFixed(2)};
      sparkStrength  = ${DUST_LIGHTING.sparkSparkleStrength.toFixed(2)};
    }
    if (sparkle > sparkThreshold) {
      float s = (sparkle - sparkThreshold) / (1.0 - sparkThreshold) * sparkStrength;
      vColor += vec3(s, s * 0.85, s * 0.7);
    }

    vAlpha = 1.0;
    vDustKind = kind;
    vLuminosity = aLuminosity;
    vGlowFactor = 1.0;
  }
`;

// ===========================================================================
// Fragment Shader
// ===========================================================================

const fragmentShader = /* glsl */ `
  uniform float uChronoIntensity;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDustKind;
  varying float vLuminosity;
  varying float vGlowFactor;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;

    // Soft edge glow
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);

    float kind = vDustKind;
    float luma = vLuminosity;
    float intensity, alphaMul;

    if (kind < 0.5) {
      // baseDust — dim, low alpha, no real glow
      intensity = ${DUST_LIGHTING.baseIntensity.toFixed(2)} * luma;
      alphaMul  = ${DUST_LIGHTING.baseAlpha.toFixed(2)};
    } else if (kind < 1.5) {
      // reflectedHighlight — moderate, visible but not bright
      intensity = ${DUST_LIGHTING.highlightIntensity.toFixed(2)} * luma;
      alphaMul  = ${DUST_LIGHTING.highlightAlpha.toFixed(2)};
    } else {
      // sparkStar — bright, higher alpha, keeps some glow
      intensity = ${DUST_LIGHTING.sparkIntensity.toFixed(2)} * luma;
      alphaMul  = ${DUST_LIGHTING.sparkAlpha.toFixed(2)};
    }

    // Apply Chrono Stream global dimming
    intensity *= uChronoIntensity;

    vec3 finalColor = vColor * intensity * glow;
    float finalAlpha = vAlpha * alphaMul * glow;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

// ===========================================================================
// Component
// ===========================================================================

export const Foliage: React.FC<FoliageProps> = ({ mode, count }) => {
  const meshRef = useRef<THREE.Points>(null);
  const progressRef = useRef(0);

  const { chaosPositions, targetPositions, randoms, dustKinds, luminosities } = useMemo(() => {
    const chaos = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    const dk = new Float32Array(count);
    const lum = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const constPos = getConstellationDustPosition(i, count);
      chaos[i * 3] = constPos.x;
      chaos[i * 3 + 1] = constPos.y;
      chaos[i * 3 + 2] = constPos.z;

      const nebulaPos = getNebulaCorePosition(i, count);
      target[i * 3] = nebulaPos.x;
      target[i * 3 + 1] = nebulaPos.y;
      target[i * 3 + 2] = nebulaPos.z;

      rnd[i] = Math.random();

      // v0.4.3: Deterministic dust kind + luminosity
      const kind = getDustKind(i);
      dk[i] = kind;
      lum[i] = getLuminosity(i, kind);
    }

    return {
      chaosPositions: chaos,
      targetPositions: target,
      randoms: rnd,
      dustKinds: dk,
      luminosities: lum,
    };
  }, [count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uChronoIntensity: { value: 1.0 },
  }), []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;

      const isChrono = mode === TreeMode.CHRONO_STREAM;
      const isFormed = mode === TreeMode.FORMED;

      // Smooth progress
      const target = isFormed ? 1 : 0;
      progressRef.current = THREE.MathUtils.lerp(progressRef.current, target, delta * 1.5);
      material.uniforms.uProgress.value = progressRef.current;

      // v0.4.3: Chrono Stream dimming
      const chronoIdx = isChrono ? DUST_LIGHTING.chronoIntensity
        : isFormed ? DUST_LIGHTING.formedIntensity
        : DUST_LIGHTING.chaosIntensity;
      material.uniforms.uChronoIntensity.value = THREE.MathUtils.lerp(
        material.uniforms.uChronoIntensity.value,
        chronoIdx,
        delta * 2.0,
      );
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={chaosPositions}
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
        {/* v0.4.3: Dust kind (0=base, 1=highlight, 2=spark) — deterministic */}
        <bufferAttribute
          attach="attributes-aDustKind"
          count={count}
          array={dustKinds}
          itemSize={1}
        />
        {/* v0.4.3: Luminosity variation within kind */}
        <bufferAttribute
          attach="attributes-aLuminosity"
          count={count}
          array={luminosities}
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