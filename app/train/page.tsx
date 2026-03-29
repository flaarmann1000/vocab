'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchCollections, fetchSettings, saveSettingsAPI, updateCollection } from '@/lib/api';
import { getTtsUrl, playAudio } from '@/lib/tts';
import type { VocabCollection, VocabItem, AppSettings } from '@/lib/types';
import { sm2 } from '@/lib/sm2';

type SessionStatus = 'selecting' | 'training' | 'complete';
type AnswerStatus = 'unanswered' | 'correct' | 'wrong' | 'revealed';
type CardRecord = { status: Exclude<AnswerStatus, 'unanswered'>; userAnswer: string };

function stripPunct(s: string): string {
  return s.normalize('NFD').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export default function TrainPage() {
  const [status, setStatus] = useState<SessionStatus>('selecting');
  const [collections, setCollections] = useState<VocabCollection[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [cards, setCards] = useState<VocabItem[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('unanswered');
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [revealCount, setRevealCount] = useState(0);

  // Per-card answers enable back navigation without re-triggering scoring
  const [cardRecords, setCardRecords] = useState<Record<string, CardRecord>>({});
  // IDs bookmarked for a second pass
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [round, setRound] = useState<'main' | 'saved'>('main');

  const answerRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  // Stable refs so the keyboard handler never closes over stale state
  const cardsRef = useRef(cards);           cardsRef.current = cards;
  const cardIndexRef = useRef(cardIndex);   cardIndexRef.current = cardIndex;
  const answerRef2 = useRef(answer);        answerRef2.current = answer;
  const answerStatusRef = useRef(answerStatus); answerStatusRef.current = answerStatus;
  const cardRecordsRef = useRef(cardRecords);   cardRecordsRef.current = cardRecords;
  const savedIdsRef = useRef(savedIds);         savedIdsRef.current = savedIds;
  const roundRef = useRef(round);               roundRef.current = round;
  const statusRef = useRef(status);             statusRef.current = status;

  // Latest function refs (updated each render)
  const checkAnswerRef = useRef<() => void>(() => {});
  const revealAnswerRef = useRef<() => void>(() => {});
  const advanceRef = useRef<() => void>(() => {});
  const goBackRef = useRef<() => void>(() => {});

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
    return [...allItems].sort((a, b) => (a.nextReview ?? 0) - (b.nextReview ?? 0));
  }

  function resetSession(builtCards: VocabItem[]) {
    setCards(builtCards);
    setCardIndex(0);
    setAnswer('');
    setAnswerStatus('unanswered');
    setCorrectCount(0);
    setWrongCount(0);
    setRevealCount(0);
    setCardRecords({});
    setSavedIds(new Set());
    setRound('main');
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
    resetSession(builtCards);
    setStatus('training');
  }

  // Focus answer input when on a new unanswered card
  useEffect(() => {
    if (status === 'training' && answerStatus === 'unanswered') {
      answerRef.current?.focus();
    }
  }, [status, cardIndex, answerStatus]);

  const currentCard = cards[cardIndex] ?? null;
  const cardFront = settings?.cardFront ?? 'slovak';
  const frontText = currentCard ? (cardFront === 'slovak' ? currentCard.slovak : currentCard.german) : '';
  const backText  = currentCard ? (cardFront === 'slovak' ? currentCard.german  : currentCard.slovak)  : '';

  async function applySpacedRepetition(card: VocabItem, quality: 0 | 5) {
    if (settings?.trainingOrder !== 'spaced') return;
    const updatedItem = sm2(card, quality);
    const col = collections.find((c) => c.items.some((i) => i.id === card.id));
    if (!col) return;
    const updatedCol = { ...col, items: col.items.map((i) => (i.id === updatedItem.id ? updatedItem : i)) };
    await updateCollection(col.id, updatedCol);
    setCollections((prev) => prev.map((c) => (c.id === col.id ? updatedCol : c)));
  }

  /** Navigate to a card index, restoring its recorded answer state if any. */
  function navigateTo(index: number, deck?: VocabItem[]) {
    const d = deck ?? cardsRef.current;
    const card = d[index];
    if (!card) return;
    setCardIndex(index);
    const rec = cardRecordsRef.current[card.id];
    if (rec) {
      setAnswer(rec.userAnswer);
      setAnswerStatus(rec.status);
    } else {
      setAnswer('');
      setAnswerStatus('unanswered');
    }
  }

  const checkAnswer = async () => {
    const card = cardsRef.current[cardIndexRef.current];
    if (!card || answerStatusRef.current !== 'unanswered') return;
    const correct = stripPunct(answerRef2.current) === stripPunct(backText);
    const newStatus: AnswerStatus = correct ? 'correct' : 'wrong';
    setAnswerStatus(newStatus);
    setCardRecords((prev) => ({ ...prev, [card.id]: { status: newStatus, userAnswer: answerRef2.current } }));
    if (correct) setCorrectCount((n) => n + 1);
    else setWrongCount((n) => n + 1);
    await applySpacedRepetition(card, correct ? 5 : 0);
  };
  checkAnswerRef.current = checkAnswer;

  const revealAnswer = async () => {
    const card = cardsRef.current[cardIndexRef.current];
    if (!card || answerStatusRef.current !== 'unanswered') return;
    setAnswerStatus('revealed');
    setCardRecords((prev) => ({ ...prev, [card.id]: { status: 'revealed', userAnswer: answerRef2.current } }));
    setRevealCount((n) => n + 1);
    await applySpacedRepetition(card, 0);
  };
  revealAnswerRef.current = revealAnswer;

  const advance = () => {
    const deck = cardsRef.current;
    const idx  = cardIndexRef.current;
    if (idx + 1 >= deck.length) {
      if (roundRef.current === 'main') {
        const records = cardRecordsRef.current;
        const sIds    = savedIdsRef.current;
        const revisitIds = new Set<string>([
          ...sIds,
          ...deck.filter((c) => { const r = records[c.id]; return r?.status === 'wrong' || r?.status === 'revealed'; }).map((c) => c.id),
        ]);
        if (revisitIds.size > 0) {
          const revisitDeck = deck.filter((c) => revisitIds.has(c.id));
          setCardRecords((prev) => {
            const next = { ...prev };
            for (const c of revisitDeck) delete next[c.id];
            return next;
          });
          setCards(revisitDeck);
          setCardIndex(0);
          setAnswer('');
          setAnswerStatus('unanswered');
          setSavedIds(new Set());
          setRound('saved');
          return;
        }
      }
      setStatus('complete');
    } else {
      navigateTo(idx + 1);
    }
  };
  advanceRef.current = advance;

  const goBack = () => {
    if (cardIndexRef.current > 0) navigateTo(cardIndexRef.current - 1);
  };
  goBackRef.current = goBack;

  const toggleSavedRef = useRef<() => void>(() => {});

  function toggleSaved() {
    const card = cardsRef.current[cardIndexRef.current];
    if (!card) return;
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(card.id)) next.delete(card.id); else next.add(card.id);
      return next;
    });
  }
  toggleSavedRef.current = toggleSaved;

  const playTts = useCallback(async () => {
    if (!currentCard || ttsLoading) return;
    setTtsLoading(true);
    try {
      const url = await getTtsUrl(currentCard.slovak);
      playAudio(url, audioRef);
    } catch { /* ignore */ }
    finally { setTtsLoading(false); }
  }, [currentCard, ttsLoading]);

  // Keyboard handler — registered once, reads current values via refs
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (statusRef.current !== 'training') return;
      const inInput = (e.target as HTMLElement)?.tagName?.toLowerCase() === 'input';

      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        // Enter in input → check (handled by input's own onKeyDown); Enter outside → advance
        if (!inInput && answerStatusRef.current !== 'unanswered') advanceRef.current();
        return;
      }

      if (e.ctrlKey && e.key === ' ') {
        e.preventDefault();
        revealAnswerRef.current();
        return;
      }

      if (!inInput) {
        if (e.key === 'ArrowLeft')  { e.preventDefault(); goBackRef.current(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); advanceRef.current(); }
        if (e.key === ' ' && answerStatusRef.current !== 'unanswered') {
          e.preventDefault();
          advanceRef.current();
        }
        if (e.key === 's' && !e.ctrlKey && !e.metaKey && roundRef.current === 'main') {
          toggleSavedRef.current();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function toggleCollection(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  if (loadingData) return <div className="flex-1 flex items-center justify-center text-zinc-500">Loading…</div>;

  // ── Selector screen ───────────────────────────────────────────────────────────
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
                  <input type="checkbox" checked={selectedIds.includes(col.id)} onChange={() => toggleCollection(col.id)} className="w-4 h-4 accent-orange-500" />
                  <span className="flex-1 text-white font-medium">{col.name}</span>
                  <span className="text-sm text-zinc-500">{col.items.length} words</span>
                </label>
              ))}
            </div>
            <button
              onClick={startTraining}
              disabled={selectedIds.length === 0 || collections.filter((c) => selectedIds.includes(c.id)).flatMap((c) => c.items).length === 0}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-lg"
            >
              Start Training
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Complete screen ───────────────────────────────────────────────────────────
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
          <button onClick={() => { setStatus('selecting'); setCards([]); }} className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-xl transition-colors">
            Train Again
          </button>
          <button
            onClick={() => {
              const selected = collections.filter((c) => selectedIds.includes(c.id));
              const builtCards = buildCards(selected, settings!.trainingOrder);
              resetSession(builtCards);
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

  // ── Training card screen ──────────────────────────────────────────────────────
  const isSaved = currentCard ? savedIds.has(currentCard.id) : false;

  return (
    <div className="flex flex-col flex-1 items-center justify-start px-4 py-8">

      {/* Round badge */}
      {round === 'saved' && (
        <div className="w-full max-w-xl mb-3">
          <span className="inline-block px-3 py-1 bg-orange-900/40 border border-orange-700/50 text-orange-300 text-xs font-semibold rounded-full tracking-wide">
            Round 2 — Saved Words
          </span>
        </div>
      )}

      {/* Progress */}
      <div className="w-full max-w-xl mb-6">
        <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
          <span>Card {cardIndex + 1} / {cards.length}</span>
          <div className="flex gap-3 items-center">
            {round === 'main' && savedIds.size > 0 && (
              <span className="text-orange-400 text-xs">★ {savedIds.size} saved</span>
            )}
            <span className="text-green-400">{correctCount} ✓</span>
            <span className="text-red-400">{wrongCount} ✗</span>
            {revealCount > 0 && <span className="text-zinc-400">{revealCount} shown</span>}
          </div>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${((cardIndex + (answerStatus !== 'unanswered' ? 1 : 0)) / cards.length) * 100}%` }} />
        </div>
      </div>

      {/* Flashcard */}
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl p-8 mb-6 relative">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            {cardFront === 'slovak' ? 'Slovak' : 'German'}
          </span>
          <div className="flex items-center gap-2">
            {round === 'main' && (
              <button
                onClick={toggleSaved}
                className={`text-lg transition-colors ${isSaved ? 'text-orange-400' : 'text-zinc-300 hover:text-orange-300'}`}
                title={isSaved ? 'Remove from saved' : 'Save for later'}
              >
                {isSaved ? '★' : '☆'}
              </button>
            )}
            <button
              onClick={playTts}
              disabled={ttsLoading}
              className="text-xl text-zinc-400 hover:text-zinc-700 transition-colors disabled:opacity-40"
              title="Play pronunciation"
            >
              {ttsLoading ? <span className="animate-spin inline-block">⟳</span> : '🔊'}
            </button>
          </div>
        </div>
        <p className="text-2xl sm:text-4xl font-bold text-zinc-900 text-center mt-4 mb-2 break-words">{frontText}</p>
        {currentCard?.notes && <p className="text-sm text-zinc-400 text-center mt-2">{currentCard.notes}</p>}
      </div>

      {/* Answer / result area */}
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
                className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 text-base focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={checkAnswer}
                disabled={!answer.trim()}
                className="px-5 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-medium rounded-xl transition-colors"
              >
                Check
              </button>
            </div>
            <button
              onClick={revealAnswer}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors text-center py-1"
            >
              Show answer <span className="text-zinc-700 text-xs ml-1">Ctrl+Space</span>
            </button>
          </div>
        ) : (
          <div className={`rounded-xl border p-4 mb-4 ${
            answerStatus === 'correct'  ? 'bg-green-900/30 border-green-700/50'
            : answerStatus === 'revealed' ? 'bg-zinc-800/60 border-zinc-700'
            : 'bg-red-900/30 border-red-700/50'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{answerStatus === 'correct' ? '✓' : answerStatus === 'revealed' ? '👁' : '✗'}</span>
                <span className={`font-semibold ${answerStatus === 'correct' ? 'text-green-300' : answerStatus === 'revealed' ? 'text-zinc-300' : 'text-red-300'}`}>
                  {answerStatus === 'correct' ? 'Correct!' : answerStatus === 'revealed' ? 'Answer' : 'Incorrect'}
                </span>
              </div>
              {round === 'main' && (
                <button
                  onClick={toggleSaved}
                  className={`text-sm transition-colors flex items-center gap-1 ${isSaved ? 'text-orange-400' : 'text-zinc-500 hover:text-orange-300'}`}
                  title="Save for later (s)"
                >
                  {isSaved ? '★' : '☆'} <span className="text-xs text-zinc-600">s</span>
                </button>
              )}
            </div>
            <div className="mb-4">
              {answer.trim() && (
                <div className="mb-2">
                  <p className="text-xs text-zinc-500 mb-0.5">You typed:</p>
                  <p className={`font-medium ${answerStatus === 'correct' ? 'text-green-300' : 'text-red-300'}`}>{answer}</p>
                </div>
              )}
              <p className="text-xs text-zinc-500 mb-0.5">Correct:</p>
              <p className="text-green-300 font-semibold text-lg">{backText}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={advance}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {(() => {
                  if (cardIndex + 1 < cards.length) return 'Continue →';
                  if (round !== 'main') return 'Finish';
                  const records = cardRecords;
                  const revisitCount = new Set<string>([
                    ...savedIds,
                    ...cards.filter((c) => { const r = records[c.id]; return r?.status === 'wrong' || r?.status === 'revealed'; }).map((c) => c.id),
                  ]).size;
                  return revisitCount > 0 ? `Review ${revisitCount} words →` : 'Finish';
                })()}
              </button>
              <span className="text-zinc-600 text-xs">Enter / Space / →</span>
            </div>
          </div>
        )}
      </div>

      {/* Back / forward navigation */}
      {cardIndex > 0 && (
        <div className="w-full max-w-xl mt-4 flex justify-start">
          <button
            onClick={goBack}
            className="text-sm text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1"
            title="Go back (←)"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
