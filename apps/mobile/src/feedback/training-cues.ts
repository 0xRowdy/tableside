// Spec 3 Audio and haptics; Learn, Check and assistance › Answer accepted; #132, #140, #137, #138
import type { StrategyStepAnswer, WorkedExample } from '@tableside/definitions';
import { compare, decodeMoney, money, type ChallengeFact, type ChallengeView } from '@tableside/engine';

import { earnsRecord } from '@/training/progress';
import type { TrainingService, TrainingSnapshot } from '@/training/service';

import type { CueName } from './catalog';
import type { FeedbackService } from './service';

// Spec 3 Audio and haptics; Amendment 1 B4; #144
export const CONTENT_SHOWN_CUE: CueName = 'card-dealt';
export const learnAnswerCue = (correct: boolean): CueName => (correct ? 'correct' : 'incorrect');

// Spec 3 Amendment 1 B4; #155, #152, #153
export const EXAMPLE_CUES: Readonly<Record<WorkedExample['kind'], { readonly shown: CueName | null; answer(correct: boolean, asks: StrategyStepAnswer['kind'] | null): CueName[] }>> = {
  'card-value': { shown: CONTENT_SHOWN_CUE, answer: (correct) => [learnAnswerCue(correct)] },
  'running-count': { shown: CONTENT_SHOWN_CUE, answer: (correct) => [learnAnswerCue(correct)] },
  conversion: { shown: CONTENT_SHOWN_CUE, answer: (correct) => [learnAnswerCue(correct)] },
  // Spec 3 Audio and haptics (cue 11 at a table checkpoint)
  'table-count': { shown: 'checkpoint-due', answer: (correct) => [learnAnswerCue(correct)] },
  'strategy-step': {
    shown: null,
    answer: (correct, asks) => {
      if (asks === 'play') return correct ? [] : ['correction-offered'];
      return correct ? ['stake-set'] : ['stake-set', 'correction-offered'];
    },
  },
};

function cuesForChallenge(view: ChallengeView, facts: readonly ChallengeFact[]): CueName[] {
  return facts.flatMap((fact): CueName[] => {
    switch (fact.kind) {
      case 'content-shown':
        return [CONTENT_SHOWN_CUE];
      case 'answer-accepted':
        if (view.variant === 'check') return ['answer-accepted'];
        return [learnAnswerCue(view.feedback?.correct === true)];
      case 'checkpoint-due':
        return ['checkpoint-due'];
      // Spec 3 Learn, Check and assistance › Check: cue 9 is a legality event
      case 'move-refused':
        return ['input-rejected'];
      // Spec 3 Amendment 1 B4: cue 15 on the Play Learn correction pause
      case 'correction-offered':
        return ['correction-offered'];
      // Spec 3 Audio and haptics: cue 2 (Play wager) and cues 6–8 (Play round net result); #139
      case 'wager-placed':
        return ['stake-set'];
      case 'round-settled':
        return [({ 1: 'net-win', [-1]: 'net-loss', 0: 'net-even' } as const)[compare(decodeMoney(fact.net), money(0n))]];
      case 'shoe-shuffled':
      case 'attempt-ended':
        return [];
    }
  });
}

const checking = (snapshot: TrainingSnapshot) => snapshot.status === 'active' && snapshot.view.variant === 'check';

export function followTraining(training: TrainingService, feedback: FeedbackService): () => void {
  let last = training.snapshot();
  feedback.setCheckActive(checking(last));
  return training.subscribe(() => {
    const previous = last;
    const next = training.snapshot();
    last = next;
    feedback.setCheckActive(checking(next));
    if (next.status === 'active') {
      const same = previous.status === 'active' && previous.view.attemptId === next.view.attemptId && previous.view.sequence === next.view.sequence;
      if (!same) for (const cue of cuesForChallenge(next.view, next.facts)) feedback.cue(cue);
    } else if (next.status === 'ended' && previous.status === 'active') {
      feedback.cue('attempt-ended');
      // Spec 3 Comparison groups, records and progression (Milestones); #140
      if (earnsRecord(next.earned)) feedback.cue('milestone');
    }
  });
}
