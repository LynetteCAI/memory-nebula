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
  FORMED = 'FORMED',
  /** v0.4: Chrono Stream — memories arranged by date along a time river */
  CHRONO_STREAM = 'CHRONO_STREAM'
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
  /** v0.3.4: Unix timestamp when created */
  createdAt?: number;
  /** v0.3.4: Unix timestamp of last update */
  updatedAt?: number;
  /** v0.3.4: Display ordering (lower = first). Falls back to createdAt if unset. */
  order?: number;
  /** v0.3.4: Original filename from upload */
  fileName?: string;
}

/**
 * v0.3: Normalize an uploaded photo URL into a MemoryPhoto with sensible defaults.
 * v0.3.4: Extended with optional metadata overrides and new fields.
 */
// ==============================================================================
// v0.6 Gesture Onboarding Tutorial Types
// ==============================================================================

export type TutorialStepId =
  | "camera"
  | "fist"
  | "openPalm"
  | "openPalmOrbit"
  | "pinch"
  | "twoHandSpread"
  | "chronoSwipe"
  | "twoHandGather"
  | "done";

export interface TutorialGestureState {
  handDetected: boolean;
  twoHandsDetected: boolean;

  rawGesture?: string;
  stableGesture?: string;

  openPalmDetected: boolean;
  fistDetected: boolean;

  pinchDetected: boolean;
  rawPinch?: boolean;
  pinchPostureOk?: boolean;
  pinchRatio?: number;
  pinchHoldMs?: number;

  /** v0.6: Simple hand move distance progress (legacy, always 0 in v0.6.3+) */
  handMoveProgress: number;

  // v0.6.3: Open palm orbit tracking — replaces simple handMove
  openPalmOrbitProgress: number;
  openPalmOrbitPathLength: number;
  openPalmOrbitVisitedQuadrants: number;

  twoHandSpreadProgress: number;

  // v0.6.2: Chrono swipe detection
  chronoSwipeLeftDetected: boolean;
  chronoSwipeRightDetected: boolean;
  chronoSwipeProgress: number;
  chronoSwipeDirection?: "left" | "right" | "none";
  chronoSwipeDeltaX?: number;

  // v0.6.2: Two-hand gather detection
  twoHandGatherProgress: number;
  twoHandGatherDistanceX?: number;
  twoHandGatherStartDistanceX?: number;

  lastUpdatedAt?: number;
}

export const defaultTutorialGestureState: TutorialGestureState = {
  handDetected: false,
  twoHandsDetected: false,
  rawGesture: "none",
  stableGesture: "none",
  openPalmDetected: false,
  fistDetected: false,
  pinchDetected: false,
  rawPinch: false,
  pinchPostureOk: false,
  pinchRatio: undefined,
  pinchHoldMs: 0,
  handMoveProgress: 0,
  openPalmOrbitProgress: 0,
  openPalmOrbitPathLength: 0,
  openPalmOrbitVisitedQuadrants: 0,
  twoHandSpreadProgress: 0,
  chronoSwipeLeftDetected: false,
  chronoSwipeRightDetected: false,
  chronoSwipeProgress: 0,
  chronoSwipeDirection: "none",
  twoHandGatherProgress: 0,
};

export function normalizeUploadToMemoryPhoto(
  url: string,
  index: number,
  total: number,
  overrides?: Partial<MemoryPhoto>
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
    createdAt: timestamp,
    updatedAt: timestamp,
    order: index,
    ...overrides,
  };
}
