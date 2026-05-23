# Cloud Sharing

> Cloud sharing is **optional**. The local Memory Nebula experience works
> entirely without it.

## Overview

The `api/` directory contains Vercel Serverless Functions for optional
cloud sharing. When configured, users can upload photos to Cloudflare R2
and generate shareable links.

## Architecture

```
User's browser
  │
  ├── Upload photos (via presigned URLs) ──→ Cloudflare R2 (photo storage)
  │
  └── Store metadata ──→ Cloudflare KV (share links, 30-day TTL)
```

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/get-upload-urls` | POST | Generate presigned upload URLs |
| `/api/upload` | POST | Upload photos to R2 (direct) |
| `/api/complete-upload` | POST | Finalize upload, store metadata in KV |
| `/api/share?id={id}` | GET | Retrieve shared photos |

## Environment Variables

Required variables are documented in `env.example`:

```
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=memory-nebula-photos
CLOUDFLARE_R2_PUBLIC_URL=
CLOUDFLARE_KV_NAMESPACE_ID=
CLOUDFLARE_KV_API_TOKEN=
```

**Never commit a real `.env` file.** Use `.env.example` as a template
and keep credentials local.

## Without Cloud Sharing

Without these credentials:

- Photos are stored locally in IndexedDB only
- No data is uploaded to any external service
- No shareable links are generated
- All other features (3D display, gestures, memory management) work normally
