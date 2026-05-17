import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

// ===========================================================================
// v0.4.2 Stellar Orbit Systems — elliptical orbits + visible orbit rings
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
const RINGS_PER_SYSTEM = 2; // how many representative orbit rings per stellar system

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

// Orbit ring colors — very faint
const RING_COLORS = [
  new THREE.Color('#88CCEE'), // pale cyan
  new THREE.Color('#D4AF37'), // champagne gold
  new THREE.Color('#F5E6BF'), // soft ivory
];

// ===========================================================================
// Stellar system — center positions per mode + orbital plane
// ===========================================================================

interface StellarSystem {
  id: number;
  formedCenter: THREE.Vector3;
  chaosCenter: THREE.Vector3;
  chronoCenter: THREE.Vector3;
  color: THREE.Color;
  scale: number;
  speed: number;
  /** Orbital plane rotation — shared by all planets in this system */
  orbitPlane: THREE.Quaternion;
}

/** Build a deterministic orbital plane quaternion for a stellar system. */
function makeOrbitPlane(systemId: number): THREE.Quaternion {
  const axisX = Math.sin(systemId * 2.1 + 0.7);
  const axisY = Math.cos(systemId * 1.3 + 0.3);
  const axisZ = Math.sin(systemId * 1.7 + 1.1);
  const len = Math.sqrt(axisX * axisX + axisY * axisY + axisZ * axisZ) || 1;
  const angle = 0.25 + pRand(systemId, 801) * 0.55; // 0.25–0.80 rad tilt
  return new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(axisX / len, axisY / len, axisZ / len).normalize(),
    angle,
  );
}

function makeStellarSystems(): StellarSystem[] {
  const systems: StellarSystem[] = [];
  for (let i = 0; i < STELLAR_COUNT; i++) {
    const idx = i + 0.5;
    const phi = Math.asin(1 - 2 * idx / STELLAR_COUNT);
    const theta = GOLDEN_ANGLE * i;
    const dirX = Math.cos(phi) * Math.cos(theta);
    const dirY = Math.sin(phi);
    const dirZ = Math.cos(phi) * Math.sin(theta);

    // FORMED center — tight around core
    const fR = 1.6 + pRand(i, 811) * 1.5;
    const formedCenter = new THREE.Vector3(dirX * fR * 1.03, dirY * fR * 0.92, dirZ * fR * 1.03);

    // CHAOS center — spread across constellation space
    const cR = 5.0 + pRand(i, 821) * 3.8;
    const chaosCenter = new THREE.Vector3(dirX * cR * 1.08, dirY * cR * 0.95, dirZ * cR * 1.05);

    // CHRONO_STREAM center — further back in the background group z-space
    const chrR = 5.5 + pRand(i, 831) * 5.5;
    const chronoCenter = new THREE.Vector3(
      dirX * chrR * 1.15,
      dirY * chrR * 0.80,
      dirZ * chrR * 0.85,
    );

    const scale = 0.26 + pRand(i, 841) * 0.16;
    const color = STELLAR_PALETTE[i % STELLAR_PALETTE.length];

    systems.push({
      id: i,
      formedCenter,
      chaosCenter,
      chronoCenter,
      color,
      scale,
      speed: 0.35 + pRand(i, 843) * 0.45,
      orbitPlane: makeOrbitPlane(i),
    });
  }
  return systems;
}

// ===========================================================================
// Planet body — bound to stellar system, with elliptical orbit parameters
// ===========================================================================

type PlanetKind = 'major' | 'minor';

interface PlanetBody {
  systemId: number;
  kind: PlanetKind;
  /** Semi-major axis radius per mode */
  semiMajorFormed: number;
  semiMajorChaos: number;
  semiMajorChrono: number;
  /** Eccentricity 0.08–0.28 */
  eccentricity: number;
  /** Individual inclination offset (small perturbation from system plane) */
  inclinationOffset: number;
  /** Starting phase angle */
  phase: number;
  /** Orbit angular speed (rad/s) — slower for outer planets */
  orbitSpeed: number;
  scale: number;
  color: THREE.Color;
  /** Position lerp speed */
  speed: number;
}

function makePlanetBodies(systems: StellarSystem[]): { majors: PlanetBody[]; minors: PlanetBody[] } {
  const majors: PlanetBody[] = [];
  const minors: PlanetBody[] = [];
  let pIdx = 0;

  // Major planets — 2–3 per system, evenly spread
  for (let i = 0; i < PLANET_MAJOR_COUNT; i++, pIdx++) {
    const systemId = i % STELLAR_COUNT;
    const planetIndexInSystem = Math.floor(i / STELLAR_COUNT);
    const colorIdx = Math.floor(pRand(pIdx, 911) * PLANET_PALETTE.length);
    const useAccent = pRand(pIdx, 913) < 0.12;
    const color = useAccent
      ? PLANET_ACCENT[Math.floor(pRand(pIdx, 915) * PLANET_ACCENT.length)].clone()
      : PLANET_PALETTE[colorIdx].clone();

    // Orbit radius scales with planet index in system (inner→outer)
    const baseFormed = 0.35 + planetIndexInSystem * 0.20;
    const baseChaos  = 0.65 + planetIndexInSystem * 0.35;
    const baseChrono = 0.75 + planetIndexInSystem * 0.40;
    const jitter = pRand(pIdx, 917) * 0.10;

    majors.push({
      systemId,
      kind: 'major',
      semiMajorFormed: baseFormed + jitter,
      semiMajorChaos:  baseChaos + jitter * 1.2,
      semiMajorChrono: baseChrono + jitter * 1.3,
      eccentricity: 0.08 + pRand(pIdx, 919) * 0.20,
      inclinationOffset: (pRand(pIdx, 921) - 0.5) * 0.15,
      phase: pRand(pIdx, 923) * Math.PI * 2,
      orbitSpeed: (0.06 + pRand(pIdx, 925) * 0.04) / Math.pow(baseChaos, 0.5),
      scale: 0.10 + pRand(pIdx, 927) * 0.06,
      color,
      speed: 0.5 + pRand(pIdx, 929) * 1.0,
    });
  }

  // Minor planets — several per system
  for (let i = 0; i < PLANET_MINOR_COUNT; i++, pIdx++) {
    const systemId = Math.floor(pRand(pIdx, 931) * STELLAR_COUNT);
    const planetIndexInSystem = Math.floor(pRand(pIdx, 933) * 4);
    const colorIdx = Math.floor(pRand(pIdx, 935) * PLANET_PALETTE.length);
    const useAccent = pRand(pIdx, 937) < 0.15;
    const color = useAccent
      ? PLANET_ACCENT[Math.floor(pRand(pIdx, 939) * PLANET_ACCENT.length)].clone()
      : PLANET_PALETTE[colorIdx].clone();

    const baseFormed = 0.18 + planetIndexInSystem * 0.15;
    const baseChaos  = 0.35 + planetIndexInSystem * 0.25;
    const baseChrono = 0.40 + planetIndexInSystem * 0.30;
    const jitter = pRand(pIdx, 941) * 0.08;

    minors.push({
      systemId,
      kind: 'minor',
      semiMajorFormed: baseFormed + jitter,
      semiMajorChaos:  baseChaos + jitter * 1.2,
      semiMajorChrono: baseChrono + jitter * 1.3,
      eccentricity: 0.10 + pRand(pIdx, 943) * 0.18,
      inclinationOffset: (pRand(pIdx, 945) - 0.5) * 0.20,
      phase: pRand(pIdx, 947) * Math.PI * 2,
      orbitSpeed: (0.08 + pRand(pIdx, 949) * 0.08) / Math.pow(Math.max(baseChaos, 0.3), 0.5),
      scale: 0.05 + pRand(pIdx, 951) * 0.05,
      color,
      speed: 0.6 + pRand(pIdx, 953) * 1.1,
    });
  }

  return { majors, minors };
}

// ===========================================================================
// Elliptical orbit offset computation
// ===========================================================================

/**
 * Compute the local orbit offset from the stellar system center
 * for a planet at the given elapsed time.
 */
function getEllipticalOrbitOffset(
  planet: PlanetBody,
  system: StellarSystem,
  mode: TreeMode,
  elapsedTime: number,
): THREE.Vector3 {
  // Choose semi-major axis based on mode
  let semiMajor: number;
  if (mode === TreeMode.FORMED)       semiMajor = planet.semiMajorFormed;
  else if (mode === TreeMode.CHAOS)   semiMajor = planet.semiMajorChaos;
  else                                 semiMajor = planet.semiMajorChrono;

  const e = planet.eccentricity;
  const semiMinor = semiMajor * Math.sqrt(1 - e * e);

  // Current angle — advances continuously
  const angle = planet.phase + elapsedTime * planet.orbitSpeed;

  // Elliptical position in local plane
  const localX = Math.cos(angle) * semiMajor;
  const localZ = Math.sin(angle) * semiMinor;
  // Subtle vertical wobble for organic feel
  const localY = Math.sin(angle + planet.phase * 0.7) * semiMajor * 0.06;

  const local = new THREE.Vector3(localX, localY, localZ);

  // Apply system orbital plane rotation
  local.applyQuaternion(system.orbitPlane);

  // Apply individual inclination perturbation
  if (Math.abs(planet.inclinationOffset) > 0.001) {
    const iAxis = new THREE.Vector3(
      Math.cos(planet.phase * 0.4),
      0,
      Math.sin(planet.phase * 0.4),
    ).normalize();
    local.applyQuaternion(
      new THREE.Quaternion().setFromAxisAngle(iAxis, planet.inclinationOffset),
    );
  }

  return local;
}

// ===========================================================================
// Orbit ring geometry — one ring per stellar system
// ===========================================================================

interface OrbitRingData {
  systemId: number;
  /** Representative semi-major axis for this ring */
  semiMajorFormed: number;
  semiMajorChaos: number;
  semiMajorChrono: number;
  eccentricity: number;
  color: THREE.Color;
  /** Points sampled along the full ellipse */
  points: THREE.Vector3[]; // 64 sample points in local space (unit scale, applied in render)
}

function makeOrbitRings(systems: StellarSystem[]): OrbitRingData[] {
  const rings: OrbitRingData[] = [];
  const RING_SEGMENTS = 64;

  for (const sys of systems) {
    for (let r = 0; r < RINGS_PER_SYSTEM; r++) {
      const ringIdx = sys.id * RINGS_PER_SYSTEM + r;
      const baseFormed = 0.42 + r * 0.28;
      const baseChaos  = 0.72 + r * 0.45;
      const baseChrono = 0.82 + r * 0.55;
      const ecc = 0.06 + pRand(ringIdx, 971) * 0.18;

      // Pre-sample 64 points in local XZ plane
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s < RING_SEGMENTS; s++) {
        const a = (s / RING_SEGMENTS) * Math.PI * 2;
        const lx = Math.cos(a);
        const lz = Math.sin(a) * Math.sqrt(1 - ecc * ecc);
        const pt = new THREE.Vector3(lx, 0, lz);
        pt.applyQuaternion(sys.orbitPlane);
        pts.push(pt);
      }

      rings.push({
        systemId: sys.id,
        semiMajorFormed: baseFormed + pRand(ringIdx, 973) * 0.06,
        semiMajorChaos:  baseChaos + pRand(ringIdx, 975) * 0.08,
        semiMajorChrono: baseChrono + pRand(ringIdx, 977) * 0.10,
        eccentricity: ecc,
        color: RING_COLORS[ringIdx % RING_COLORS.length].clone(),
        points: pts,
      });
    }
  }

  return rings;
}

// ===========================================================================
// OrbitRings sub-component — subtle elliptical line loops
// ===========================================================================

/**
 * Each ring is a group (positioned at stellar center, scaled by semiMajor)
 * containing a LineSegments with pre-built geometry.
 * Positions and scales are updated in the parent useFrame.
 */
interface OrbitRingRenderData {
  systemId: number;
  semiMajorFormed: number;
  semiMajorChaos: number;
  semiMajorChrono: number;
  color: THREE.Color;
  geometry: THREE.BufferGeometry;
}

const OrbitRingsRenderer: React.FC<{
  rings: OrbitRingRenderData[];
  mode: TreeMode;
  ringRefs: React.MutableRefObject<(THREE.Group | null)[]>;
}> = React.memo(({ rings, mode, ringRefs }) => {
  const ringOpacity = mode === TreeMode.FORMED ? 0.06
    : mode === TreeMode.CHAOS ? 0.16
    : 0.08;

  return (
    <>
      {rings.map((ring, i) => (
        <group key={i} ref={(el) => { ringRefs.current[i] = el; }}>
          <lineSegments geometry={ring.geometry}>
            <lineBasicMaterial
              color={ring.color}
              transparent
              opacity={ringOpacity}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </lineSegments>
        </group>
      ))}
    </>
  );
});
OrbitRingsRenderer.displayName = 'OrbitRingsRenderer';

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

  // ---- generate all data once ----
  const { systems, majors, minors, orbitRings } = useMemo(() => {
    const _systems = makeStellarSystems();
    const { majors: _majors, minors: _minors } = makePlanetBodies(_systems);
    const _orbitRingsData = makeOrbitRings(_systems);
    // Convert to render format with pre-built BufferGeometry
    const _rings: OrbitRingRenderData[] = _orbitRingsData.map((r) => {
      const geo = new THREE.BufferGeometry();
      const verts = new Float32Array(r.points.length * 3);
      for (let i = 0; i < r.points.length; i++) {
        verts[i * 3]     = r.points[i].x;
        verts[i * 3 + 1] = r.points[i].y;
        verts[i * 3 + 2] = r.points[i].z;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      return {
        systemId: r.systemId,
        semiMajorFormed: r.semiMajorFormed,
        semiMajorChaos: r.semiMajorChaos,
        semiMajorChrono: r.semiMajorChrono,
        color: r.color,
        geometry: geo,
      };
    });
    return { systems: _systems, majors: _majors, minors: _minors, orbitRings: _rings };
  }, []);

  // Refs for orbit ring groups (position + scale updated in useFrame)
  const ringRefs = useRef<(THREE.Group | null)[]>([]);

  // Live stellar positions for orbit ring positioning (updated each frame)
  const stellarPositionsRef = useRef<THREE.Vector3[]>(
    systems.map((s) => s.formedCenter.clone()),
  );

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
    const isChrono = mode === TreeMode.CHRONO_STREAM;
    const time = state.clock.elapsedTime;

    // --- Stellar bodies ---
    if (stellarRef.current) {
      let needsUpdate = false;
      systems.forEach((s, i) => {
        const dest = isChrono ? s.chronoCenter : isFormed ? s.formedCenter : s.chaosCenter;
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
        // Stellar body faces origin
        dummy.lookAt(0, 0, 0);
        dummy.updateMatrix();
        stellarRef.current!.setMatrixAt(i, dummy.matrix);

        // Capture live position for orbit rings
        stellarPositionsRef.current[i] = dummy.position.clone();

        needsUpdate = true;
      });
      if (needsUpdate) stellarRef.current.instanceMatrix.needsUpdate = true;
    }

    // --- Planets (dynamic elliptical orbit around stellar center) ---
    const updatePlanetMesh = (
      ref: React.RefObject<THREE.InstancedMesh>,
      data: PlanetBody[],
    ) => {
      if (!ref.current) return;
      let needsUpdate = false;
      data.forEach((p, i) => {
        const sys = systems[p.systemId];
        const stellarPos = stellarPositionsRef.current[p.systemId];
        if (!stellarPos) return;

        // Compute dynamic elliptical orbit offset
        const offset = getEllipticalOrbitOffset(p, sys, mode, time);
        const worldTarget = new THREE.Vector3(
          stellarPos.x + offset.x,
          stellarPos.y + offset.y,
          stellarPos.z + offset.z,
        );

        ref.current!.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        dummy.position.lerp(worldTarget, delta * p.speed);
        // Slow self-rotation
        dummy.rotation.y += delta * 0.05;
        dummy.scale.setScalar(p.scale);
        // Face toward host star
        dummy.lookAt(stellarPos.x, stellarPos.y, stellarPos.z);
        dummy.updateMatrix();
        ref.current!.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
      });
      if (needsUpdate) ref.current.instanceMatrix.needsUpdate = true;
    };

    updatePlanetMesh(majorRef, majors);
    updatePlanetMesh(minorRef, minors);

    // --- Orbit rings: update group position (stellar center) and scale (semiMajor) ---
    orbitRings.forEach((ring, i) => {
      const group = ringRefs.current[i];
      if (!group) return;
      const stellarPos = stellarPositionsRef.current[ring.systemId];
      if (!stellarPos) return;
      const semiMajor = isChrono ? ring.semiMajorChrono
        : isFormed ? ring.semiMajorFormed
        : ring.semiMajorChaos;
      group.position.copy(stellarPos);
      group.scale.setScalar(semiMajor);
    });
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

      {/* v0.4.2: Orbit rings — subtle elliptical lines around each stellar system */}
      <OrbitRingsRenderer rings={orbitRings} mode={mode} ringRefs={ringRefs} />
    </>
  );
};