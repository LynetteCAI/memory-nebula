/**
 * ==================================================================================
 *  MEMORY SORT UTILITY (v0.4 Chrono Stream)
 * ==================================================================================
 *
 * Sorting helpers for ordering memories by time in Chrono Stream mode.
 */

import type { MemoryPhoto } from '../types';

/**
 * Compare two memories for chronological ordering.
 *
 * Priority:
 *   1. Valid `date` string (ISO date or similar) — earlier first.
 *   2. If both dates are valid and equal, fall through to createdAt.
 *   3. `createdAt` timestamp — earlier first.
 *   4. `order` field — lower first.
 *   5. If none of the above, preserve original relative order (stable).
 *
 * Memories with invalid/missing dates are sorted to the end.
 */
export function compareMemoryByTime(a: MemoryPhoto, b: MemoryPhoto): number {
  const aDate = parseDate(a.date);
  const bDate = parseDate(b.date);

  // Valid dates take precedence; invalid/null dates go to the end
  if (aDate !== null && bDate !== null) {
    const diff = aDate - bDate;
    if (diff !== 0) return diff;
  } else if (aDate !== null) {
    return -1; // a has valid date, b doesn't → a first
  } else if (bDate !== null) {
    return 1;  // b has valid date, a doesn't → b first
  }

  // Dates equal or both invalid: fall back to createdAt
  const aCreatedAt = a.createdAt ?? 0;
  const bCreatedAt = b.createdAt ?? 0;
  if (aCreatedAt !== bCreatedAt) return aCreatedAt - bCreatedAt;

  // Fall back to order
  const aOrder = a.order ?? 0;
  const bOrder = b.order ?? 0;
  if (aOrder !== bOrder) return aOrder - bOrder;

  return 0; // preserve stable order
}

/**
 * Parse a date string. Returns timestamp (ms) or null.
 * Handles ISO dates (2024-01-15), Chinese dates (2024年1月15日),
 * and simple YYYY-MM-DD formats.
 */
function parseDate(dateStr?: string): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Try ISO / YYYY-MM-DD
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) return parsed;

  // Try Chinese format: 2024年1月15日
  const cnMatch = trimmed.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (cnMatch) {
    const [, y, m, d] = cnMatch;
    const ts = Date.parse(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!isNaN(ts)) return ts;
  }

  return null;
}
