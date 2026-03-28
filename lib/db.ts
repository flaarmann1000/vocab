import type { VocabCollection, AppSettings } from './types';

const DEFAULT_SETTINGS: AppSettings = {
  trainingOrder: 'random',
  cardFront: 'slovak',
  activeCollectionIds: [],
};

// ── Blob helpers ──────────────────────────────────────────────────────────────

/**
 * Read a private blob. Uses list() to discover the real URL (put() stores blobs
 * at a URL that only list() reliably returns; get(pathname) constructs a different
 * subdomain and fails). Retries up to `maxAttempts` times to handle the brief
 * window of eventual consistency after a write.
 */
async function blobRead<T>(pathname: string, fallback: T, maxAttempts = 1): Promise<T> {
  const { list } = await import('@vercel/blob');
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? '';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { blobs } = await list({ prefix: pathname });
      const blob = blobs.find((b) => b.pathname === pathname);
      if (blob) {
        // Private blobs require Authorization header — getDownloadUrl() does NOT add auth
        const res = await fetch(blob.url, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) return (await res.json()) as T;
      }
    } catch { /* ignore, retry or return fallback */ }
    if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, 500));
  }
  return fallback;
}

async function blobWrite(pathname: string, data: unknown): Promise<void> {
  const { put } = await import('@vercel/blob');
  await put(pathname, JSON.stringify(data), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// ── Local file fallback (development, no env vars) ────────────────────────────

async function localRead<T>(filename: string, fallback: T): Promise<T> {
  const { readFileSync, existsSync, mkdirSync } = await import('fs');
  const { join } = await import('path');
  const dir = join(process.cwd(), '.data');
  const path = join(dir, filename);
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

async function localWrite(filename: string, data: unknown): Promise<void> {
  if (process.env.VERCEL) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set. Go to your Vercel project → Storage → Create Blob store, link it, then redeploy.'
    );
  }
  const { writeFileSync, existsSync, mkdirSync } = await import('fs');
  const { join } = await import('path');
  const dir = join(process.cwd(), '.data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2), 'utf-8');
}

// ── Public API ────────────────────────────────────────────────────────────────

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// Normal reads (1 attempt — data should be stable)
export async function getCollectionsDB(): Promise<VocabCollection[]> {
  if (useBlob()) return blobRead<VocabCollection[]>('vocab/collections.json', []);
  return localRead<VocabCollection[]>('collections.json', []);
}

// Reads that happen immediately after a write use retries to survive list() lag
export async function getCollectionsDBWithRetry(): Promise<VocabCollection[]> {
  if (useBlob()) return blobRead<VocabCollection[]>('vocab/collections.json', [], 5);
  return localRead<VocabCollection[]>('collections.json', []);
}

export async function saveCollectionsDB(collections: VocabCollection[]): Promise<void> {
  if (useBlob()) { await blobWrite('vocab/collections.json', collections); return; }
  await localWrite('collections.json', collections);
}

export async function getSettingsDB(): Promise<AppSettings> {
  if (useBlob()) return blobRead<AppSettings>('vocab/settings.json', { ...DEFAULT_SETTINGS });
  return localRead<AppSettings>('settings.json', { ...DEFAULT_SETTINGS });
}

export async function saveSettingsDB(settings: AppSettings): Promise<void> {
  if (useBlob()) { await blobWrite('vocab/settings.json', settings); return; }
  await localWrite('settings.json', settings);
}
