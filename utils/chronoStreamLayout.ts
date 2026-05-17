/**
 * ==================================================================================
 *  CHRONO STREAM LAYOUT UTILITY (v0.4)
 * ==================================================================================
 *
 * Layout functions for the Chrono Stream / Time River mode.
 *
 * In CHRONO_STREAM, photos are arranged along a horizontal timeline from left
 * (earlier memories) to right (later memories). The current focus photo sits
 * at the center, largest and brightest. Adjacent photos spread outward along
 * the x-axis with decreasing scale and opacity.
 *
 * The layout creates a gentle arc (via sinusoidal y-offset) and depth
 * recession (z-offset) so the stream has a subtle "floating river" feel.
 */

/**
 * Returns the 3D position [x, y, z] for a photo at the given index
 * relative to the current focus.
 *
 * @param index     - Absolute index in the chronoMemories array (chrono-sorted)
 * @param focusIndex - Index of the currently focused photo
 * @param total     - Total number of memories in chrono order
 */
export function getChronoStreamPhotoPosition(
  index: number,
  focusIndex: number,
  total: number
): [number, number, number] {
  if (total === 0) return [0, 0, 0];

  const r = index - focusIndex;
  const abs = Math.abs(r);

  // Horizontal spread along x-axis
  const x = r * 2.2;

  // Gentle sinusoidal arc for visual depth — avoids a flat row
  const y = Math.sin(r * 0.75) * 0.45;

  // Depth recession: photos further from focus move back in z
  const z = -abs * 0.75;

  return [x, y, z];
}

/**
 * Returns the scale multiplier for a photo at the given index relative to focus.
 *
 * Focus photo is largest (1.10), adjacent ones are smaller,
 * and distant photos fade to a minimal size.
 */
export function getChronoStreamPhotoScale(
  index: number,
  focusIndex: number,
  total: number
): number {
  const abs = Math.abs(index - focusIndex);

  if (abs === 0) return 1.10;
  if (abs === 1) return 0.78;
  if (abs === 2) return 0.65;
  return Math.max(0.28, 0.58 - abs * 0.04);
}

/**
 * Returns the opacity multiplier for a photo at the given index relative to focus.
 *
 * Focus photo is fully opaque. Adjacent ones are slightly transparent.
 * Far-away photos are very faint but never fully invisible (no sudden pop-out).
 */
export function getChronoStreamPhotoOpacity(
  index: number,
  focusIndex: number,
  total: number
): number {
  const abs = Math.abs(index - focusIndex);

  if (abs === 0) return 1.0;
  if (abs === 1) return 0.82;
  if (abs === 2) return 0.65;
  return Math.max(0.12, 0.55 - abs * 0.06);
}

/**
 * Returns a hint for how many photos around the focus are considered "visible"
 * in the main viewport. Used for culling / early returns if needed.
 */
export const CHRONO_STREAM_VISIBLE_RANGE = 8;
