// Spec 3 User stories 64–66; Attempt lifecycle › Automatic pacing; Information hiding; #136
import { cardName } from '@/play/blackjack-text';

import type { TrainingService } from './service';

export interface ScreenReaderSpeech {
  announce(message: string): void;
  speaking(): boolean;
}

export const NO_SCREEN_READER: ScreenReaderSpeech = { announce: () => undefined, speaking: () => false };

export function followSpokenCards(training: TrainingService, speech: ScreenReaderSpeech): () => void {
  let last = training.snapshot();
  return training.subscribe(() => {
    const previous = last;
    const next = training.snapshot();
    last = next;
    if (next.status !== 'active' || !next.facts.some((fact) => fact.kind === 'content-shown')) return;
    if (previous.status === 'active' && previous.view.attemptId === next.view.attemptId && previous.view.sequence === next.view.sequence) return;
    const { item } = next.view;
    if (item && 'card' in item) speech.announce(cardName(item.card));
  });
}
