// The launch sound and haptic catalog (docs/decisions/launch-audio-catalog-controls.md,
// spec #51 "Audio and haptics"). Sixteen functional cues, all bundled with the
// app. Event cues mark that something happened; feedback cues judge the
// learner and are withheld while a Check attempt is active.

/** Standard platform haptic patterns. */
export type HapticPattern = 'selection' | 'impact-light' | 'impact-medium' | 'impact-heavy' | 'success' | 'warning' | 'error';

export type CueName =
  | 'card-dealt'
  | 'stake-set'
  | 'wager-removed'
  | 'dice-thrown'
  | 'ball-landed'
  | 'net-win'
  | 'net-loss'
  | 'net-even'
  | 'input-rejected'
  | 'answer-accepted'
  | 'checkpoint-due'
  | 'attempt-ended'
  | 'correct'
  | 'incorrect'
  | 'correction-offered'
  | 'milestone';

export interface Cue {
  /** The catalog number, 1–16. */
  readonly number: number;
  readonly name: CueName;
  readonly kind: 'event' | 'feedback';
  /** The paired haptic, or null (card dealt fires too often to pair one). */
  readonly haptic: HapticPattern | null;
  /** The longest the sound may run: under a second, or two for the wheel. */
  readonly maxMs: number;
  /** The existing visible change or announcement the cue mirrors. A cue never carries anything else. */
  readonly visibleEquivalent: string;
  /** The spec whose activities first fire it; spec 1 wires every cue. */
  readonly firstExercisedBy: 'spec 1' | 'spec 3';
}

const UNDER_A_SECOND = 999;

export const CUES: readonly Cue[] = [
  { number: 1, name: 'card-dealt', kind: 'event', haptic: null, maxMs: UNDER_A_SECOND, visibleEquivalent: 'Card appears or is announced', firstExercisedBy: 'spec 1' },
  { number: 2, name: 'stake-set', kind: 'event', haptic: 'selection', maxMs: UNDER_A_SECOND, visibleEquivalent: 'Wager amount shown', firstExercisedBy: 'spec 1' },
  { number: 3, name: 'wager-removed', kind: 'event', haptic: null, maxMs: UNDER_A_SECOND, visibleEquivalent: 'Wager list updates', firstExercisedBy: 'spec 1' },
  { number: 4, name: 'dice-thrown', kind: 'event', haptic: 'impact-medium', maxMs: UNDER_A_SECOND, visibleEquivalent: 'Dice result shown', firstExercisedBy: 'spec 1' },
  { number: 5, name: 'ball-landed', kind: 'event', haptic: 'impact-light', maxMs: 2000, visibleEquivalent: 'Winning number shown', firstExercisedBy: 'spec 1' },
  { number: 6, name: 'net-win', kind: 'event', haptic: 'success', maxMs: UNDER_A_SECOND, visibleEquivalent: 'Balance and results shown', firstExercisedBy: 'spec 1' },
  { number: 7, name: 'net-loss', kind: 'event', haptic: 'impact-heavy', maxMs: UNDER_A_SECOND, visibleEquivalent: 'Balance and results shown', firstExercisedBy: 'spec 1' },
  { number: 8, name: 'net-even', kind: 'event', haptic: null, maxMs: UNDER_A_SECOND, visibleEquivalent: 'Balance unchanged, results shown', firstExercisedBy: 'spec 1' },
  { number: 9, name: 'input-rejected', kind: 'event', haptic: 'error', maxMs: UNDER_A_SECOND, visibleEquivalent: 'Existing error message', firstExercisedBy: 'spec 1' },
  { number: 10, name: 'answer-accepted', kind: 'event', haptic: 'selection', maxMs: UNDER_A_SECOND, visibleEquivalent: 'Entry clears, next content', firstExercisedBy: 'spec 3' },
  { number: 11, name: 'checkpoint-due', kind: 'event', haptic: null, maxMs: UNDER_A_SECOND, visibleEquivalent: 'The count prompt itself', firstExercisedBy: 'spec 3' },
  { number: 12, name: 'attempt-ended', kind: 'event', haptic: 'impact-light', maxMs: UNDER_A_SECOND, visibleEquivalent: 'Results screen', firstExercisedBy: 'spec 1' },
  { number: 13, name: 'correct', kind: 'feedback', haptic: null, maxMs: UNDER_A_SECOND, visibleEquivalent: 'Correct mark shown', firstExercisedBy: 'spec 3' },
  { number: 14, name: 'incorrect', kind: 'feedback', haptic: 'error', maxMs: UNDER_A_SECOND, visibleEquivalent: 'Explanation shown', firstExercisedBy: 'spec 3' },
  { number: 15, name: 'correction-offered', kind: 'feedback', haptic: 'warning', maxMs: UNDER_A_SECOND, visibleEquivalent: 'Pause dialog', firstExercisedBy: 'spec 1' },
  { number: 16, name: 'milestone', kind: 'feedback', haptic: 'success', maxMs: UNDER_A_SECOND, visibleEquivalent: 'Milestone shown', firstExercisedBy: 'spec 3' },
];

const BY_NAME = new Map(CUES.map((cue) => [cue.name, cue]));

export function cueNamed(name: CueName): Cue {
  return BY_NAME.get(name) as Cue;
}
