'use client';

import { useState, useRef, useEffect } from 'react';

const LOWER = ['á', 'ä', 'č', 'ď', 'é', 'í', 'ľ', 'ĺ', 'ň', 'ó', 'ô', 'ŕ', 'š', 'ť', 'ú', 'ý', 'ž'];
const UPPER = ['Á', 'Ä', 'Č', 'Ď', 'É', 'Í', 'Ľ', 'Ĺ', 'Ň', 'Ó', 'Ô', 'Ŕ', 'Š', 'Ť', 'Ú', 'Ý', 'Ž'];

interface DiacriticKeyboardProps {
  targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onInsert?: (value: string) => void;
}

export default function DiacriticKeyboard({ targetRef, onInsert }: DiacriticKeyboardProps) {
  const [open, setOpen] = useState(false);
  const [upper, setUpper] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function insertChar(char: string) {
    const el = targetRef.current;
    if (!el) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newValue = el.value.slice(0, start) + char + el.value.slice(end);

    // Use native input setter to trigger React's onChange
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      'value'
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, newValue);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      onInsert?.(newValue);
    }

    // Restore cursor position
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + char.length, start + char.length);
    });
  }

  const chars = upper ? UPPER : LOWER;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-2 py-1 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border border-zinc-600 transition-colors"
        title="Slovak diacritics keyboard"
      >
        á
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl p-2 min-w-max">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">Slovak characters</span>
            <button
              type="button"
              onClick={() => setUpper((u) => !u)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                upper
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-zinc-700 border-zinc-600 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {upper ? 'ABC' : 'abc'}
            </button>
          </div>
          <div className="grid grid-cols-9 gap-1">
            {chars.map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => insertChar(char)}
                className="w-8 h-8 text-sm font-medium rounded bg-zinc-700 hover:bg-blue-600 text-zinc-100 border border-zinc-600 hover:border-blue-500 transition-colors"
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
