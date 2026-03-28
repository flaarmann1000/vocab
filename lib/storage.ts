import { VocabCollection, AppSettings } from './types';

const COLLECTIONS_KEY = 'vocab_collections';
const SETTINGS_KEY = 'vocab_settings';

const DEFAULT_SETTINGS: AppSettings = {
  trainingOrder: 'random',
  cardFront: 'slovak',
  activeCollectionIds: [],
};

export function getCollections(): VocabCollection[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as VocabCollection[];
  } catch {
    return [];
  }
}

export function saveCollections(collections: VocabCollection[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
}

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
