'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCollections, createCollection, updateCollection, deleteCollectionAPI } from '@/lib/api';
import type { VocabCollection } from '@/lib/types';

export default function CollectionsPage() {
  const [collections, setCollections] = useState<VocabCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetchCollections()
      .then(setCollections)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const col = await createCollection(name);
    setNewName('');
    setShowNewForm(false);
    // Cache so detail page doesn't need to re-fetch immediately (blob list eventual consistency)
    sessionStorage.setItem(`collection_${col.id}`, JSON.stringify(col));
    router.push(`/collections/${col.id}`);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this collection? This cannot be undone.')) return;
    await deleteCollectionAPI(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  }

  function startRename(col: VocabCollection) {
    setRenamingId(col.id);
    setRenameValue(col.name);
  }

  async function commitRename(id: string) {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    const updated = await updateCollection(id, { name });
    setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
    setRenamingId(null);
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-zinc-500">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Collections</h1>
        <button
          onClick={() => setShowNewForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Collection
        </button>
      </div>

      {showNewForm && (
        <div className="mb-6 bg-zinc-900 border border-zinc-700 rounded-xl p-4">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">New Collection</h2>
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setShowNewForm(false); setNewName(''); }
              }}
              placeholder="Collection name…"
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500"
            />
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
              Create
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewName(''); }}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {collections.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-lg font-medium mb-1">No collections yet</p>
          <p className="text-sm">Create your first collection to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between hover:border-zinc-700 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-4">
                {renamingId === collection.id ? (
                  <input
                    ref={renameRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(collection.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(collection.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="font-medium text-white bg-zinc-800 border border-blue-500 rounded px-2 py-0.5 w-full focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => startRename(collection)}
                    className="font-medium text-white hover:text-blue-300 transition-colors text-left group flex items-center gap-1.5"
                    title="Click to rename"
                  >
                    {collection.name}
                    <span className="text-zinc-600 group-hover:text-blue-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
                  </button>
                )}
                <p className="text-sm text-zinc-500 mt-0.5">
                  {collection.items.length} {collection.items.length === 1 ? 'word' : 'words'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/collections/${collection.id}`)}
                  className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium rounded-lg transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={() => handleDelete(collection.id)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-red-900/60 text-zinc-400 hover:text-red-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
