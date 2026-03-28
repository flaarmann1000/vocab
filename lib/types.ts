export interface VocabItem {
  id: string;
  slovak: string;
  german: string;
  notes?: string;
  createdAt: number;
  // spaced repetition
  nextReview?: number;
  interval?: number; // days
  easeFactor?: number; // SM-2
  repetitions?: number;
}

export interface VocabCollection {
  id: string;
  name: string;
  items: VocabItem[];
  createdAt: number;
}

export type TrainingOrder = 'random' | 'sequential' | 'spaced';
export type CardFront = 'slovak' | 'german';

export interface AppSettings {
  trainingOrder: TrainingOrder;
  cardFront: CardFront;
  activeCollectionIds: string[];
}
