/**
 * ==================================================================================
 *  MEMORY SHUFFLE UTILITY
 * ==================================================================================
 *
 * v0.4.5: Session-level deterministic shuffle for nebula mode photos.
 *
 * Each page load generates a unique seed, and the shuffle is stable within
 * that session. This means FORMED/CHAOS nebula layouts get a fresh random
 * arrangement every time the user opens the page, while CHRONO_STREAM
 * continues to use strict date ordering.
 */

import { MemoryPhoto } from '../types';

/**
 * Deterministic pseudo-random value from a string ID and integer seed.
 * Returns a float in [0, 1).
 */
function seededHash(id: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  }
  const x = Math.sin(h * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Shuffle memories array deterministically based on a session seed.
 * Does NOT mutate the original array.
 * Same seed + same memories → same order.
 */
export function shuffleMemoriesForSession(
  memories: MemoryPhoto[],
  seed: number
): MemoryPhoto[] {
  if (memories.length <= 1) return [...memories];

  return [...memories].sort((a, b) =>
    seededHash(a.id, seed) - seededHash(b.id, seed)
  );
}
