import { VocabItem } from './types';

export function sm2(item: VocabItem, quality: 0 | 5): VocabItem {
  // quality: 5 = perfect, 0 = wrong
  const q = quality === 5 ? 5 : 1;
  let { easeFactor = 2.5, interval = 1, repetitions = 0 } = item;
  if (q >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions++;
  } else {
    repetitions = 0;
    interval = 1;
  }
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return {
    ...item,
    easeFactor,
    interval,
    repetitions,
    nextReview: Date.now() + interval * 24 * 60 * 60 * 1000,
  };
}
