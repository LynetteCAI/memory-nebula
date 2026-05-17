/**
 * ==================================================================================
 *  MEMORY NEBULA LAYOUT UTILITY
 * ==================================================================================
 * 
 * Deterministic sphere distribution functions for the Memory Nebula Core.
 * 
 * In TreeMode.FORMED (Memory Core aggregated state), all elements collapse
 * into a tight, luminous nebula sphere instead of a Christmas tree cone.
 * Positions are generated deterministically using Fibonacci sphere / golden angle
 * algorithms so they remain stable across renders.
 */

import * as THREE from 'three';

/**
 * Golden ratio constant used for Fibonacci sphere distribution.
 */
const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * Golden angle in radians: PI * (3 - sqrt(5))
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Deterministic pseudo-random value based on index and seed.
 * Produces stable values across renders.
 */
function pseudoRandom(index: number, seed: number = 42): number {
  const x = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// 1. NEBULA CORE PARTICLE POSITIONS (for Foliage/Memory Dust)
// ---------------------------------------------------------------------------

/**
 * Generate a position within the nebula core sphere for a given particle index.
 * 
 * Uses multi-layer Fibonacci sphere distribution with slight noise to create
 * a natural nebula feel rather than a uniform globe.
 * 
 * @param index - Particle index (0 to total-1)
 * @param total - Total number of particles
 * @param radiusScale - Multiplier for the overall radius (default 1.0)
 * @returns THREE.Vector3 position in local space
 */
export function getNebulaCorePosition(
  index: number,
  total: number,
  radiusScale: number = 1.0
): THREE.Vector3 {
  // Normalize index to [0, 1]
  const t = total > 1 ? index / (total - 1) : 0;

  // Determine which shell/layer this particle belongs to
  const layerRnd = pseudoRandom(index, 7);
  
  // 3-layer shell distribution for nebula volume:
  // - Inner core: 0.3 - 1.5  (~25% of particles)
  // - Mid shell:   0.8 - 3.0  (~45% of particles)
  // - Outer shell: 2.0 - 4.2  (~30% of particles)
  let rMin: number, rMax: number;
  
  if (layerRnd < 0.25) {
    // Inner core - denser, brighter center
    rMin = 0.3;
    rMax = 1.5;
  } else if (layerRnd < 0.70) {
    // Mid shell - main nebula body
    rMin = 0.8;
    rMax = 3.0;
  } else {
    // Outer shell - wispy nebula edge
    rMin = 2.0;
    rMax = 4.2;
  }
  
  const r = (rMin + pseudoRandom(index, 13) * (rMax - rMin)) * radiusScale;
  
  // Fibonacci sphere for even distribution on the spherical surface
  // Modified to introduce slight elliptical character
  const elevationAngle = Math.asin(2 * t - 1); // Uniform distribution on sphere
  const azimuthAngle = GOLDEN_ANGLE * index;
  
  // Add slight wave/noise to make it feel like a nebula, not a perfect sphere
  const radialNoise = Math.sin(index * 0.37 + pseudoRandom(index, 19) * 10) * 0.15;
  const rFinal = r * (1 + radialNoise);
  
  // Slight ellipticity: stretch horizontally a tiny bit for a more organic shape
  const ellipticityX = 1.0 + Math.sin(elevationAngle * 3) * 0.04;
  const ellipticityZ = 1.0 + Math.cos(elevationAngle * 3) * 0.04;
  const ellipticityY = 0.98; // Slightly flattened at poles
  
  const cosElev = Math.cos(elevationAngle);
  
  const x = rFinal * cosElev * Math.cos(azimuthAngle) * ellipticityX;
  const z = rFinal * cosElev * Math.sin(azimuthAngle) * ellipticityZ;
  const y = rFinal * Math.sin(elevationAngle) * ellipticityY;
  
  return new THREE.Vector3(x, y, z);
}

// ---------------------------------------------------------------------------
// 2. NEBULA ORNAMENT POSITIONS (for Ornaments / light fragments)
// ---------------------------------------------------------------------------

/**
 * Generate a position for ornaments (light fragments) orbiting the nebula core.
 * 
 * Ornaments are placed in the mid-to-outer layers of the nebula sphere,
 * forming a luminous shell around the core.
 * 
 * @param index - Ornament index
 * @param total - Total ornaments
 * @returns THREE.Vector3 position in local space
 */
export function getNebulaOrnamentPosition(
  index: number,
  total: number
): THREE.Vector3 {
  const t = total > 1 ? index / (total - 1) : 0;
  
  // Ornaments are in mid-to-outer shell
  const layerRnd = pseudoRandom(index, 23);
  let r: number;
  
  if (layerRnd < 0.3) {
    r = 1.2 + pseudoRandom(index, 29) * 1.8; // Mid shell: 1.2 - 3.0
  } else if (layerRnd < 0.7) {
    r = 2.5 + pseudoRandom(index, 31) * 2.0; // Outer shell: 2.5 - 4.5
  } else {
    r = 3.5 + pseudoRandom(index, 37) * 1.3; // Far outer: 3.5 - 4.8
  }
  
  const elevationAngle = Math.asin(2 * t - 1);
  const azimuthAngle = GOLDEN_ANGLE * index + pseudoRandom(index, 41) * 0.3; // Slight jitter
  
  const cosElev = Math.cos(elevationAngle);
  
  // Slightly more elliptical than core particles
  const x = r * cosElev * Math.cos(azimuthAngle) * 1.05;
  const z = r * cosElev * Math.sin(azimuthAngle) * 1.05;
  const y = r * Math.sin(elevationAngle) * 0.95;
  
  return new THREE.Vector3(x, y, z);
}

// ---------------------------------------------------------------------------
// 3. NEBULA PHOTO POSITIONS (for Polaroids in aggregated state)
// ---------------------------------------------------------------------------

export type PhotoLayer = 'inner' | 'middle' | 'outer';

/**
 * v0.4.5: Deterministic 3-layer volume distribution for photos in FORMED state.
 *   Inner:  28% — r 0.9–1.8   embedded within the nebula core outer edge
 *   Middle: 47% — r 1.8–3.2   primary distribution layer
 *   Outer:  25% — r 3.0–4.4   outer orbit, keeps some surrounding feel
 */
export function getNebulaPhotoLayer(index: number, total: number): PhotoLayer {
  if (total <= 1) return 'middle';
  const rnd = pseudoRandom(index, 47);
  if (rnd < 0.28) return 'inner';
  if (rnd < 0.75) return 'middle';
  return 'outer';
}

/**
 * Returns a scale factor for a photo based on layer and total count.
 * v0.4.5: More compact scaling for tighter formed aggregation.
 */
export function getNebulaPhotoScale(index: number, total: number): number {
  const layer = getNebulaPhotoLayer(index, total);
  let base: number;
  if (total <= 12)       base = 0.55;
  else if (total <= 24)  base = 0.48;
  else if (total <= 40)  base = 0.40;
  else                   base = 0.34;

  if (layer === 'inner')  return base * 0.78;
  if (layer === 'middle') return base * 0.92;
  return base * 1.00; // outer
}

/**
 * Generate a position for a polaroid photo in the Memory Nebula Core (FORMED).
 * v0.4.5: Tighter radii and higher inner-layer ratio.
 */
export function getNebulaPhotoPosition(
  index: number,
  total: number
): THREE.Vector3 {
  if (total === 0) return new THREE.Vector3(0, 0, 0);

  const t = total > 1 ? index / (total - 1) : 0;
  const layer = getNebulaPhotoLayer(index, total);

  let rMin: number, rMax: number;
  // v0.4.5: Tighter radii — photos pulled closer into the nebula sphere
  if (layer === 'inner')      { rMin = 0.9; rMax = 1.8; }
  else if (layer === 'middle') { rMin = 1.8; rMax = 3.2; }
  else                         { rMin = 3.0; rMax = 4.4; }

  const r = rMin + pseudoRandom(index, 49) * (rMax - rMin);

  // Fibonacci sphere for even distribution
  const elevationAngle = Math.asin(2 * t - 1);
  const azimuthAngle = GOLDEN_ANGLE * index;

  // Inner layer: more compressed y; outer: slightly wider
  const yScale = layer === 'inner' ? 0.82 : layer === 'middle' ? 0.92 : 1.0;
  const xzScale = layer === 'inner' ? 1.02 : 1.04;

  const cosElev = Math.cos(elevationAngle);
  const heightJitter = Math.sin(index * 0.53 + 1.7) * (layer === 'inner' ? 0.35 : 0.55);

  const x = r * cosElev * Math.cos(azimuthAngle) * xzScale;
  const y = r * Math.sin(elevationAngle) * yScale + heightJitter;
  const z = r * cosElev * Math.sin(azimuthAngle) * xzScale;

  return new THREE.Vector3(x, y, z);
}

// ---------------------------------------------------------------------------
// 4. NEBULA COLOR PALETTE
// ---------------------------------------------------------------------------

/**
 * Nebula color palette - deep space memory theme.
 * Replaces the Christmas red/green palette.
 */
export const NEBULA_COLORS = {
  deepBlue: new THREE.Color('#0a1a3a'),
  midnightNavy: new THREE.Color('#0d1b2a'),
  champagneGold: new THREE.Color('#D4AF37'),
  softIvory: new THREE.Color('#F5E6BF'),
  roseGold: new THREE.Color('#B76E79'),
  nebulaViolet: new THREE.Color('#6B5B95'),
  cyanMist: new THREE.Color('#88CCEE'),
  warmAmber: new THREE.Color('#E8A860'),
  paleBlue: new THREE.Color('#A8C8E8'),
  dustyRose: new THREE.Color('#C49B9B'),
};

/**
 * Returns a color from the nebula palette based on deterministic index selection.
 */
export function getNebulaColor(index: number): THREE.Color {
  const palette = [
    NEBULA_COLORS.champagneGold,
    NEBULA_COLORS.softIvory,
    NEBULA_COLORS.champagneGold,
    NEBULA_COLORS.softIvory,
    NEBULA_COLORS.roseGold,
    NEBULA_COLORS.nebulaViolet,
    NEBULA_COLORS.cyanMist,
    NEBULA_COLORS.warmAmber,
    NEBULA_COLORS.paleBlue,
    NEBULA_COLORS.dustyRose,
    NEBULA_COLORS.champagneGold,
    NEBULA_COLORS.nebulaViolet,
  ];
  return palette[index % palette.length];
}
