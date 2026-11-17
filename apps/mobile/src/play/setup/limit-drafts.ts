import { BASE_WAGER_CEILING, checkLimitInput, type Limit, type LimitAmountProblem, type LimitInputCheck } from '@tableside/engine';

import { formatUnits, withoutGrouping } from '../units';

export interface LimitDraft {
  readonly min: string;
  readonly max: string;
}

export interface LimitGroup<K extends string> {
  readonly key: K;
  readonly label: string;
  readonly help: string;
}

export type LimitEnd = 'min' | 'max';

export interface LimitProblem<K extends string> {
  readonly group: K;
  readonly end: LimitEnd;
  readonly inline: string;
  readonly summary: string;
}

export const draftOf = (limit: Limit): LimitDraft => ({ min: formatUnits(limit.min), max: formatUnits(limit.max) });

export const checkDraft = (draft: LimitDraft): LimitInputCheck => checkLimitInput(withoutGrouping(draft.min), withoutGrouping(draft.max));

const PHRASE: Record<LimitAmountProblem, string> = {
  missing: 'enter an amount',
  'not-a-number': 'digits only, in whole units',
  'not-positive': 'use 1 or more',
  'not-whole': 'whole units only',
  'over-ceiling': `at most ${formatUnits(BASE_WAGER_CEILING.toString())} units`,
};

const sentence = (phrase: string) => `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;

const WONT_CHANGE = "We won't change it for you.";

export function limitProblems<K extends string>(groups: readonly LimitGroup<K>[], drafts: Readonly<Record<K, LimitDraft>>): LimitProblem<K>[] {
  const problems: LimitProblem<K>[] = [];
  for (const group of groups) {
    const draft = drafts[group.key];
    const check = checkDraft(draft);
    if (check.minAboveMax) {
      const where = groups.length === 1 ? 'Table limits' : group.label;
      problems.push({
        group: group.key,
        end: 'min',
        inline: 'More than the maximum. Lower it or raise the maximum.',
        summary: `${where}: the minimum (${draft.min}) is more than the maximum (${draft.max}). ${WONT_CHANGE}`,
      });
    }
    for (const end of ['min', 'max'] as const) {
      const problem = check[end];
      if (!problem) continue;
      const name = groups.length === 1 ? `Table ${end === 'min' ? 'minimum' : 'maximum'}` : `${group.label} ${end === 'min' ? 'minimum' : 'maximum'}`;
      const typed = draft[end].trim();
      problems.push({
        group: group.key,
        end,
        inline: sentence(PHRASE[problem]),
        summary: `${name}: ${PHRASE[problem]}${typed ? ` (you entered ${typed})` : ''}. ${WONT_CHANGE}`,
      });
    }
  }
  return problems;
}

export function acceptedLimits<K extends string>(groups: readonly LimitGroup<K>[], drafts: Readonly<Record<K, LimitDraft>>): Record<K, Limit> | null {
  const limits = {} as Record<K, Limit>;
  for (const group of groups) {
    const { limit } = checkDraft(drafts[group.key]);
    if (!limit) return null;
    limits[group.key] = limit;
  }
  return limits;
}

export function goToLabel<K extends string>(groups: readonly LimitGroup<K>[], problem: LimitProblem<K>): string {
  const end = problem.end === 'min' ? 'minimum' : 'maximum';
  if (groups.length === 1) return `Go to the ${end}`;
  const group = groups.find((g) => g.key === problem.group) as LimitGroup<K>;
  return `Go to the ${group.label.toLowerCase()} ${end}`;
}
