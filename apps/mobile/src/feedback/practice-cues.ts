// Cues for practice play, read from the practice controller's published
// snapshots. Each committed transition's facts become cues as the transition
// is shown, so a cue mirrors a change already on screen, and the controller
// never waits for one: following it changes no state and no timing.

import { add, compare, decodeMoney, money, type DomainFact, type Money } from '@tableside/engine';

import type { ActivePracticeSnapshot, PracticeController, PracticeSnapshot } from '@/practice/controller';

import type { CueName } from './catalog';
import type { FeedbackService } from './service';

/**
 * The cues for one committed transition's facts. A turn's settled wagers give
 * one cue on the turn's net result, however many wagers settle; a transition
 * that ends a turn settling nothing (a craps roll that only sets the point)
 * gives the "no change" cue, so every turn has exactly one.
 */
export function cuesForFacts(facts: readonly DomainFact[], turnEnded = false): CueName[] {
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
        // A roulette outcome is a pocket; other games' outcomes get their own cues (dice thrown, card dealt).
        if ('pocket' in fact) cues.push('ball-landed');
        break;
      case 'card-dealt':
      case 'hole-card-revealed':
        // One cue per transition, however many cards it deals or turns.
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
  if (!net && turnEnded) net = money(0n);
  if (net) cues.push(({ 1: 'net-win', [-1]: 'net-loss', 0: 'net-even' } as const)[compare(net, money(0n))]);
  return cues;
}

/**
 * Whether this transition ends a turn: it leaves the reveal (the settle step),
 * or rolls and settles in one step (a craps roll during final settlement).
 */
function endsTurn(previous: PracticeSnapshot, next: ActivePracticeSnapshot): boolean {
  if (next.view.phase === 'revealing-outcome') return false;
  const leftReveal = previous.status === 'active' && previous.view.phase === 'revealing-outcome';
  return leftReveal || next.facts.some((fact) => fact.kind === 'dice-rolled');
}

/** Plays the cues for everything the controller shows from now on. Returns a function that stops. */
export function followPractice(controller: PracticeController, feedback: FeedbackService): () => void {
  let last = controller.snapshot();
  return controller.subscribe(() => {
    const previous = last;
    const next = controller.snapshot();
    last = next;
    if (next.status === 'active') {
      // The controller republishes the same transition as input opens and closes; cue it once.
      const newTransition = previous.status !== 'active' || previous.view.sequence !== next.view.sequence || previous.view.activityId !== next.view.activityId;
      if (newTransition) for (const cue of cuesForFacts(next.facts, endsTurn(previous, next))) feedback.cue(cue);
    } else if (next.status === 'completed' && previous.status === 'active') {
      // Results ready, on arrival from the session itself (never when reviewing history).
      feedback.cue('attempt-ended');
    } else if (next.status === 'none' && next.problem === 'invalid-buy-in' && !(previous.status === 'none' && previous.problem === 'invalid-buy-in')) {
      feedback.cue('input-rejected');
    }
  });
}
