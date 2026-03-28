'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCollections, saveCollections } from '@/lib/storage';
import { VocabCollection } from '@/lib/types';

export default function CollectionsPage() {
  const [collections, setCollections] = useState<VocabCollection[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const router = useRouter();

  useEffect(() => {
    setCollections(getCollections());
  }, []);

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const newCollection: VocabCollection = {
      id: crypto.randomUUID(),
      name,
      items: [],
      createdAt: Date.now(),
    };
    const updated = [...collections, newCollection];
    saveCollections(updated);
    setCollections(updated);
    setNewName('');
    setShowNewForm(false);
    router.push(`/collections/${newCollection.id}`);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this collection? This cannot be undone.')) return;
    const updated = collections.filter((c) => c.id !== id);
    saveCollections(updated);
    setCollections(updated);
  }

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
                if (e.key === 'Escape') setShowNewForm(false);
              }}
              placeholder="Collection name…"
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
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
              <div>
                <h3 className="font-medium text-white">{collection.name}</h3>
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
