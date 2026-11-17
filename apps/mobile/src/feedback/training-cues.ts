// Spec 3 Audio and haptics; Learn, Check and assistance › Answer accepted; #132, #140
import type { StrategyStepAnswer, WorkedExample } from '@tableside/definitions';
import type { ChallengeFact, ChallengeView } from '@tableside/engine';

import { setsPersonalBest } from '@/training/progress';
import type { TrainingService, TrainingSnapshot } from '@/training/service';

import type { CueName } from './catalog';
import type { FeedbackService } from './service';

// Spec 3 Audio and haptics; Amendment 1 B4; #144
export const CONTENT_SHOWN_CUE: CueName = 'card-dealt';
export const learnAnswerCue = (correct: boolean): CueName => (correct ? 'correct' : 'incorrect');

// Spec 3 Amendment 1 B4; #155, #152
export const EXAMPLE_CUES: Readonly<Record<WorkedExample['kind'], { readonly shown: CueName | null; answer(correct: boolean, asks: StrategyStepAnswer['kind'] | null): CueName[] }>> = {
  'card-value': { shown: CONTENT_SHOWN_CUE, answer: (correct) => [learnAnswerCue(correct)] },
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
      if (setsPersonalBest(next.earned)) feedback.cue('milestone');
    }
  });
}
