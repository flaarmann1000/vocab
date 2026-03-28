'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { updateCollection } from '@/lib/api';
import type { VocabCollection, VocabItem } from '@/lib/types';
import DiacriticKeyboard from '@/components/DiacriticKeyboard';

type Tab = 'manual' | 'upload';

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
const [collection, setCollection] = useState<VocabCollection | null>(null);
  const [tab, setTab] = useState<Tab>('manual');
  const [loading, setLoading] = useState(true);

  // Rename title state
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  // Edit row state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSlovak, setEditSlovak] = useState('');
  const [editGerman, setEditGerman] = useState('');
  const [editNotes, setEditNotes] = useState('');

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
    // Use sessionStorage cache if navigating straight from creation (avoids blob list lag)
    const cached = sessionStorage.getItem(`collection_${id}`);
    if (cached) {
      sessionStorage.removeItem(`collection_${id}`);
      const data = JSON.parse(cached) as VocabCollection;
      setCollection(data);
      setTitleValue(data.name);
      setLoading(false);
      return;
    }

    async function load(retries = 4, delay = 400) {
      const r = await fetch(`/api/collections/${id}`, { cache: 'no-store' });
      if (r.status === 404 && retries > 0) {
        await new Promise((res) => setTimeout(res, delay));
        return load(retries - 1, delay * 1.5);
      }
      if (!r.ok) { window.location.href = '/collections'; return; }
      const data = await r.json();
      setCollection(data);
      setTitleValue(data.name);
    }

    load().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (renamingTitle) titleRef.current?.focus();
  }, [renamingTitle]);

  async function persistCollection(updated: VocabCollection) {
    const saved = await updateCollection(updated.id, updated);
    setCollection(saved);
  }

  async function commitTitleRename() {
    if (!collection) return;
    const name = titleValue.trim();
    if (!name) { setRenamingTitle(false); return; }
    const saved = await updateCollection(collection.id, { name });
    setCollection(saved);
    setRenamingTitle(false);
  }

  function startEditRow(item: VocabItem) {
    setEditingId(item.id);
    setEditSlovak(item.slovak);
    setEditGerman(item.german);
    setEditNotes(item.notes ?? '');
  }

  async function commitEditRow() {
    if (!collection || !editingId) return;
    const updatedItems = collection.items.map((i) =>
      i.id === editingId
        ? { ...i, slovak: editSlovak.trim(), german: editGerman.trim(), notes: editNotes.trim() || undefined }
        : i
    );
    await persistCollection({ ...collection, items: updatedItems });
    setEditingId(null);
  }

  function cancelEditRow() { setEditingId(null); }

  async function handleDeleteItem(itemId: string) {
    if (!collection) return;
    await persistCollection({ ...collection, items: collection.items.filter((i) => i.id !== itemId) });
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
      if (direction === 'slovak') setGermanInput(data.translation ?? '');
      else setSlovakInput(data.translation ?? '');
    } catch { /* ignore */ }
    finally { setTranslating(null); }
  }

  async function handleAddWord() {
    if (!collection || !slovakInput.trim() || !germanInput.trim()) return;
    const newItem: VocabItem = {
      id: crypto.randomUUID(),
      slovak: slovakInput.trim(),
      german: germanInput.trim(),
      notes: notesInput.trim() || undefined,
      createdAt: Date.now(),
    };
    await persistCollection({ ...collection, items: [...collection.items, newItem] });
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
    } catch { alert('Extraction failed. Please try again.'); }
    finally { setExtracting(false); }
  }

  async function handleAddAllExtracted() {
    if (!collection) return;
    const newItems: VocabItem[] = extractedItems
      .filter((i) => i.slovak?.trim() && i.german?.trim())
      .map((i) => ({ id: crypto.randomUUID(), slovak: i.slovak.trim(), german: i.german.trim(), createdAt: Date.now() }));
    if (newItems.length === 0) return;
    await persistCollection({ ...collection, items: [...collection.items, ...newItems] });
    setExtractedItems([]);
    setImageFile(null);
    setImagePreview(null);
    setTab('manual');
  }

  const updateExtractedItem = useCallback((index: number, field: 'slovak' | 'german', value: string) => {
    setExtractedItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }, []);

  if (loading) return <div className="flex items-center justify-center flex-1 text-zinc-500">Loading…</div>;
  if (!collection) return null;

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { window.location.href = '/collections'; }} className="text-zinc-400 hover:text-white transition-colors text-sm">
          ← Collections
        </button>
        <span className="text-zinc-600">/</span>
        {renamingTitle ? (
          <input
            ref={titleRef}
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={commitTitleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitleRename();
              if (e.key === 'Escape') setRenamingTitle(false);
            }}
            className="text-2xl font-semibold text-white bg-zinc-800 border border-blue-500 rounded px-2 py-0.5 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => { setTitleValue(collection.name); setRenamingTitle(true); }}
            className="text-2xl font-semibold text-white hover:text-blue-300 transition-colors group flex items-center gap-2"
            title="Click to rename"
          >
            {collection.name}
            <span className="text-zinc-600 group-hover:text-blue-400 text-base opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
          </button>
        )}
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
              tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t === 'manual' ? 'Manual Entry' : 'Upload Image'}
          </button>
        ))}
      </div>

      {tab === 'manual' && (
        <div>
          {collection.items.length > 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium w-[30%]">Slovak</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium w-[30%]">German</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Notes</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {collection.items.map((item, idx) => (
                    <tr key={item.id} className={`border-b border-zinc-800 last:border-0 ${idx % 2 === 0 ? '' : 'bg-zinc-800/30'}`}>
                      {editingId === item.id ? (
                        <>
                          <td className="px-2 py-2">
                            <input
                              autoFocus
                              type="text"
                              value={editSlovak}
                              onChange={(e) => setEditSlovak(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitEditRow(); if (e.key === 'Escape') cancelEditRow(); }}
                              className="w-full px-2 py-1 bg-zinc-800 border border-blue-500 rounded text-white text-sm focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={editGerman}
                              onChange={(e) => setEditGerman(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitEditRow(); if (e.key === 'Escape') cancelEditRow(); }}
                              className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitEditRow(); if (e.key === 'Escape') cancelEditRow(); }}
                              className="w-full px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            <button onClick={commitEditRow} className="text-green-400 hover:text-green-300 transition-colors mr-2 text-sm font-medium">Save</button>
                            <button onClick={cancelEditRow} className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">✕</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-white font-medium">{item.slovak}</td>
                          <td className="px-4 py-3 text-zinc-300">{item.german}</td>
                          <td className="px-4 py-3 text-zinc-500 text-xs">{item.notes ?? ''}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => startEditRow(item)} className="text-zinc-500 hover:text-blue-400 transition-colors text-sm mr-2" title="Edit">✎</button>
                            <button onClick={() => handleDeleteItem(item.id)} className="text-zinc-600 hover:text-red-400 transition-colors text-base leading-none" title="Delete">✕</button>
                          </td>
                        </>
                      )}
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
            <h2 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wide">Add Word</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
                    {translating === 'german' ? <span className="animate-spin inline-block">⟳</span> : '✦'}
                  </button>
                </div>
              </div>
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
                    {translating === 'slovak' ? <span className="animate-spin inline-block">⟳</span> : '✦'}
                  </button>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-zinc-400 font-medium mb-1.5">Notes <span className="text-zinc-600">(optional)</span></label>
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
              dragOver ? 'border-blue-500 bg-blue-900/10' : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            {imagePreview ? (
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Preview" className="max-h-64 max-w-full object-contain rounded-lg border border-zinc-700" />
                <p className="text-sm text-zinc-400">{imageFile?.name}</p>
                <button onClick={() => { setImageFile(null); setImagePreview(null); setExtractedItems([]); }} className="text-xs text-zinc-500 hover:text-red-400 transition-colors">
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
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageChange(file); }} />
                </label>
              </div>
            )}
          </div>

          {imageFile && (
            <button onClick={handleExtract} disabled={extracting} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors mb-6 flex items-center gap-2">
              {extracting ? <><span className="animate-spin inline-block">⟳</span> Extracting…</> : 'Extract Vocabulary'}
            </button>
          )}

          {extractedItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Extracted Pairs ({extractedItems.length})</h2>
                <button onClick={handleAddAllExtracted} className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors">
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
                          <input type="text" value={item.slovak} onChange={(e) => updateExtractedItem(idx, 'slovak', e.target.value)} className="w-full bg-transparent text-white text-sm focus:outline-none focus:bg-zinc-800 rounded px-1 py-0.5" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="text" value={item.german} onChange={(e) => updateExtractedItem(idx, 'german', e.target.value)} className="w-full bg-transparent text-zinc-300 text-sm focus:outline-none focus:bg-zinc-800 rounded px-1 py-0.5" />
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
