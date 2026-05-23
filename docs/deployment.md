# Deployment

## Requirements

- Node.js 20+
- npm

## Local Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:3010` by default.

## Production Build

```bash
npm run build
```

Build output goes to `dist/`.

## Preview Build

After building, you can preview the production build locally:

```bash
npm run preview
```

## Static Hosting

The `dist/` directory can be deployed to any static hosting provider:

- Vercel (recommended, with `vercel.json` provided)
- Netlify
- Cloudflare Pages
- GitHub Pages
- Nginx / Apache static hosting

## Vercel Deployment

A `vercel.json` is included with:

- Build command: `npm run build`
- Output directory: `dist`
- Rewrites: all non-API routes → `index.html` (for client-side routing)

## MediaPipe Model

The gesture recognition system requires the MediaPipe Hand Landmarker model
(`hand_landmarker.task`) at `public/models/hand_landmarker.task`.

**Automatic download**: The model is downloaded automatically via the
`postinstall` hook in `package.json`:

```bash
npm install
# postinstall → npm run download-model → node scripts/download-model.js
```

**Manual download**: If automatic download fails:

```bash
npm run download-model
```

Or run the shell script directly:

```bash
bash scripts/download-model.sh
```

On Windows:

```bat
scripts\download-model.bat
```

**Note**: The model file is ~12MB. If you deploy without it, gesture
recognition will not function, but the 3D memory nebula display will
still work with mouse/keyboard input.
