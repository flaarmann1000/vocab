import type { VocabCollection, AppSettings } from './types';

const DEFAULT_SETTINGS: AppSettings = {
  trainingOrder: 'random',
  cardFront: 'slovak',
  activeCollectionIds: [],
};

// ── Blob helpers ──────────────────────────────────────────────────────────────

async function blobRead<T>(pathname: string, fallback: T): Promise<T> {
  try {
    const { get } = await import('@vercel/blob');
    // get() accepts a pathname directly and constructs the URL from the token internally.
    // This avoids list() which has caching/consistency issues after writes.
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) return fallback;
    return await new Response(result.stream).json() as T;
  } catch {
    // BlobNotFoundError on first use, or any other read error → return fallback
    return fallback;
  }
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

export async function getCollectionsDB(): Promise<VocabCollection[]> {
  if (useBlob()) return blobRead<VocabCollection[]>('vocab/collections.json', []);
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
