// Spec 3 Lessons › Structure (First-use hints), Information hiding (hint content); S1-04 XjwQc; #146

export const HINT_IDS = ['bet-selector', 'count-entry', 'show-count'] as const;

export type HintId = (typeof HINT_IDS)[number];

export interface Hint {
  readonly id: HintId;
  readonly version: number;
  readonly name: string;
  readonly text: string;
}

export const HINT_MAX_LENGTH = 160;

export const HINTS: Readonly<Record<HintId, Hint>> = {
  'bet-selector': {
    id: 'bet-selector',
    version: 1,
    name: 'Bet list',
    text: 'Every wager on this table, as a list you can read. Choosing one opens its editor; nothing is placed until you confirm.',
  },
  'count-entry': {
    id: 'count-entry',
    version: 1,
    name: 'Count entry',
    text: 'Type the count on the keypad, with + / − for its sign, then Submit. Skip moves on and counts as incorrect.',
  },
  'show-count': {
    id: 'show-count',
    version: 1,
    name: 'Show running count',
    text: 'Shows the running count of the cards dealt so far. In Check, showing it marks the whole attempt assisted, even if you hide it again.',
  },
};

export function hintProblems(hints: readonly Hint[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const hint of hints) {
    if (hint.text.length > HINT_MAX_LENGTH) problems.push(`${hint.id}: text is longer than ${HINT_MAX_LENGTH} characters`);
    if (!Number.isInteger(hint.version) || hint.version < 1) problems.push(`${hint.id}: version must be a positive integer`);
    if (seen.has(hint.id)) problems.push(`${hint.id}: repeated id`);
    if (/\d/.test(`${hint.name} ${hint.text}`)) problems.push(`${hint.id}: text carries a number, which could read as a count or an answer`);
    seen.add(hint.id);
  }
  return problems;
}
