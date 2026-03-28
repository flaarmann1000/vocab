import type { VocabCollection, AppSettings } from './types';

export async function fetchCollections(): Promise<VocabCollection[]> {
  const res = await fetch('/api/collections', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch collections');
  return res.json();
}

export async function createCollection(name: string): Promise<VocabCollection> {
  const res = await fetch('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create collection');
  return res.json();
}

export async function updateCollection(id: string, data: Partial<VocabCollection>): Promise<VocabCollection> {
  const res = await fetch(`/api/collections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update collection');
  return res.json();
}

export async function deleteCollectionAPI(id: string): Promise<void> {
  const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete collection');
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch('/api/settings', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function saveSettingsAPI(settings: AppSettings): Promise<void> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to save settings');
}
