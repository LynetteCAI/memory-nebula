import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

// ===========================================================================
// v0.2.3 Stellar Systems — each stellar anchor has its own bound planets
// ===========================================================================

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Deterministic pseudo-random [0, 1] */
function pRand(idx: number, seed: number): number {
  const x = Math.sin(idx * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------
const STELLAR_COUNT = 10;
const PLANET_MAJOR_COUNT = 25;
const PLANET_MINOR_COUNT = 95;

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const warmWhite   = new THREE.Color('#FFF4D6');
const champagne   = new THREE.Color('#F2D38A');
const paleBlueW   = new THREE.Color('#CFE8FF');
const deepBlue    = new THREE.Color('#7FA9D9');
const cyanGray    = new THREE.Color('#95BFD1');
const icyBlue     = new THREE.Color('#B9D7E8');
const fogIvory    = new THREE.Color('#EAE7DE');
const mutedViolet = new THREE.Color('#8C88A8');
const dustyMars   = new THREE.Color('#A66D5A');
const sandyBeige  = new THREE.Color('#C8B08A');

const STELLAR_PALETTE = [warmWhite, champagne, paleBlueW, champagne, warmWhite, paleBlueW, champagne, warmWhite, paleBlueW, champagne];
const PLANET_PALETTE  = [deepBlue, cyanGray, icyBlue, fogIvory, mutedViolet];
const PLANET_ACCENT   = [dustyMars, sandyBeige]; // ≤15%

// ===========================================================================
// Stellar system centers — balanced Fibonacci sphere, no flattening bias
// ===========================================================================

interface StellarSystem {
  id: number;
  formedCenter: THREE.Vector3;
  chaosCenter: THREE.Vector3;
  color: THREE.Color;
  scale: number;
  speed: number;
}

function makeStellarSystems(): StellarSystem[] {
  const systems: StellarSystem[] = [];
  for (let i = 0; i < STELLAR_COUNT; i++) {
    // Fibonacci sphere for uniform spherical distribution
    const idx = i + 0.5;
    const phi = Math.asin(1 - 2 * idx / STELLAR_COUNT); // uniform lat
    const theta = GOLDEN_ANGLE * i;
    const dirX = Math.cos(phi) * Math.cos(theta);
    const dirY = Math.sin(phi);
    const dirZ = Math.cos(phi) * Math.sin(theta);

    // FORMED center — tight around core
    const fR = 1.6 + pRand(i, 801) * 1.5; // 1.6–3.1
    const formedCenter = new THREE.Vector3(
      dirX * fR * 1.03,
      dirY * fR * 0.92,
      dirZ * fR * 1.03,
    );

    // CHAOS center — spread across constellation space
    const cR = 5.0 + pRand(i, 811) * 3.8; // 5.0–8.8
    const chaosCenter = new THREE.Vector3(
      dirX * cR * 1.08,
      dirY * cR * 0.95,
      dirZ * cR * 1.05,
    );

    const scale = 0.26 + pRand(i, 821) * 0.16; // 0.26–0.42
    const color = STELLAR_PALETTE[i % STELLAR_PALETTE.length];

    systems.push({
      id: i,
      formedCenter,
      chaosCenter,
      color,
      scale,
      speed: 0.35 + pRand(i, 823) * 0.45,
    });
  }
  return systems;
}

// ===========================================================================
// Planet body — bound to a stellar system
// ===========================================================================

type PlanetKind = 'major' | 'minor';

interface PlanetBody {
  systemId: number;
  kind: PlanetKind;
  /** Local orbit offset in FORMED state */
  formedOffset: THREE.Vector3;
  /** Local orbit offset in CHAOS state */
  chaosOffset: THREE.Vector3;
  scale: number;
  color: THREE.Color;
  speed: number;
  /** Orbit angle rate for gentle drift */
  orbitSpeed: number;
}

/**
 * Build a deterministic orbit offset around a stellar anchor.
 * Each planet-system pair gets a unique orbital plane (tilted).
 */
function makeOrbitOffset(
  planetIdx: number,
  systemId: number,
  kind: PlanetKind,
  mode: 'formed' | 'chaos',
): THREE.Vector3 {
  // Deterministic orbit parameters per (planetIdx, systemId)
  const orbitAngle = GOLDEN_ANGLE * planetIdx * 0.7 + systemId * 1.3;
  const tiltAxisX = Math.sin(systemId * 2.1 + planetIdx * 0.3);
  const tiltAxisZ = Math.cos(systemId * 1.7 + planetIdx * 0.5);
  const tiltAngle = 0.3 + pRand(planetIdx + systemId * 100, 901) * 0.5;

  // Orbit radius
  let rMin: number, rMax: number;
  if (mode === 'formed') {
    rMin = kind === 'major' ? 0.42 : 0.18;
    rMax = kind === 'major' ? 0.85 : 0.55;
  } else {
    rMin = kind === 'major' ? 0.65 : 0.28;
    rMax = kind === 'major' ? 1.35 : 0.85;
  }
  const orbitR = rMin + pRand(planetIdx + systemId * 100, 903) * (rMax - rMin);

  // Base position in orbital plane (XZ)
  const localX = Math.cos(orbitAngle) * orbitR;
  const localZ = Math.sin(orbitAngle) * orbitR * (0.65 + pRand(planetIdx, 905) * 0.30);
  const localY = Math.sin(orbitAngle * 1.3 + systemId) * orbitR * 0.25;

  // Apply tilt rotation
  const tiltNorm = Math.sqrt(tiltAxisX * tiltAxisX + tiltAxisZ * tiltAxisZ) || 1;
  const nx = tiltAxisX / tiltNorm;
  const nz = tiltAxisZ / tiltNorm;

  // Rodrigues rotation around axis (nx, 0, nz) by tiltAngle
  const cosT = Math.cos(tiltAngle);
  const sinT = Math.sin(tiltAngle);
  const dotN = localX * nx + localZ * nz;
  const rx = localX * cosT + (localZ * nx - localY * nz) * sinT + dotN * nx * (1 - cosT);
  const rz = localZ * cosT + (localY * nx - localX * nz) * sinT + dotN * nz * (1 - cosT);
  // Simplified y tilt
  const ry = localY + (localX * nx + localZ * nz) * 0.15;

  return new THREE.Vector3(rx, ry, rz);
}

function makePlanetBodies(systems: StellarSystem[]): { majors: PlanetBody[]; minors: PlanetBody[] } {
  const majors: PlanetBody[] = [];
  const minors: PlanetBody[] = [];
  let pIdx = 0;

  // Major planets
  for (let i = 0; i < PLANET_MAJOR_COUNT; i++, pIdx++) {
    const systemId = i % STELLAR_COUNT;
    const colorIdx = Math.floor(pRand(pIdx, 911) * PLANET_PALETTE.length);
    const useAccent = pRand(pIdx, 913) < 0.12;
    const color = useAccent
      ? PLANET_ACCENT[Math.floor(pRand(pIdx, 915) * PLANET_ACCENT.length)].clone()
      : PLANET_PALETTE[colorIdx].clone();
    majors.push({
      systemId,
      kind: 'major',
      formedOffset: makeOrbitOffset(pIdx, systemId, 'major', 'formed'),
      chaosOffset:  makeOrbitOffset(pIdx, systemId, 'major', 'chaos'),
      scale: 0.10 + pRand(pIdx, 917) * 0.06,
      color,
      speed: 0.5 + pRand(pIdx, 919) * 1.0,
      orbitSpeed: 0.03 + pRand(pIdx, 921) * 0.04,
    });
  }

  // Minor planets
  for (let i = 0; i < PLANET_MINOR_COUNT; i++, pIdx++) {
    const systemId = Math.floor(pRand(pIdx, 931) * STELLAR_COUNT);
    const colorIdx = Math.floor(pRand(pIdx, 933) * PLANET_PALETTE.length);
    const useAccent = pRand(pIdx, 935) < 0.15;
    const color = useAccent
      ? PLANET_ACCENT[Math.floor(pRand(pIdx, 937) * PLANET_ACCENT.length)].clone()
      : PLANET_PALETTE[colorIdx].clone();
    minors.push({
      systemId,
      kind: 'minor',
      formedOffset: makeOrbitOffset(pIdx, systemId, 'minor', 'formed'),
      chaosOffset:  makeOrbitOffset(pIdx, systemId, 'minor', 'chaos'),
      scale: 0.05 + pRand(pIdx, 939) * 0.05,
      color,
      speed: 0.6 + pRand(pIdx, 941) * 1.1,
      orbitSpeed: 0.04 + pRand(pIdx, 943) * 0.06,
    });
  }

  return { majors, minors };
}

// ===========================================================================
// Component
// ===========================================================================

interface OrnamentsProps {
  mode: TreeMode;
  count: number; // kept for API compat, internally ignored
}

export const Ornaments: React.FC<OrnamentsProps> = ({ mode }) => {
  const stellarRef = useRef<THREE.InstancedMesh>(null);
  const majorRef = useRef<THREE.InstancedMesh>(null);
  const minorRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // ---- generate all data once (systems + planets) ----
  const { systems, majors, minors } = useMemo(() => {
    const _systems = makeStellarSystems();
    const { majors: _majors, minors: _minors } = makePlanetBodies(_systems);
    return { systems: _systems, majors: _majors, minors: _minors };
  }, []);

  // ---- set initial instance colors ----
  useLayoutEffect(() => {
    if (stellarRef.current) {
      systems.forEach((s, i) => stellarRef.current!.setColorAt(i, s.color));
      stellarRef.current.instanceColor!.needsUpdate = true;
    }
    if (majorRef.current) {
      majors.forEach((p, i) => majorRef.current!.setColorAt(i, p.color));
      majorRef.current.instanceColor!.needsUpdate = true;
    }
    if (minorRef.current) {
      minors.forEach((p, i) => minorRef.current!.setColorAt(i, p.color));
      minorRef.current.instanceColor!.needsUpdate = true;
    }
  }, [systems, majors, minors]);

  // ---- per-frame animation ----
  useFrame((state, delta) => {
    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;

    // --- Stellar bodies ---
    if (stellarRef.current) {
      let needsUpdate = false;
      systems.forEach((s, i) => {
        const dest = isFormed ? s.formedCenter : s.chaosCenter;
        stellarRef.current!.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        dummy.position.lerp(dest, delta * s.speed);

        const dist = dummy.position.distanceTo(dest);
        if (dist < 0.6) {
          dummy.position.x += Math.sin(time * 1.1 + s.chaosCenter.y * 1.5) * 0.004;
          dummy.position.y += Math.cos(time * 0.9 + s.chaosCenter.x * 1.3) * 0.003;
          dummy.position.z += Math.cos(time * 1.0 + s.chaosCenter.z * 1.4) * 0.004;
        }

        dummy.rotation.y += delta * 0.04;
        let scl = s.scale * (1 + Math.sin(time * 2.5 + i * 1.7) * 0.06);
        dummy.scale.setScalar(scl);
        dummy.lookAt(0, 0, 0);
        dummy.updateMatrix();
        stellarRef.current!.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
      });
      if (needsUpdate) stellarRef.current.instanceMatrix.needsUpdate = true;
    }

    // --- Planets (orbit their stellar system) - shared helper ---
    const updatePlanetMesh = (ref: React.RefObject<THREE.InstancedMesh>, data: PlanetBody[]) => {
      if (!ref.current) return;
      let needsUpdate = false;
      data.forEach((p, i) => {
        stellarRef.current!.getMatrixAt(p.systemId, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        const stellarPos = dummy.position.clone();

        const offset = isFormed ? p.formedOffset : p.chaosOffset;
        const driftAngle = time * p.orbitSpeed;
        const cosA = Math.cos(driftAngle);
        const sinA = Math.sin(driftAngle);
        const rotX = offset.x * cosA - offset.z * sinA;
        const rotZ = offset.x * sinA + offset.z * cosA;

        const worldTarget = new THREE.Vector3(
          stellarPos.x + rotX,
          stellarPos.y + offset.y,
          stellarPos.z + rotZ,
        );

        ref.current!.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        dummy.position.lerp(worldTarget, delta * p.speed);
        dummy.rotation.y += delta * 0.06;
        dummy.scale.setScalar(p.scale);
        dummy.lookAt(stellarPos.x, stellarPos.y, stellarPos.z);
        dummy.updateMatrix();
        ref.current!.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
      });
      if (needsUpdate) ref.current.instanceMatrix.needsUpdate = true;
    };

    updatePlanetMesh(majorRef, majors);
    updatePlanetMesh(minorRef, minors);
  });

  return (
    <>
      {/* Stellar Bodies — luminous system anchors, toneMapped=false for true glow */}
      <instancedMesh ref={stellarRef} args={[undefined, undefined, systems.length]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          roughness={0.12}
          metalness={0.03}
          emissive="white"
          emissiveIntensity={0.8}
          transparent
          opacity={0.90}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Major Planets — brighter, slight reflected-light emissive */}
      <instancedMesh ref={majorRef} args={[undefined, undefined, majors.length]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          roughness={0.40}
          metalness={0.05}
          emissive="white"
          emissiveIntensity={0.15}
          transparent
          opacity={0.88}
          envMapIntensity={1.0}
        />
      </instancedMesh>

      {/* Minor Planets — dimmer, faint emissive, more transparent */}
      <instancedMesh ref={minorRef} args={[undefined, undefined, minors.length]}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial
          roughness={0.50}
          metalness={0.04}
          emissive="white"
          emissiveIntensity={0.08}
          transparent
          opacity={0.68}
          envMapIntensity={0.7}
        />
      </instancedMesh>
    </>
  );
};