import type { VocabCollection, AppSettings } from './types';

const COLLECTIONS_KEY = 'vocab:collections';
const SETTINGS_KEY = 'vocab:settings';

const DEFAULT_SETTINGS: AppSettings = {
  trainingOrder: 'random',
  cardFront: 'slovak',
  activeCollectionIds: [],
};

async function getKV() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import('@vercel/kv');
    return kv;
  }
  return null;
}

// Local file fallback (development without KV env vars)
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
  const { writeFileSync, existsSync, mkdirSync } = await import('fs');
  const { join } = await import('path');
  const dir = join(process.cwd(), '.data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2), 'utf-8');
}

export async function getCollectionsDB(): Promise<VocabCollection[]> {
  const kv = await getKV();
  if (kv) return (await kv.get<VocabCollection[]>(COLLECTIONS_KEY)) ?? [];
  return localRead<VocabCollection[]>('collections.json', []);
}

export async function saveCollectionsDB(collections: VocabCollection[]): Promise<void> {
  const kv = await getKV();
  if (kv) { await kv.set(COLLECTIONS_KEY, collections); return; }
  await localWrite('collections.json', collections);
}

export async function getSettingsDB(): Promise<AppSettings> {
  const kv = await getKV();
  if (kv) {
    const s = await kv.get<AppSettings>(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  }
  return localRead<AppSettings>('settings.json', { ...DEFAULT_SETTINGS });
}

export async function saveSettingsDB(settings: AppSettings): Promise<void> {
  const kv = await getKV();
  if (kv) { await kv.set(SETTINGS_KEY, settings); return; }
  await localWrite('settings.json', settings);
}
