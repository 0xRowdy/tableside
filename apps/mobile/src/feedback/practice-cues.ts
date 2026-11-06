// Cues for practice play, read from the practice controller's published
// snapshots. Each committed transition's facts become cues as the transition
// is shown, so a cue mirrors a change already on screen, and the controller
// never waits for one: following it changes no state and no timing.

import { add, compare, decodeMoney, money, type DomainFact, type Money } from '@tableside/engine';

import type { ActivePracticeSnapshot, PracticeController, PracticeSnapshot } from '@/practice/controller';

import type { CueName } from './catalog';
import type { FeedbackService } from './service';

/** Where a transition leaves the turn, for its net-result cue. */
export interface TurnProgress {
  /** The transition ends a turn. */
  readonly ended: boolean;
  /** The turn is still under way after it (a blackjack round after the insurance peek). */
  readonly goesOn: boolean;
  /** Net of wagers settled earlier in the same turn that gave no cue of their own. */
  readonly carried: Money | null;
}

const NO_TURN: TurnProgress = { ended: false, goesOn: false, carried: null };

/**
 * The cues for one committed transition's facts. A turn's settled wagers give
 * one cue on the turn's net result, however many wagers settle; a transition
 * that ends a turn settling nothing (a craps roll that only sets the point)
 * gives the "no change" cue, so every turn has exactly one. A wager that
 * settles while its turn goes on (blackjack insurance, at the peek) gives no
 * cue yet: its net is returned as `carried`, to join the cue when the turn ends.
 */
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
  const sum = net && turn.carried ? add(turn.carried, net) : (net ?? turn.carried);
  if (turn.goesOn) return { cues, carried: sum };
  // Only a settlement or a turn's end gives the cue; anything else keeps the carried net waiting.
  if (!net && !turn.ended) return { cues, carried: turn.carried };
  cues.push(({ 1: 'net-win', [-1]: 'net-loss', 0: 'net-even' } as const)[compare(sum ?? money(0n), money(0n))]);
  return { cues, carried: null };
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

/** Whether the turn is still under way after this transition: revealing, or a blackjack hand awaiting a playing action. */
const turnGoesOn = (next: ActivePracticeSnapshot): boolean => next.view.phase === 'revealing-outcome' || next.view.legalCommands.includes('play');

/** Plays the cues for everything the controller shows from now on. Returns a function that stops. */
export function followPractice(controller: PracticeController, feedback: FeedbackService): () => void {
  let last = controller.snapshot();
  let carried: Money | null = null;
  return controller.subscribe(() => {
    const previous = last;
    const next = controller.snapshot();
    last = next;
    if (next.status === 'active') {
      // The controller republishes the same transition as input opens and closes; cue it once.
      const sameActivity = previous.status === 'active' && previous.view.activityId === next.view.activityId;
      if (sameActivity && previous.view.sequence === next.view.sequence) return;
      const transition = cuesForFacts(next.facts, { ended: endsTurn(previous, next), goesOn: turnGoesOn(next), carried: sameActivity ? carried : null });
      carried = transition.carried;
      for (const cue of transition.cues) feedback.cue(cue);
    } else if (next.status === 'completed' && previous.status === 'active') {
      // Results ready, on arrival from the session itself (never when reviewing history).
      feedback.cue('attempt-ended');
    } else if (next.status === 'none' && next.problem === 'invalid-buy-in' && !(previous.status === 'none' && previous.problem === 'invalid-buy-in')) {
      feedback.cue('input-rejected');
    }
  });
}
