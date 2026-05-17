/**
 * v0.3.4: IndexedDB storage layer for Memory Nebula memories.
 *
 * Database: memory-nebula-db
 * Object store: memories
 * Key path: id
 * Indexes: date, type, createdAt, updatedAt
 *
 * Uses the `idb` library for a promise-based API.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { MemoryPhoto } from '../types';

// ---------------------------------------------------------------------------
//  DB Schema
// ---------------------------------------------------------------------------

const DB_NAME = 'memory-nebula-db';
const DB_VERSION = 1;
const STORE_NAME = 'memories';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('date', 'date');
          store.createIndex('type', 'type');
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('updatedAt', 'updatedAt');
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
//  CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Retrieve all memories, sorted by order (ascending), then createdAt (ascending).
 */
export async function getAllMemories(): Promise<MemoryPhoto[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);

  // Sort: order ASC, then createdAt ASC for items without order
  all.sort((a, b) => {
    const oa = a.order ?? a.createdAt ?? 0;
    const ob = b.order ?? b.createdAt ?? 0;
    return oa - ob;
  });

  return all;
}

/**
 * Save a single memory (insert or update).
 */
export async function saveMemory(memory: MemoryPhoto): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, memory);
}

/**
 * Save multiple memories in a single transaction.
 */
export async function saveMemories(memories: MemoryPhoto[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all([
    ...memories.map((m) => tx.store.put(m)),
    tx.done,
  ]);
}

/**
 * Delete a single memory by ID.
 */
export async function deleteMemory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/**
 * Delete multiple memories by IDs in a transaction.
 */
export async function deleteMemories(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all([
    ...ids.map((id) => tx.store.delete(id)),
    tx.done,
  ]);
}

/**
 * Clear all memories from the store.
 */
export async function clearMemories(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

/**
 * Export all memories as a JSON array (for backup).
 */
export async function exportMemories(): Promise<MemoryPhoto[]> {
  return getAllMemories();
}

/**
 * Import memories from a JSON array, replacing all existing data.
 * First clears the store, then writes all imported memories.
 */
export async function importMemories(memories: MemoryPhoto[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.clear();
  await Promise.all([
    ...memories.map((m) => tx.store.put(m)),
    tx.done,
  ]);
}
