'use client';

import { useState, useEffect } from 'react';
import { fetchCollections, fetchSettings, saveSettingsAPI } from '@/lib/api';
import type { AppSettings, VocabCollection } from '@/lib/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [collections, setCollections] = useState<VocabCollection[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([fetchSettings(), fetchCollections()]).then(([s, cols]) => {
      setSettings(s);
      setCollections(cols);
    });
  }, []);

  async function update(partial: Partial<AppSettings>) {
    if (!settings) return;
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await saveSettingsAPI(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function toggleCollection(id: string) {
    if (!settings) return;
    const active = settings.activeCollectionIds.includes(id)
      ? settings.activeCollectionIds.filter((x) => x !== id)
      : [...settings.activeCollectionIds, id];
    update({ activeCollectionIds: active });
  }

  if (!settings) return <div className="flex-1 flex items-center justify-center text-zinc-500">Loading…</div>;

  return (
    <div className="max-w-xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        {saved && <span className="text-sm text-green-400 transition-opacity">Saved ✓</span>}
      </div>

      {/* Training Order */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">Training Order</h2>
        <div className="flex flex-col gap-3">
          {([
            { value: 'random', label: 'Random', desc: 'Cards appear in a random order each session.' },
            { value: 'sequential', label: 'Sequential', desc: 'Cards appear in the order they were added.' },
            { value: 'spaced', label: 'Spaced Repetition', desc: 'SM-2 algorithm — cards you struggle with appear more often.' },
          ] as const).map(({ value, label, desc }) => (
            <label key={value} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="trainingOrder"
                value={value}
                checked={settings.trainingOrder === value}
                onChange={() => update({ trainingOrder: value })}
                className="mt-0.5 w-4 h-4 accent-blue-500"
              />
              <div>
                <span className="text-white font-medium group-hover:text-blue-300 transition-colors">{label}</span>
                <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Card Front */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">Card Front</h2>
        <div className="flex flex-col gap-3">
          {([
            { value: 'slovak', label: 'Show Slovak', desc: 'The Slovak word is shown; you type the German answer.' },
            { value: 'german', label: 'Show German', desc: 'The German word is shown; you type the Slovak answer.' },
          ] as const).map(({ value, label, desc }) => (
            <label key={value} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="cardFront"
                value={value}
                checked={settings.cardFront === value}
                onChange={() => update({ cardFront: value })}
                className="mt-0.5 w-4 h-4 accent-blue-500"
              />
              <div>
                <span className="text-white font-medium group-hover:text-blue-300 transition-colors">{label}</span>
                <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Active Collections */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-1">Active Collections</h2>
        <p className="text-xs text-zinc-500 mb-4">Pre-selected when you start training.</p>
        {collections.length === 0 ? (
          <p className="text-zinc-600 text-sm">No collections yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {collections.map((col) => (
              <label key={col.id} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.activeCollectionIds.includes(col.id)}
                  onChange={() => toggleCollection(col.id)}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="flex-1 text-white group-hover:text-blue-300 transition-colors">{col.name}</span>
                <span className="text-sm text-zinc-500">{col.items.length} words</span>
              </label>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
