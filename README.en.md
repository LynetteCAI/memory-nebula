# 🌌 Memory Nebula

> A heavily modified public reference fork of [blackboxo/christmas-tree](https://github.com/blackboxo/christmas-tree)

**Language:** [English](./README.en.md) | [中文](./README.zh-CN.md)

---

## Table of Contents

- [Overview](#overview)
- [Upstream Notice / Licensing Status](#upstream-notice--licensing-status)
- [Features](#features)
- [Major Changes from Upstream](#major-changes-from-upstream)
- [Quick Start](#quick-start)
- [Build & Deploy](#build--deploy)
- [Usage](#usage)
- [Gesture Reference](#gesture-reference)
- [Mouse & Keyboard Controls](#mouse--keyboard-controls)
- [Chrono Stream Mode](#chrono-stream-mode)
- [Data Storage](#data-storage)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Common Commands](#common-commands)
- [FAQ](#faq)
- [Privacy](#privacy)
- [Acknowledgements](#acknowledgements)
- [Copyright and Licensing Notice](#copyright-and-licensing-notice)

---

## Overview

Memory Nebula is an interactive 3D memory space built with **React, Three.js, and MediaPipe**. Users can upload photos and memories, organize them into an explorable memory nebula, and navigate through gestures — expanding the nebula, selecting photos, entering a time-based stream, and browsing memories chronologically.

Ideal as an interactive display for anniversaries, couple's memories, travel logs, family albums, and more.

---

## Upstream Notice / Licensing Status

This repository is a **heavily modified fork** of:

https://github.com/blackboxo/christmas-tree

**The upstream repository did not include an explicit open-source license at the time this fork was created.**

- This repository is published to **preserve development history, document modifications, and provide deployment/reference materials**.
- Original copyright belongs to the original author(s).
- **This repository should not be interpreted as relicensing the original project.**
- This repository does not claim to be MIT, Apache, GPL, or any other open-source license.

---

## Features

- 🌌 **Memory Nebula**: Photos, stardust, and star systems form an explorable 3D nebula
- 🖐️ **Gesture Interaction**: Supports fist, open palm, hand movement, pinch, swipe, two-hand spread/close
- 📸 **Polaroid Photos**: Photos float in the nebula as polaroid-style cards
- 📝 **Memory Details**: Each photo can save title, date, location, description, and story
- 🌊 **Chrono Stream Mode**: Rearranges memories into a time river sorted by date
- 🧭 **Gesture Onboarding**: First-time tutorial guides users through key gestures
- 💾 **Local Persistence**: Photos and memory data stored in browser IndexedDB
- 📤 **Import/Export**: JSON backup and restore for local memory data

---

## Major Changes from Upstream

See [CHANGES.md](./CHANGES.md) for a detailed list of changes.

High-level summary:

- **Project restructured**: From a Christmas tree display page to a full memory nebula interactive space
- **UI completely redesigned**: New visual theme (deep space nebula) and user interface
- **Interaction logic rewritten**: From simple 3D display to full gesture-driven interaction
- **Photo management added**: Upload, edit, delete, import/export photos and memories
- **MediaPipe gesture recognition**: Camera-based hand gesture control
- **Chrono Stream mode added**: Browse memories chronologically along a timeline
- **Data persistence**: IndexedDB storage for photos and memories
- **Optional cloud sharing**: Cloudflare R2/KV sharing capabilities
- **Build system**: Migrated from simple HTML to Vite + React + TypeScript
- **Deployment**: Vercel deployment with Serverless Functions
- **Documentation**: Added architecture, gesture, storage, deployment, and cloud sharing docs

---

## Quick Start

### 1. Clone

```bash
git clone <repository-url>
cd <repository-folder>
```

### 2. Install

Node.js 20+ recommended.

```bash
npm install
```

### 3. Start Development

```bash
npm run dev
```

Default access:

```bash
http://localhost:3010
```

Allow camera access in the browser when prompted to enable gesture recognition.

On first install, the MediaPipe hand model (`hand_landmarker.task`) is downloaded automatically via the `postinstall` script. If it fails, run:

```bash
npm run download-model
```

---

## Build & Deploy

### Build for Production

```bash
npm run build
```

Output goes to:

```bash
dist/
```

### Preview Build

```bash
npm run preview
```

### Deploy

Deploy `dist/` to any static hosting service, e.g.:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages
- Nginx

---

## Usage

### 1. First Visit

The first-time gesture tutorial will guide you through:

1. Show one hand
2. Make a fist
3. Open palm
4. Open palm and circle
5. Pinch (thumb and index finger)
6. Spread both hands
7. Swipe left/right
8. Bring hands together

Check **Don't show again** to skip the tutorial on subsequent visits.
Click **手势教学** (Gesture Tutorial) in the UI to restart it at any time.

---

### 2. Manage Memories

Click **管理回忆** (Manage Memories) to:

- Upload photos
- Fill in title, date, location, description, and story
- Edit existing memories
- Delete individual memories
- Batch delete
- Export JSON backup
- Import JSON data

Photos and data are stored in the browser's IndexedDB.

> Note: Data is local to the current browser. Clearing site data, switching browsers, or changing devices will not preserve data. Regular JSON export is recommended.

---

## Gesture Reference

### Nebula Mode

| Gesture | Action |
|---------|--------|
| Fist | Collapse nebula core; close photo detail |
| Open palm | Expand memory nebula |
| Open palm + move/circle | Orbit and explore nebula view |
| Pinch (thumb + index) | Open selected photo |
| Spread both hands | Enter Chrono Stream mode |

### Chrono Stream Mode

| Gesture | Action |
|---------|--------|
| Swipe left/right | Navigate to previous/next memory |
| Pinch (thumb + index) | Open focused photo |
| Fist | Close photo detail |
| Bring hands together | Exit Chrono Stream, return to nebula |

---

## Mouse & Keyboard Controls

All features are also accessible without gestures:

| Control | Action |
|---------|--------|
| Mouse drag | Rotate camera |
| Mouse wheel | Zoom / navigate in Chrono Stream |
| Click photo | Open memory detail |
| Esc | Close modal / exit Chrono Stream |
| ← / → or A / D | Navigate in Chrono Stream |

---

## Chrono Stream Mode

After expanding the nebula, click **进入时间流** (Enter Chrono Stream) or use the two-hand spread gesture.

In Chrono Stream mode, memories are sorted by date:

- Current photo is centered
- Previous/next photos are arranged along the timeline
- Navigate with arrow keys, scroll wheel, buttons, or left/right swipe gestures
- Click or pinch to open photo details
- Click **回到星云** (Return to Nebula) or bring hands together to exit

---

## Data Storage

This project uses browser local storage by default:

| Data | Storage |
|------|---------|
| Photos & memory info | IndexedDB |
| Gesture tutorial visibility | localStorage |

Local data is never uploaded to any server.
Use **Export JSON** and **Import JSON** for data migration.

---

## Project Structure

```
├── App.tsx                  # Application state and orchestration
├── index.html               # Vite HTML entry
├── index.tsx                # React entry
├── types.ts                 # Shared type definitions
├── vite.config.ts           # Vite build config
├── vercel.json              # Vercel deployment config
├── tsconfig.json            # TypeScript config
├── components/
│   ├── Experience.tsx       # 3D scene entry point
│   ├── Polaroids.tsx        # Polaroid photo cards
│   ├── Foliage.tsx          # Nebula dust particle system (legacy naming)
│   ├── Ornaments.tsx        # Star orb particle system (legacy naming)
│   ├── ChronoStreamRibbon.tsx  # Chrono Stream ribbon decoration
│   ├── GestureController.tsx   # Gesture recognition controller
│   ├── GestureOnboarding.tsx   # Gesture tutorial UI
│   ├── GestureDemo.tsx      # Gesture demo animations
│   ├── MemoryManager.tsx    # Memory management panel
│   ├── MemoryModal.tsx      # Memory detail modal
│   └── UIOverlay.tsx        # Page-level UI overlay
├── utils/
│   ├── nebulaLayout.ts      # Nebula formed-core layout algorithm
│   ├── constellationLayout.ts # Nebula expanded layout algorithm
│   ├── chronoStreamLayout.ts  # Chrono Stream layout algorithm
│   ├── memorySort.ts        # Memory date sorting utilities
│   ├── memoryShuffle.ts     # Session-based shuffle for nebula variety
│   └── imageUtils.ts        # Image compression and conversion
├── storage/
│   └── memoryLibraryStore.ts # IndexedDB CRUD layer
├── api/                     # Vercel Serverless Functions (optional)
├── data/
│   └── memories.ts          # Sample/default memory data
├── docs/
│   ├── architecture.md
│   ├── gestures.md
│   ├── storage.md
│   ├── deployment.md
│   └── cloud-sharing.md
├── public/
│   ├── models/              # MediaPipe hand landmark model
│   └── photos/              # Reserved for local photos (empty)
└── scripts/
    ├── download-model.js
    ├── download-model.sh
    └── download-model.bat
```

---

## Documentation

- [Architecture](./docs/architecture.md) — Codebase structure and component overview
- [Gesture System](./docs/gestures.md) — All gesture controls and detection details
- [Storage](./docs/storage.md) — IndexedDB and localStorage implementation
- [Deployment](./docs/deployment.md) — Build, preview, and deploy instructions
- [Cloud Sharing](./docs/cloud-sharing.md) — Optional R2/KV sharing setup

---

## Common Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## FAQ

### Camera not responding

Check:

1. Camera permission is granted in the browser
2. Page is served via `localhost` or HTTPS
3. No other application is using the camera
4. Refresh the page and re-authorize

### Gesture recognition is unstable

Tips:

1. Keep your hand in the center of the camera view
2. Avoid very dark or very bright backgrounds
3. Perform gestures slowly and deliberately
4. Complete the gesture tutorial first

### Will my photos persist after refresh?

Yes, in the same browser.
Clearing site data, switching browsers, or changing devices will lose data. Use JSON export for backups.

---

## Privacy

This project runs locally in the browser by default. Data is stored in IndexedDB and localStorage.

---

## Acknowledgements

- [blackboxo](https://github.com/blackboxo)'s [Christmas Tree](https://github.com/blackboxo/christmas-tree) project — the original 3D scene this fork was built upon
- [MediaPipe](https://mediapipe.dev) — Hand gesture recognition framework
- [Three.js](https://threejs.org) — 3D rendering engine
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) — React 3D renderer
- [Vite](https://vitejs.dev) — Build tool

---

## Copyright and Licensing Notice

- This repository is a heavily modified fork of [blackboxo/christmas-tree](https://github.com/blackboxo/christmas-tree).
- The upstream repository did not include an explicit open-source license at the time this fork was created.
- Original copyright belongs to the original author(s).
- Modified and added code in this repository is published for reference and display purposes only.
- **This repository should not be interpreted as relicensing the original project, nor does it claim any open-source license.**
