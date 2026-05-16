/**
 * ==================================================================================
 *  MEMORY CONSTELLATION LAYOUT UTILITY (v0.2)
 * ==================================================================================
 * 
 * Deterministic spread functions for the Memory Constellation (CHAOS/released state).
 * 
 * When the user opens their hand, the nebula core gracefully expands into a 
 * structured Memory Constellation — a vast, navigable field of dust, planets,
 * crystals, stardust, and photos arranged in arcs and rings.
 * 
 * All positions are deterministic (index-based pseudo-random),
 * so the constellation is stable across renders.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
//  CONSTANTS
// ---------------------------------------------------------------------------

/** Golden angle in radians */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Deterministic pseudo-random [0, 1] from index + seed */
function pRandom(index: number, seed: number): number {
  const x = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// 1. CONSTELLATION DUST POSITIONS (for Foliage / Memory Dust)
// ---------------------------------------------------------------------------

/**
 * Generate the Memory Constellation position for a foliage dust particle.
 * 
 * Three-layer structure:
 *   Layer A: Core Residue (r 1.5–4.5) — leftover glow from the collapsed core
 *   Layer B: Constellation Ring (r 4.5–8.5) — main nebula body with 2 spiral arms
 *   Layer C: Memory Cloud (r 7.0–12) — sparse outer cloud for depth
 * 
 * The result is a wide elliptical nebula field with gentle spiral arms.
 * 
 * @param index - Particle index (0..total-1)
 * @param total - Total particle count
 */
export function getConstellationDustPosition(
  index: number,
  total: number
): THREE.Vector3 {
  const t = total > 1 ? index / (total - 1) : 0;

  // Layer assignment (deterministic)
  const layerRnd = pRandom(index, 101);
  let rMin: number, rMax: number;

  if (layerRnd < 0.22) {
    // Layer A: Core Residue — inner glow
    rMin = 1.5; rMax = 4.5;
  } else if (layerRnd < 0.75) {
    // Layer B: Constellation Ring — main body with spiral arms
    rMin = 4.5; rMax = 8.5;
  } else {
    // Layer C: Memory Cloud — sparse outer
    rMin = 7.0; rMax = 12.0;
  }

  const r = rMin + pRandom(index, 103) * (rMax - rMin);

  // Spiral arm structure for Layer B particles
  // Two arms, offset by PI
  const armIndex = pRandom(index, 107) < 0.5 ? 0 : 1;
  const armOffset = armIndex * Math.PI;
  
  // Base angle: golden-angle spiral that tightens with radius
  const baseAngle = GOLDEN_ANGLE * index * 0.6 + armOffset;
  
  // Spiral wrapping: more twist for Layer B, less for others
  const spiralFactor = (layerRnd >= 0.22 && layerRnd < 0.75) ? 0.25 : 0.08;
  const spiralTwist = r * spiralFactor;
  const azimuthAngle = baseAngle + spiralTwist;

  // Elevation: spread across the sphere but bias toward equator for ring feel
  const rawElevation = Math.asin(2 * t - 1);
  // Slightly flatten for Layer B (constellation ring)
  const flatten = (layerRnd >= 0.22 && layerRnd < 0.75) ? 0.65 : 0.85;
  const elevationAngle = rawElevation * flatten;

  // Deterministic noise on radius
  const rNoise = Math.sin(index * 0.41 + pRandom(index, 109) * 8) * 0.1;
  const rFinal = r * (1 + rNoise);

  const cosElev = Math.cos(elevationAngle);

  // Elliptical: wider horizontally, slightly compressed vertically
  const x = rFinal * cosElev * Math.cos(azimuthAngle) * 1.15;
  const z = rFinal * cosElev * Math.sin(azimuthAngle) * 1.10;
  const y = rFinal * Math.sin(elevationAngle) * 0.85;

  return new THREE.Vector3(x, y, z);
}

// ---------------------------------------------------------------------------
// 2. CONSTELLATION ORNAMENT POSITIONS (for mini planets, crystals, stardust)
// ---------------------------------------------------------------------------

/**
 * Generate the spread position for an ornament (planet/crystal/stardust).
 * 
 * Strategy:
 *   - Planets: distributed in the Constellation Ring (r 5–9), ring-like orbits
 *   - Crystals: mixed ring + cloud (r 4–10), some near photos
 *   - Stardust: wide sparse cloud (r 3–11), depth-providing
 * 
 * Type is determined by ornamentIndex (cycles through types consistently).
 * 
 * @param index - Ornament index
 * @param total - Total ornament count
 * @param ornamentIndex - Sequential index per type (used for spacing)
 * @param ofType - Which type: 'planet' | 'crystal' | 'stardust'
 * @param totalOfType - Total count for this type
 */
export function getConstellationOrnamentPosition(
  index: number,
  total: number,
): { position: THREE.Vector3; typeHint: number } {
  const typeRnd = pRandom(index, 201);
  let typeHint: number; // 0=planet, 1=crystal, 2=stardust
  let rMin: number, rMax: number;

  if (typeRnd < 0.75) {
    typeHint = 0; // planet — constellation ring
  } else if (typeRnd < 0.90) {
    typeHint = 1; // crystal — mixed
  } else {
    typeHint = 2; // stardust — wide sparse
  }

  switch (typeHint) {
    case 0: // Planets: ring orbit
      rMin = 5.0; rMax = 9.0;
      break;
    case 1: // Crystals: mixed ring+cloud
      rMin = 4.0; rMax = 10.0;
      break;
    default: // Stardust: wide sparse
      rMin = 3.0; rMax = 11.0;
      break;
  }

  const r = rMin + pRandom(index, 203) * (rMax - rMin);
  
  // Angle: golden-angle spiral
  const azimuthAngle = GOLDEN_ANGLE * index * (typeHint === 0 ? 0.8 : 0.6);

  // Elevation: spread with slight flattening
  const t = total > 1 ? index / (total - 1) : 0;
  const rawElevation = Math.asin(2 * t - 1);
  const flatten = typeHint === 0 ? 0.55 : 0.75;
  const elevationAngle = rawElevation * flatten;

  // Height jitter per type
  const heightJitter = Math.sin(index * 0.57 + typeHint * 2.1) * (typeHint === 2 ? 1.2 : 0.6);

  const cosElev = Math.cos(elevationAngle);

  const x = r * cosElev * Math.cos(azimuthAngle) * 1.08;
  const z = r * cosElev * Math.sin(azimuthAngle) * 1.05;
  const y = r * Math.sin(elevationAngle) * 0.78 + heightJitter;

  return {
    position: new THREE.Vector3(x, y, z),
    typeHint,
  };
}

// ---------------------------------------------------------------------------
// 3. CONSTELLATION PHOTO POSITIONS (for Polaroids in released state)
// ---------------------------------------------------------------------------

/**
 * Generate the spread position for a polaroid photo in the Memory Constellation.
 * 
 * Photos are arranged in 2–3 constellation arc chains orbiting the center.
 * They face roughly outward / toward the viewer, are well-spaced, and form
 * a navigable memory gallery within the nebula.
 * 
 * Key design:
 *   - 2 or 3 arcs (depending on photo count)
 *   - Each arc has its own radius band and height offset
 *   - Photos face roughly outward (toward center) so viewer sees fronts
 *   - Sufficient spacing — no clustering
 * 
 * @param index - Photo index (0..total-1)
 * @param total - Total photo count
 */
export function getConstellationPhotoPosition(
  index: number,
  total: number
): THREE.Vector3 {
  if (total === 0) return new THREE.Vector3(0, 0, 0);

  // Choose number of arcs based on total
  const numArcs = total <= 6 ? 2 : 3;
  const arcIndex = index % numArcs;

  // Each arc has different radius band and height
  const arcRadiusMin = [5.5, 7.0, 8.5];
  const arcRadiusMax = [7.5, 9.5, 11.0];
  const arcHeightBase = [-1.5, 1.0, 3.0];
  
  const rMin = arcRadiusMin[arcIndex % 3];
  const rMax = arcRadiusMax[arcIndex % 3];
  const heightBase = arcHeightBase[arcIndex % 3];

  const r = rMin + pRandom(index, 301) * (rMax - rMin);

  // Angle: distribute photos within their arc evenly, then offset per arc
  const photosPerArc = Math.ceil(total / numArcs);
  const indexInArc = Math.floor(index / numArcs);
  const angleOffset = arcIndex * (2 * Math.PI / numArcs);
  
  // Use golden angle for even spacing within arc
  const baseAngle = GOLDEN_ANGLE * indexInArc * 1.4 + angleOffset;
  
  // Subtle jitter to avoid perfect alignment
  const angleJitter = pRandom(index, 307) * 0.25 - 0.125;
  const azimuthAngle = baseAngle + angleJitter;

  // Height: arc base + small jitter
  const heightJitter = Math.sin(index * 0.63 + 2.7) * 0.8;
  const y = heightBase + heightJitter;

  // Slightly elliptical in XZ plane
  const x = r * Math.cos(azimuthAngle) * 1.15;
  const z = r * Math.sin(azimuthAngle) * 1.05;

  // Keep photos mostly in front half for better viewing
  // (negative z bias so they don't all hide behind the nebula)
  const zBias = -1.5 + pRandom(index, 311) * 3.0;
  
  return new THREE.Vector3(x, y, z + zBias);
}
