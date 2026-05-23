# Architecture

## Entry Points

- `index.html` — Vite HTML shell
- `index.tsx` — React entry
- `App.tsx` — application state and orchestration
- `types.ts` — shared types

## Components

Components are currently flat in `components/`. They can be grouped by function:

### Scene

- `components/Experience.tsx` — 3D scene entry point (Three.js canvas, camera, lighting)
- `components/Polaroids.tsx` — Polaroid photo cards in 3D space
- `components/Foliage.tsx` — Foliage/particle system (legacy naming, represents nebula dust)
- `components/Ornaments.tsx` — Ornament/particle system (legacy naming, represents star orbs)
- `components/ChronoStreamRibbon.tsx` — Chrono Stream time river ribbon decoration

### Gestures

- `components/GestureController.tsx` — Camera + MediaPipe hand gesture recognition (largest file, ~2070 lines)

### Onboarding

- `components/GestureOnboarding.tsx` — First-time gesture tutorial UI panel
- `components/GestureDemo.tsx` — Tutorial gesture animation demos

### Memory

- `components/MemoryManager.tsx` — Memory library management panel (upload, edit, delete, import/export)
- `components/MemoryModal.tsx` — Memory detail modal

### UI

- `components/UIOverlay.tsx` — Page-level UI overlay (header, buttons, decorative elements)

## Utils

- `utils/nebulaLayout.ts` — Nebula (formed core) layout algorithm
- `utils/constellationLayout.ts` — Constellation (expanded chaos) layout algorithm
- `utils/chronoStreamLayout.ts` — Chrono Stream (time river) layout algorithm
- `utils/memorySort.ts` — Memory date sorting utilities
- `utils/memoryShuffle.ts` — Session-based shuffle for nebula mode variety
- `utils/imageUtils.ts` — Image compression and data URL conversion

## Storage

- `storage/memoryLibraryStore.ts` — IndexedDB CRUD layer for MemoryPhoto objects

## API

- `api/` — Optional Vercel Serverless Functions for Cloudflare R2/KV sharing.
  Not required for local usage.

## Public Assets

- `public/models/` — MediaPipe `hand_landmarker.task` model for gesture recognition
- `public/photos/` — Reserved for local photo exports (currently empty)

## Notes

- `TreeMode`, `Foliage`, and `Ornaments` are historical naming artifacts from the
  original Christmas Tree project. They are preserved to minimize refactoring risk
  in the current version.
- `GestureController.tsx` is large (~2070 lines) and contains MediaPipe setup,
  webcam lifecycle, gesture classification, pinch/swipe/two-hand detection,
  tutorial mode, and debug HUD. Future refactoring could split it into smaller
  hooks and utility modules.
