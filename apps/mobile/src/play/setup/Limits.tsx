// Editable table limits at setup (design frames S1-02, invalid limits T66Sqw):
// each group's minimum and maximum, every problem explained at its field and
// in a banner whose "Go to" moves focus there. Nothing is corrected for the player.

import type { Limit } from '@tableside/engine';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { acceptedLimits, draftOf, goToLabel, limitProblems, type LimitDraft, type LimitGroup, type LimitProblem } from './limit-drafts';
import { LimitFields, ProblemBanner, type LimitRefs } from './SetupParts';

/** Above this text scale the minimum and maximum stack instead of sitting side by side. */
const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;

export function useLimits<K extends string>(groups: readonly LimitGroup<K>[], defaults: Readonly<Record<K, Limit>>) {
  const [drafts, setDrafts] = useState<Record<K, LimitDraft>>(
    () => Object.fromEntries(groups.map((group) => [group.key, draftOf(defaults[group.key])])) as Record<K, LimitDraft>,
  );
  // One mutable holder per screen for the fields' inputs (filled by their ref callbacks).
  const [refs] = useState<LimitRefs<K>>(() => ({}));
  const problems = limitProblems(groups, drafts);
  return {
    groups,
    drafts,
    problems,
    refs,
    /** The limits to play at, or null while a draft has a problem. */
    accepted: acceptedLimits(groups, drafts),
    change: (key: K, next: LimitDraft) => setDrafts((current) => ({ ...current, [key]: next })),
  };
}

export type LimitsState<K extends string> = ReturnType<typeof useLimits<K>>;

/** One group's fields. */
export function GroupFields<K extends string>({ limits, group, showHelp }: { limits: LimitsState<K>; group: LimitGroup<K>; showHelp?: boolean }) {
  const { fontScale } = useWindowDimensions();
  return (
    <LimitFields
      group={group}
      draft={limits.drafts[group.key]}
      problems={limits.problems}
      onChange={(next) => limits.change(group.key, next)}
      refs={limits.refs}
      stacked={fontScale > SIDE_BY_SIDE_MAX_FONT_SCALE}
      {...(showHelp === undefined ? {} : { showHelp })}
    />
  );
}

/** "Fix 2 problems to start", each with a way to its field. */
export function LimitsBanner<K extends string>({ limits }: { limits: LimitsState<K> }) {
  if (limits.problems.length === 0) return null;
  const count = limits.problems.length;
  const goTo = (problem: LimitProblem<K>) => limits.refs[`${problem.group}-${problem.end}`]?.focus();
  return (
    <ProblemBanner
      title={`Fix ${count} problem${count === 1 ? '' : 's'} to start`}
      testID="setup-problems"
      items={limits.problems.map((problem) => ({ text: problem.summary, action: { label: goToLabel(limits.groups, problem), onPress: () => goTo(problem) } }))}
    />
  );
}
