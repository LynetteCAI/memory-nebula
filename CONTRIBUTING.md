# Contributing

Thanks for your interest in contributing to Memory Nebula!

## Setup

```bash
npm install
npm run dev
```

Requires Node.js 20+.

## Building

```bash
npm run build
```

Make sure the build passes before submitting a PR.

## What not to commit

- `.env` / `.env.local` — keep your credentials private
- Local photos or exported JSON files
- `dist/` or `node_modules/`
- Model files under `public/models/` (they are downloaded via `npm run download-model`)

## Gesture changes

If you modify gesture recognition logic (in `components/GestureController.tsx`), please update the gesture table in `README.md`.

## Code style

- Keep changes focused — one PR, one concern
- No large-scale refactors unless discussed in an issue first
- TypeScript strict mode is not enforced project-wide, but new files should be properly typed
