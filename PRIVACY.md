# Privacy

Memory Nebula is designed to be privacy-respecting. Here's how your data is handled:

## Local-first by default

- **Photos and memories** are stored in your browser's IndexedDB. They never leave your device unless you explicitly choose to share them.
- **Preferences** (e.g., "don't show gesture tutorial again") are stored in localStorage.
- **Camera video** is used only for local MediaPipe hand gesture recognition. Video frames are processed in real time and never uploaded to any server.

## Cloud sharing (optional)

If you configure Cloudflare R2 / KV API credentials, photos and share data may be uploaded to your own Cloudflare account. Memory Nebula does not route your data through any third-party server — the API calls go directly from your browser to Cloudflare's endpoints using credentials you provide.

## Data portability

You can export all your memories as a JSON file (via the "Manage Memories" panel) and import them on another device or browser. This is the recommended way to back up or migrate your data.

## Clearing data

- Clearing your browser's site data (cookies, storage) will delete all local memories.
- Individual memories can be deleted through the "Manage Memories" panel.

## Third-party services

- **MediaPipe** hand landmark model is downloaded from Google's CDN (or your own deployment) when the app first loads.
- **Tailwind CSS** is loaded from CDN for styling.
- No analytics, tracking, or advertising scripts are included.
