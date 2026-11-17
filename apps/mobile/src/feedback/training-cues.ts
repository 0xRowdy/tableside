// Spec 3 Audio and haptics; Learn, Check and assistance › Answer accepted; #132
import type { ChallengeFact, ChallengeView } from '@tableside/engine';

import type { TrainingService, TrainingSnapshot } from '@/training/service';

import type { CueName } from './catalog';
import type { FeedbackService } from './service';

export function cuesForChallenge(view: ChallengeView, facts: readonly ChallengeFact[]): CueName[] {
  return facts.flatMap((fact): CueName[] => {
    switch (fact.kind) {
      case 'content-shown':
        return ['card-dealt'];
      case 'answer-accepted':
        if (view.variant === 'check') return ['answer-accepted'];
        return [view.feedback?.correct ? 'correct' : 'incorrect'];
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
    }
  });
}
