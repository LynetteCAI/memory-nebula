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

// ==============================================================================
// v0.3 Memory Photo Types
// ==============================================================================

export type MemoryType =
  | "travel"
  | "food"
  | "movie"
  | "daily"
  | "anniversary"
  | "other";

export interface MemoryPhoto {
  id: string;
  url: string;
  title: string;
  date?: string;
  location?: string;
  description?: string;
  story?: string;
  type?: MemoryType;
  source?: "local" | "uploaded" | "shared";
}

/**
 * v0.3: Normalize an uploaded photo URL into a MemoryPhoto with sensible defaults.
 */
export function normalizeUploadToMemoryPhoto(
  url: string,
  index: number,
  total: number
): MemoryPhoto {
  const timestamp = Date.now();
  return {
    id: `uploaded-${index}-${timestamp}`,
    url,
    title: `Memory ${index + 1}`,
    date: "未填写日期",
    location: "",
    description: "这是一段还没有写下文字的回忆。",
    story: "以后可以在这里写下这张照片背后的故事。",
    type: "other",
    source: "uploaded",
  };
}
