/**
 * ==================================================================================
 *  TREE MODE (Memory Nebula State)
 * ==================================================================================
 * 
 * v0.1: Internal naming preserved as TreeMode for minimal-risk migration.
 * 
 * Semantics in Memory Nebula context:
 * - FORMED  → Memory Core aggregated state (nebula sphere collapsed)
 * - CHAOS   → Memory Released state (particles scattered)
 * 
 * v0.2 roadmap: rename to MemoryMode.CORE / MemoryMode.CONSTELLATION
 */
export enum TreeMode {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED'
}

export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface ParticleData {
  chaosPos: [number, number, number];
  formedPos: [number, number, number];
  speed: number;
  color: string;
}
