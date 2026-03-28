'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCollections, saveCollections } from '@/lib/storage';
import { VocabCollection, VocabItem } from '@/lib/types';
import DiacriticKeyboard from '@/components/DiacriticKeyboard';

type Tab = 'manual' | 'upload';

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [collection, setCollection] = useState<VocabCollection | null>(null);
  const [tab, setTab] = useState<Tab>('manual');

  // Manual entry state
  const [slovakInput, setSlovakInput] = useState('');
  const [germanInput, setGermanInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [translating, setTranslating] = useState<'slovak' | 'german' | null>(null);

  const slovakRef = useRef<HTMLInputElement>(null);
  const germanRef = useRef<HTMLInputElement>(null);

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<{ slovak: string; german: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const collections = getCollections();
    const found = collections.find((c) => c.id === id);
    if (!found) {
      router.push('/collections');
      return;
    }
    setCollection(found);
  }, [id, router]);

  function persistCollection(updated: VocabCollection) {
    const collections = getCollections();
    const newCollections = collections.map((c) => (c.id === updated.id ? updated : c));
    saveCollections(newCollections);
    setCollection(updated);
  }

  function handleDeleteItem(itemId: string) {
    if (!collection) return;
    const updated = { ...collection, items: collection.items.filter((i) => i.id !== itemId) };
    persistCollection(updated);
  }

  async function handleTranslate(direction: 'slovak' | 'german') {
    const word = direction === 'slovak' ? slovakInput : germanInput;
    if (!word.trim()) return;
    setTranslating(direction);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: word.trim(), from: direction }),
      });
      const data = await res.json();
      if (direction === 'slovak') {
        setGermanInput(data.translation ?? '');
      } else {
        setSlovakInput(data.translation ?? '');
      }
    } catch {
      // ignore
    } finally {
      setTranslating(null);
    }
  }

  function handleAddWord() {
    if (!collection || !slovakInput.trim() || !germanInput.trim()) return;
    const newItem: VocabItem = {
      id: crypto.randomUUID(),
      slovak: slovakInput.trim(),
      german: germanInput.trim(),
      notes: notesInput.trim() || undefined,
      createdAt: Date.now(),
    };
    const updated = { ...collection, items: [...collection.items, newItem] };
    persistCollection(updated);
    setSlovakInput('');
    setGermanInput('');
    setNotesInput('');
    slovakRef.current?.focus();
  }

  function handleImageChange(file: File) {
    setImageFile(file);
    setExtractedItems([]);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleExtract() {
    if (!imageFile) return;
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      const res = await fetch('/api/extract-vocab', { method: 'POST', body: formData });
      const data = await res.json();
      setExtractedItems(data.items ?? []);
    } catch {
      alert('Extraction failed. Please try again.');
    } finally {
      setExtracting(false);
    }
  }

  function handleAddAllExtracted() {
    if (!collection) return;
    const newItems: VocabItem[] = extractedItems
      .filter((i) => i.slovak?.trim() && i.german?.trim())
      .map((i) => ({
        id: crypto.randomUUID(),
        slovak: i.slovak.trim(),
        german: i.german.trim(),
        createdAt: Date.now(),
      }));
    if (newItems.length === 0) return;
    const updated = { ...collection, items: [...collection.items, ...newItems] };
    persistCollection(updated);
    setExtractedItems([]);
    setImageFile(null);
    setImagePreview(null);
    setTab('manual');
  }

  const updateExtractedItem = useCallback(
    (index: number, field: 'slovak' | 'german', value: string) => {
      setExtractedItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  if (!collection) {
    return (
      <div className="flex items-center justify-center flex-1 text-zinc-500">Loading…</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/collections')}
          className="text-zinc-400 hover:text-white transition-colors text-sm"
        >
          ← Collections
        </button>
        <span className="text-zinc-600">/</span>
        <h1 className="text-2xl font-semibold text-white">{collection.name}</h1>
        <span className="text-sm text-zinc-500 ml-auto">
          {collection.items.length} {collection.items.length === 1 ? 'word' : 'words'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {(['manual', 'upload'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t === 'manual' ? 'Manual Entry' : 'Upload Image'}
          </button>
        ))}
      </div>

      {tab === 'manual' && (
        <div>
          {/* Word table */}
          {collection.items.length > 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium w-[35%]">Slovak</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium w-[35%]">German</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Notes</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {collection.items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`border-b border-zinc-800 last:border-0 ${
                        idx % 2 === 0 ? '' : 'bg-zinc-800/30'
                      }`}
                    >
                      <td className="px-4 py-3 text-white font-medium">{item.slovak}</td>
                      <td className="px-4 py-3 text-zinc-300">{item.german}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{item.notes ?? ''}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-zinc-600 hover:text-red-400 transition-colors text-base leading-none"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-zinc-600 bg-zinc-900 border border-zinc-800 rounded-xl mb-6">
              <p>No words yet. Add your first word below.</p>
            </div>
          )}

          {/* Add word form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wide">
              Add Word
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Slovak field */}
              <div>
                <label className="block text-xs text-zinc-400 font-medium mb-1.5">Slovak</label>
                <div className="flex gap-2">
                  <input
                    ref={slovakRef}
                    type="text"
                    value={slovakInput}
                    onChange={(e) => setSlovakInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddWord(); }}
                    placeholder="slovenský…"
                    className="flex-1 min-w-0 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <DiacriticKeyboard targetRef={slovakRef} />
                  <button
                    type="button"
                    onClick={() => handleTranslate('german')}
                    disabled={!germanInput.trim() || translating !== null}
                    title="Auto-translate from German"
                    className="px-2 py-1 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border border-zinc-600 disabled:opacity-40 transition-colors"
                  >
                    {translating === 'german' ? (
                      <span className="animate-spin inline-block">⟳</span>
                    ) : '✦'}
                  </button>
                </div>
              </div>

              {/* German field */}
              <div>
                <label className="block text-xs text-zinc-400 font-medium mb-1.5">German</label>
                <div className="flex gap-2">
                  <input
                    ref={germanRef}
                    type="text"
                    value={germanInput}
                    onChange={(e) => setGermanInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddWord(); }}
                    placeholder="Deutsch…"
                    className="flex-1 min-w-0 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleTranslate('slovak')}
                    disabled={!slovakInput.trim() || translating !== null}
                    title="Auto-translate from Slovak"
                    className="px-2 py-1 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border border-zinc-600 disabled:opacity-40 transition-colors"
                  >
                    {translating === 'slovak' ? (
                      <span className="animate-spin inline-block">⟳</span>
                    ) : '✦'}
                  </button>
                </div>
              </div>
            </div>

            {/* Notes field */}
            <div className="mb-4">
              <label className="block text-xs text-zinc-400 font-medium mb-1.5">
                Notes <span className="text-zinc-600">(optional)</span>
              </label>
              <input
                type="text"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddWord(); }}
                placeholder="e.g. grammar note, example sentence…"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleAddWord}
              disabled={!slovakInput.trim() || !germanInput.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Add Word
            </button>
          </div>
        </div>
      )}

      {tab === 'upload' && (
        <div>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file && file.type.startsWith('image/')) handleImageChange(file);
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors mb-5 ${
              dragOver
                ? 'border-blue-500 bg-blue-900/10'
                : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            {imagePreview ? (
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-64 max-w-full object-contain rounded-lg border border-zinc-700"
                />
                <p className="text-sm text-zinc-400">{imageFile?.name}</p>
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); setExtractedItems([]); }}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="text-zinc-500">
                <div className="text-4xl mb-3">🖼️</div>
                <p className="text-sm font-medium mb-1">Drag & drop an image here</p>
                <p className="text-xs text-zinc-600 mb-4">or</p>
                <label className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium rounded-lg cursor-pointer transition-colors">
                  Choose File
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageChange(file);
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {imageFile && (
            <button
              onClick={handleExtract}
              disabled={extracting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors mb-6 flex items-center gap-2"
            >
              {extracting ? (
                <>
                  <span className="animate-spin inline-block">⟳</span>
                  Extracting…
                </>
              ) : (
                'Extract Vocabulary'
              )}
            </button>
          )}

          {extractedItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
                  Extracted Pairs ({extractedItems.length})
                </h2>
                <button
                  onClick={handleAddAllExtracted}
                  className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Add All to Collection
                </button>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left px-4 py-3 text-zinc-400 font-medium">Slovak</th>
                      <th className="text-left px-4 py-3 text-zinc-400 font-medium">German</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedItems.map((item, idx) => (
                      <tr key={idx} className={`border-b border-zinc-800 last:border-0 ${idx % 2 === 0 ? '' : 'bg-zinc-800/30'}`}>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.slovak}
                            onChange={(e) => updateExtractedItem(idx, 'slovak', e.target.value)}
                            className="w-full bg-transparent text-white text-sm focus:outline-none focus:bg-zinc-800 rounded px-1 py-0.5"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={item.german}
                            onChange={(e) => updateExtractedItem(idx, 'german', e.target.value)}
                            className="w-full bg-transparent text-zinc-300 text-sm focus:outline-none focus:bg-zinc-800 rounded px-1 py-0.5"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
