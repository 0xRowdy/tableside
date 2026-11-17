import { add, compare, decodeMoney, money, type DomainFact, type Money } from '@tableside/engine';

import type { ActivePracticeSnapshot, PracticeController, PracticeSnapshot } from '@/practice/controller';

import type { CueName } from './catalog';
import type { FeedbackService } from './service';

export interface TurnProgress {
  readonly ended: boolean;
  readonly goesOn: boolean;
  readonly carried: Money | null;
}

const NO_TURN: TurnProgress = { ended: false, goesOn: false, carried: null };

export function cuesForFacts(facts: readonly DomainFact[], turn: TurnProgress = NO_TURN): { cues: CueName[]; carried: Money | null } {
  const cues: CueName[] = [];
  let net: Money | null = null;
  let returned = false;
  for (const fact of facts) {
    switch (fact.kind) {
      case 'wager-changed':
        cues.push(decodeMoney(fact.amount).n === 0n ? 'wager-removed' : 'stake-set');
        break;
      case 'wager-returned':
        returned = true;
        break;
      case 'outcome-generated':
        if ('pocket' in fact) cues.push('ball-landed');
        break;
      case 'card-dealt':
      case 'hole-card-revealed':
        if (!cues.includes('card-dealt')) cues.push('card-dealt');
        break;
      case 'dice-rolled':
        cues.push('dice-thrown');
        break;
      case 'wager-settled':
        net = add(net ?? money(0n), decodeMoney(fact.net));
        break;
      case 'illegal-action':
        cues.push('input-rejected');
        break;
      case 'correction-offered':
        cues.push('correction-offered');
        break;
      default:
        break;
    }
  }
  if (returned) cues.push('wager-removed');
  const sum = net && turn.carried ? add(turn.carried, net) : (net ?? turn.carried);
  if (turn.goesOn) return { cues, carried: sum };
  if (!net && !turn.ended) return { cues, carried: turn.carried };
  cues.push(({ 1: 'net-win', [-1]: 'net-loss', 0: 'net-even' } as const)[compare(sum ?? money(0n), money(0n))]);
  return { cues, carried: null };
}

function endsTurn(previous: PracticeSnapshot, next: ActivePracticeSnapshot): boolean {
  if (next.view.phase === 'revealing-outcome') return false;
  const leftReveal = previous.status === 'active' && previous.view.phase === 'revealing-outcome';
  return leftReveal || next.facts.some((fact) => fact.kind === 'dice-rolled');
}

const turnGoesOn = (next: ActivePracticeSnapshot): boolean => next.view.phase === 'revealing-outcome' || next.view.legalCommands.includes('play');

export function followPractice(controller: PracticeController, feedback: FeedbackService): () => void {
  let last = controller.snapshot();
  let carried: Money | null = null;
  return controller.subscribe(() => {
    const previous = last;
    const next = controller.snapshot();
    last = next;
    if (next.status === 'active') {
      const sameActivity = previous.status === 'active' && previous.view.activityId === next.view.activityId;
      if (sameActivity && previous.view.sequence === next.view.sequence) return;
      const transition = cuesForFacts(next.facts, { ended: endsTurn(previous, next), goesOn: turnGoesOn(next), carried: sameActivity ? carried : null });
      carried = transition.carried;
      for (const cue of transition.cues) feedback.cue(cue);
    } else if (next.status === 'completed' && previous.status === 'active') {
      feedback.cue('attempt-ended');
    } else if (next.status === 'none' && next.problem === 'invalid-buy-in' && !(previous.status === 'none' && previous.problem === 'invalid-buy-in')) {
      feedback.cue('input-rejected');
    }
  });
}
