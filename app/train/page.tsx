'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCollections, getSettings, saveCollections, saveSettings } from '@/lib/storage';
import { VocabCollection, VocabItem, AppSettings } from '@/lib/types';
import { sm2 } from '@/lib/sm2';

type SessionStatus = 'selecting' | 'training' | 'complete';
type AnswerStatus = 'unanswered' | 'correct' | 'wrong';

export default function TrainPage() {
  const [status, setStatus] = useState<SessionStatus>('selecting');
  const [collections, setCollections] = useState<VocabCollection[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Session state
  const [cards, setCards] = useState<VocabItem[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('unanswered');
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  const answerRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  useEffect(() => {
    const allCollections = getCollections();
    const s = getSettings();
    setCollections(allCollections);
    setSettings(s);
    setSelectedIds(s.activeCollectionIds);
  }, []);

  function buildCards(colls: VocabCollection[], order: AppSettings['trainingOrder']): VocabItem[] {
    const allItems = colls.flatMap((c) => c.items);
    if (order === 'random') {
      return [...allItems].sort(() => Math.random() - 0.5);
    } else if (order === 'sequential') {
      return [...allItems].sort((a, b) => a.createdAt - b.createdAt);
    } else {
      // spaced: sort by nextReview ascending, cards with no nextReview come first
      return [...allItems].sort((a, b) => {
        const ar = a.nextReview ?? 0;
        const br = b.nextReview ?? 0;
        return ar - br;
      });
    }
  }

  function startTraining() {
    if (!settings) return;
    const selected = collections.filter((c) => selectedIds.includes(c.id));
    if (selected.length === 0) return;

    // Persist active collection selection
    const updated = { ...settings, activeCollectionIds: selectedIds };
    saveSettings(updated);
    setSettings(updated);

    const builtCards = buildCards(selected, settings.trainingOrder);
    if (builtCards.length === 0) return;

    setCards(builtCards);
    setCardIndex(0);
    setAnswer('');
    setAnswerStatus('unanswered');
    setCorrectCount(0);
    setWrongCount(0);
    setStatus('training');
  }

  useEffect(() => {
    if (status === 'training') {
      answerRef.current?.focus();
    }
  }, [status, cardIndex]);

  const currentCard = cards[cardIndex] ?? null;
  const cardFront = settings?.cardFront ?? 'slovak';
  const frontText = currentCard ? (cardFront === 'slovak' ? currentCard.slovak : currentCard.german) : '';
  const backText = currentCard ? (cardFront === 'slovak' ? currentCard.german : currentCard.slovak) : '';

  function checkAnswer() {
    if (!currentCard || answerStatus !== 'unanswered') return;
    const correct = answer.trim().toLowerCase() === backText.trim().toLowerCase();
    if (correct) {
      setAnswerStatus('correct');
      setCorrectCount((n) => n + 1);
    } else {
      setAnswerStatus('wrong');
      setWrongCount((n) => n + 1);
    }

    // Update spaced repetition data if in spaced mode
    if (settings?.trainingOrder === 'spaced') {
      const quality = correct ? 5 : 0;
      const updatedItem = sm2(currentCard, quality as 0 | 5);
      const allCollections = getCollections();
      const updatedCollections = allCollections.map((col) => ({
        ...col,
        items: col.items.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
      }));
      saveCollections(updatedCollections);
    }
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
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
    } catch {
      // ignore
    } finally {
      setTtsLoading(false);
    }
  }, [currentCard, ttsLoading]);

  function toggleCollection(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Selector screen
  if (status === 'selecting') {
    return (
      <div className="max-w-xl mx-auto w-full px-4 py-10">
        <h1 className="text-2xl font-semibold text-white mb-6">Training Mode</h1>

        {collections.length === 0 ? (
          <div className="text-zinc-500 text-center py-10">
            <p>No collections yet. Create one first.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-400 mb-4">Select collections to train:</p>
            <div className="flex flex-col gap-2 mb-8">
              {collections.map((col) => (
                <label
                  key={col.id}
                  className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 cursor-pointer hover:border-zinc-600 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(col.id)}
                    onChange={() => toggleCollection(col.id)}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <span className="flex-1 text-white font-medium">{col.name}</span>
                  <span className="text-sm text-zinc-500">{col.items.length} words</span>
                </label>
              ))}
            </div>

            <button
              onClick={startTraining}
              disabled={selectedIds.length === 0 || collections.filter(c => selectedIds.includes(c.id)).flatMap(c => c.items).length === 0}
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
    const total = correctCount + wrongCount;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <div className="max-w-xl mx-auto w-full px-4 py-10 flex flex-col items-center text-center">
        <div className="text-6xl mb-4">{pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'}</div>
        <h1 className="text-3xl font-bold text-white mb-2">Session Complete!</h1>
        <p className="text-zinc-400 mb-8">You trained {total} {total === 1 ? 'card' : 'cards'}.</p>

        <div className="flex gap-6 mb-8">
          <div className="bg-green-900/40 border border-green-700/50 rounded-xl px-8 py-4 text-center">
            <div className="text-3xl font-bold text-green-400">{correctCount}</div>
            <div className="text-sm text-green-300/70 mt-1">Correct</div>
          </div>
          <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-8 py-4 text-center">
            <div className="text-3xl font-bold text-red-400">{wrongCount}</div>
            <div className="text-sm text-red-300/70 mt-1">Wrong</div>
          </div>
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-8 py-4 text-center">
            <div className="text-3xl font-bold text-white">{pct}%</div>
            <div className="text-sm text-zinc-400 mt-1">Score</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setStatus('selecting');
              setCards([]);
            }}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
          >
            Train Again
          </button>
          <button
            onClick={() => {
              // Restart with same settings
              const selected = collections.filter((c) => selectedIds.includes(c.id));
              const builtCards = buildCards(selected, settings!.trainingOrder);
              setCards(builtCards);
              setCardIndex(0);
              setAnswer('');
              setAnswerStatus('unanswered');
              setCorrectCount(0);
              setWrongCount(0);
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
      {/* Progress bar */}
      <div className="w-full max-w-xl mb-6">
        <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
          <span>Card {cardIndex + 1} / {cards.length}</span>
          <div className="flex gap-3">
            <span className="text-green-400">{correctCount} correct</span>
            <span className="text-red-400">{wrongCount} wrong</span>
          </div>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${((cardIndex) / cards.length) * 100}%` }}
          />
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
            title="Play pronunciation"
          >
            {ttsLoading ? '⟳' : '🔊'}
          </button>
        </div>
        <p className="text-4xl font-bold text-zinc-900 text-center mt-4 mb-2 break-words">
          {frontText}
        </p>
        {currentCard?.notes && (
          <p className="text-sm text-zinc-400 text-center mt-2">{currentCard.notes}</p>
        )}
      </div>

      {/* Answer area */}
      <div className="w-full max-w-xl">
        {answerStatus === 'unanswered' ? (
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
        ) : (
          <div className={`rounded-xl border p-4 mb-4 ${
            answerStatus === 'correct'
              ? 'bg-green-900/30 border-green-700/50'
              : 'bg-red-900/30 border-red-700/50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{answerStatus === 'correct' ? '✓' : '✗'}</span>
              <span className={`font-semibold ${answerStatus === 'correct' ? 'text-green-300' : 'text-red-300'}`}>
                {answerStatus === 'correct' ? 'Correct!' : 'Incorrect'}
              </span>
            </div>
            {answerStatus === 'wrong' && (
              <div className="mb-3">
                <p className="text-xs text-zinc-400 mb-0.5">Your answer:</p>
                <p className="text-red-300 font-medium">{answer}</p>
                <p className="text-xs text-zinc-400 mt-2 mb-0.5">Correct answer:</p>
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
