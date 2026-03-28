'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchCollections, fetchSettings, saveSettingsAPI, updateCollection } from '@/lib/api';
import type { VocabCollection, VocabItem, AppSettings } from '@/lib/types';
import { sm2 } from '@/lib/sm2';

type SessionStatus = 'selecting' | 'training' | 'complete';
type AnswerStatus = 'unanswered' | 'correct' | 'wrong' | 'revealed';

export default function TrainPage() {
  const [status, setStatus] = useState<SessionStatus>('selecting');
  const [collections, setCollections] = useState<VocabCollection[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Session state
  const [cards, setCards] = useState<VocabItem[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('unanswered');
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [revealCount, setRevealCount] = useState(0);

  const answerRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetchCollections(), fetchSettings()]).then(([cols, s]) => {
      setCollections(cols);
      setSettings(s);
      setSelectedIds(s.activeCollectionIds);
    }).finally(() => setLoadingData(false));
  }, []);

  function buildCards(colls: VocabCollection[], order: AppSettings['trainingOrder']): VocabItem[] {
    const allItems = colls.flatMap((c) => c.items);
    if (order === 'random') return [...allItems].sort(() => Math.random() - 0.5);
    if (order === 'sequential') return [...allItems].sort((a, b) => a.createdAt - b.createdAt);
    // spaced: cards with no nextReview come first, then by due date
    return [...allItems].sort((a, b) => (a.nextReview ?? 0) - (b.nextReview ?? 0));
  }

  async function startTraining() {
    if (!settings) return;
    const selected = collections.filter((c) => selectedIds.includes(c.id));
    if (selected.length === 0) return;
    const updated = { ...settings, activeCollectionIds: selectedIds };
    setSettings(updated);
    await saveSettingsAPI(updated);
    const builtCards = buildCards(selected, settings.trainingOrder);
    if (builtCards.length === 0) return;
    setCards(builtCards);
    setCardIndex(0);
    setAnswer('');
    setAnswerStatus('unanswered');
    setCorrectCount(0);
    setWrongCount(0);
    setRevealCount(0);
    setStatus('training');
  }

  useEffect(() => {
    if (status === 'training') answerRef.current?.focus();
  }, [status, cardIndex]);

  const currentCard = cards[cardIndex] ?? null;
  const cardFront = settings?.cardFront ?? 'slovak';
  const frontText = currentCard ? (cardFront === 'slovak' ? currentCard.slovak : currentCard.german) : '';
  const backText = currentCard ? (cardFront === 'slovak' ? currentCard.german : currentCard.slovak) : '';

  async function applySpacedRepetition(card: VocabItem, quality: 0 | 5) {
    if (settings?.trainingOrder !== 'spaced') return;
    const updatedItem = sm2(card, quality);
    // Find which collection this card belongs to and update it
    const col = collections.find((c) => c.items.some((i) => i.id === card.id));
    if (!col) return;
    const updatedCol = { ...col, items: col.items.map((i) => (i.id === updatedItem.id ? updatedItem : i)) };
    await updateCollection(col.id, updatedCol);
    setCollections((prev) => prev.map((c) => (c.id === col.id ? updatedCol : c)));
  }

  async function checkAnswer() {
    if (!currentCard || answerStatus !== 'unanswered') return;
    const correct = answer.trim().toLowerCase() === backText.trim().toLowerCase();
    if (correct) {
      setAnswerStatus('correct');
      setCorrectCount((n) => n + 1);
      await applySpacedRepetition(currentCard, 5);
    } else {
      setAnswerStatus('wrong');
      setWrongCount((n) => n + 1);
      await applySpacedRepetition(currentCard, 0);
    }
  }

  async function revealAnswer() {
    if (!currentCard || answerStatus !== 'unanswered') return;
    setAnswerStatus('revealed');
    setRevealCount((n) => n + 1);
    await applySpacedRepetition(currentCard, 0);
  }

  function advance() {
    if (cardIndex + 1 >= cards.length) {
      setStatus('complete');
    } else {
      setCardIndex((i) => i + 1);
      setAnswer('');
      setAnswerStatus('unanswered');
    }
  }

  const playTts = useCallback(async () => {
    if (!currentCard || ttsLoading) return;
    setTtsLoading(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: currentCard.slovak }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
    } catch { /* ignore */ }
    finally { setTtsLoading(false); }
  }, [currentCard, ttsLoading]);

  function toggleCollection(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  if (loadingData) return <div className="flex-1 flex items-center justify-center text-zinc-500">Loading…</div>;

  // Selector screen
  if (status === 'selecting') {
    return (
      <div className="max-w-xl mx-auto w-full px-4 py-10">
        <h1 className="text-2xl font-semibold text-white mb-6">Training Mode</h1>
        {collections.length === 0 ? (
          <div className="text-zinc-500 text-center py-10"><p>No collections yet. Create one first.</p></div>
        ) : (
          <>
            <p className="text-sm text-zinc-400 mb-4">Select collections to train:</p>
            <div className="flex flex-col gap-2 mb-8">
              {collections.map((col) => (
                <label key={col.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 cursor-pointer hover:border-zinc-600 transition-colors">
                  <input type="checkbox" checked={selectedIds.includes(col.id)} onChange={() => toggleCollection(col.id)} className="w-4 h-4 accent-blue-500" />
                  <span className="flex-1 text-white font-medium">{col.name}</span>
                  <span className="text-sm text-zinc-500">{col.items.length} words</span>
                </label>
              ))}
            </div>
            <button
              onClick={startTraining}
              disabled={selectedIds.length === 0 || collections.filter((c) => selectedIds.includes(c.id)).flatMap((c) => c.items).length === 0}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-lg"
            >
              Start Training
            </button>
          </>
        )}
      </div>
    );
  }

  // Complete screen
  if (status === 'complete') {
    const total = correctCount + wrongCount + revealCount;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <div className="max-w-xl mx-auto w-full px-4 py-10 flex flex-col items-center text-center">
        <div className="text-6xl mb-4">{pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'}</div>
        <h1 className="text-3xl font-bold text-white mb-2">Session Complete!</h1>
        <p className="text-zinc-400 mb-8">You trained {total} {total === 1 ? 'card' : 'cards'}.</p>
        <div className="flex gap-4 mb-8 flex-wrap justify-center">
          <div className="bg-green-900/40 border border-green-700/50 rounded-xl px-8 py-4 text-center">
            <div className="text-3xl font-bold text-green-400">{correctCount}</div>
            <div className="text-sm text-green-300/70 mt-1">Correct</div>
          </div>
          <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-8 py-4 text-center">
            <div className="text-3xl font-bold text-red-400">{wrongCount}</div>
            <div className="text-sm text-red-300/70 mt-1">Wrong</div>
          </div>
          {revealCount > 0 && (
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-8 py-4 text-center">
              <div className="text-3xl font-bold text-zinc-300">{revealCount}</div>
              <div className="text-sm text-zinc-400 mt-1">Revealed</div>
            </div>
          )}
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-8 py-4 text-center">
            <div className="text-3xl font-bold text-white">{pct}%</div>
            <div className="text-sm text-zinc-400 mt-1">Score</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setStatus('selecting'); setCards([]); }} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors">
            Train Again
          </button>
          <button
            onClick={() => {
              const selected = collections.filter((c) => selectedIds.includes(c.id));
              const builtCards = buildCards(selected, settings!.trainingOrder);
              setCards(builtCards);
              setCardIndex(0);
              setAnswer('');
              setAnswerStatus('unanswered');
              setCorrectCount(0);
              setWrongCount(0);
              setRevealCount(0);
              setStatus('training');
            }}
            className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-medium rounded-xl transition-colors"
          >
            Restart Same
          </button>
        </div>
      </div>
    );
  }

  // Training card screen
  return (
    <div className="flex flex-col flex-1 items-center justify-start px-4 py-8">
      {/* Progress */}
      <div className="w-full max-w-xl mb-6">
        <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
          <span>Card {cardIndex + 1} / {cards.length}</span>
          <div className="flex gap-3">
            <span className="text-green-400">{correctCount} ✓</span>
            <span className="text-red-400">{wrongCount} ✗</span>
            {revealCount > 0 && <span className="text-zinc-400">{revealCount} shown</span>}
          </div>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${(cardIndex / cards.length) * 100}%` }} />
        </div>
      </div>

      {/* Flashcard */}
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl p-8 mb-6 relative">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            {cardFront === 'slovak' ? 'Slovak' : 'German'}
          </span>
          <button
            onClick={playTts}
            disabled={ttsLoading}
            className="text-xl text-zinc-400 hover:text-zinc-700 transition-colors disabled:opacity-40"
            title="Play Slovak pronunciation"
          >
            {ttsLoading ? '⟳' : '🔊'}
          </button>
        </div>
        <p className="text-4xl font-bold text-zinc-900 text-center mt-4 mb-2 break-words">{frontText}</p>
        {currentCard?.notes && <p className="text-sm text-zinc-400 text-center mt-2">{currentCard.notes}</p>}
      </div>

      {/* Answer area */}
      <div className="w-full max-w-xl">
        {answerStatus === 'unanswered' ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                ref={answerRef}
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') checkAnswer(); }}
                placeholder={`Type the ${cardFront === 'slovak' ? 'German' : 'Slovak'} translation…`}
                className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 text-base focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={checkAnswer}
                disabled={!answer.trim()}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium rounded-xl transition-colors"
              >
                Check
              </button>
            </div>
            <button
              onClick={revealAnswer}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors text-center py-1"
            >
              Show answer
            </button>
          </div>
        ) : (
          <div className={`rounded-xl border p-4 mb-4 ${
            answerStatus === 'correct' ? 'bg-green-900/30 border-green-700/50'
            : answerStatus === 'revealed' ? 'bg-zinc-800/60 border-zinc-700'
            : 'bg-red-900/30 border-red-700/50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{answerStatus === 'correct' ? '✓' : answerStatus === 'revealed' ? '👁' : '✗'}</span>
              <span className={`font-semibold ${answerStatus === 'correct' ? 'text-green-300' : answerStatus === 'revealed' ? 'text-zinc-300' : 'text-red-300'}`}>
                {answerStatus === 'correct' ? 'Correct!' : answerStatus === 'revealed' ? 'Answer' : 'Incorrect'}
              </span>
            </div>
            {answerStatus !== 'correct' && (
              <div className="mb-3">
                {answerStatus === 'wrong' && (
                  <>
                    <p className="text-xs text-zinc-400 mb-0.5">Your answer:</p>
                    <p className="text-red-300 font-medium mb-2">{answer}</p>
                  </>
                )}
                <p className="text-xs text-zinc-400 mb-0.5">Correct answer:</p>
                <p className="text-green-300 font-semibold text-lg">{backText}</p>
              </div>
            )}
            <button
              autoFocus
              onClick={advance}
              onKeyDown={(e) => { if (e.key === 'Enter') advance(); }}
              className="mt-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
