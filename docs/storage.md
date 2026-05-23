# Storage

## IndexedDB

The primary data store. Used for persisting:

- Memory photo data (compressed as JPEG data URLs)
- Memory titles, dates, locations
- Descriptions and stories
- Memory type classification
- Order metadata

### Implementation

- **Database**: `memory-nebula-db` (version 1)
- **Object store**: `memories`
- **Key path**: `id`
- **Indexes**: `date`, `type`, `createdAt`, `updatedAt`
- **Library**: [`idb`](https://www.npmjs.com/package/idb) (promise-based IndexedDB wrapper)

### CRUD Layer

All operations go through `storage/memoryLibraryStore.ts`:

- `getAllMemories()` — retrieve all memories, sorted by order then createdAt
- `saveMemory(memory)` — insert or update a single memory
- `saveMemories(memories)` — batch insert/update
- `deleteMemory(id)` — delete a single memory
- `deleteMemories(ids)` — batch delete
- `clearMemories()` — wipe all data
- `exportMemories()` — export all as JSON array
- `importMemories(memories)` — import JSON array (replaces all data)

### Data Conservation

- Images are compressed to max 1600×1600px at JPEG quality 0.82
- Original files are not retained after compression
- Photos smaller than 50KB JPEG are stored as-is

## localStorage

Used for lightweight preferences:

| Key | Purpose |
|---|---|
| `memory-nebula-hide-gesture-onboarding` | "Don't show again" preference for gesture tutorial |

## Privacy

By default, all data is stored locally:

- Photos and metadata stay in IndexedDB (never sent to any server)
- Camera video frames are processed locally by MediaPipe (never uploaded)
- No analytics or tracking scripts are included

Only if optional Cloudflare R2/KV credentials are configured will data
be uploaded — and only to your own Cloudflare account.
