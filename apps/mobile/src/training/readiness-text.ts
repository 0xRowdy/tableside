// Spec 3 S3-01 PDCaD, S3-08 CEb6T, nXGFk, S3-10 OVKkc; Comparison groups; #141

import type { ChallengeAttemptRecord, ChallengeGroupKey } from '@tableside/engine';

import { dayText } from '@/account/account-text';
import { GAME_WORDS } from '@/play/game-words';

import { CATEGORY_TEXT, pacingLabel, scoreText, timerText, variantLabel, type AllowanceCopy } from './challenge-text';
import { attemptIdentity, catalogCategory, meetsReadinessThreshold, setsPersonalBest, type AttemptEarned, type GroupProgress, type Progress, type Recommendation, type TableStretch } from './progress';
import type { CatalogCategory } from './service';

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const MILESTONE_SKILL: Record<CatalogCategory, string> = {
  'card-values': 'card-values',
  'running-count': 'running-count',
  conversion: 'true-count conversion',
  table: 'table-counting',
};

const ACCURACY_SKILL: Record<CatalogCategory, string> = {
  'card-values': 'card-value',
  'running-count': 'running-count',
  conversion: 'true-count',
  table: 'table-counting',
};

// Spec 3 S3-01 PDCaD
export const RECOMMENDED_BADGE = 'RECOMMENDED NEXT';

const STRETCH: Record<TableStretch, string> = {
  play: 'Play',
  deviations: 'deviation mode',
  'more-players': 'more players',
  'deeper-penetration': 'deeper penetration',
  'larger-n': 'a larger N',
};

const orList = (items: readonly string[]) => (items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`);

export function recommendationText({ category, reason, enter }: Recommendation): string {
  const title = CATEGORY_TEXT[category].title;
  switch (reason.kind) {
    case 'start':
      return `${title} is first on the suggested path.`;
    case 'next':
      return [
        `You earned the ${MILESTONE_SKILL[reason.after]} readiness milestone. ${title} is next on the suggested path.`,
        enter === 'observe' ? 'Start with Observe.' : null,
      ]
        .filter(Boolean)
        .join(' ');
    case 'beyond':
      return `You earned the ${MILESTONE_SKILL[category]} readiness milestone. To stretch it, try ${orList(reason.suggestions.map((stretch) => STRETCH[stretch]))}.`;
  }
}

export const recommendedLabel = (recommendation: Recommendation) => `Recommended next. ${recommendationText(recommendation)}`;

// Spec 3 S3-01 PDCaD (each category's status line)
export interface CategoryStatus {
  readonly earned: boolean;
  readonly text: string;
}

const categoryOf = (group: GroupProgress) => catalogCategory(group.key);

export function categoryStatus(category: CatalogCategory, progress: Progress | undefined): CategoryStatus {
  const groups = progress?.groups.filter((group) => categoryOf(group) === category) ?? [];
  const earned = groups.find((group) => group.milestone !== null);
  if (earned) return { earned: true, text: `Readiness milestone earned · ${variantLabel('check')}, ${pacingLabel(earned.key.pacing)}` };
  const check = groups.find((group) => group.key.assistanceClass === 'unassisted-check' && group.completed);
  if (check) return { earned: false, text: `Check best ${bestScore(check)}` };
  const learn = groups.find((group) => group.key.variant === 'learn' && group.completed);
  const triedCheck = groups.some((group) => group.key.variant === 'check');
  if (learn) return { earned: false, text: [`Learn best ${bestScore(learn)}`, triedCheck ? null : 'not tried in Check yet'].filter(Boolean).join(' · ') };
  return { earned: false, text: groups.length > 0 ? 'No completed attempt yet' : 'Not tried yet' };
}

const bestScore = (group: GroupProgress) => scoreText(group.bests[0]?.result ?? null);

// Spec 3 S3-08 CEb6T, nXGFk
export const BELOW_THRESHOLD = 'Below 95% this time. That restarts the streak for these settings.';

export const belowThreshold = (record: ChallengeAttemptRecord) =>
  record.endingReason === 'completed' && record.groupKey.assistanceClass === 'unassisted-check' && !meetsReadinessThreshold(record);

export const MILESTONE_EARNED = 'Readiness milestone earned';

export const milestoneDetail = (key: Pick<ChallengeGroupKey, 'category' | 'table'>) =>
  `Two unassisted Check attempts in a row at 95% or better, at these settings, on this device. It describes your ${ACCURACY_SKILL[catalogCategory(key)]} accuracy at these settings only.`;

// Spec 3 S3-08 CEb6T
export function milestonePill(earned: AttemptEarned): string | null {
  if (!setsPersonalBest(earned)) return null;
  return ['New personal best', earned.fastest === null ? null : `fastest ${timerText(earned.fastest)}`].filter(Boolean).join(' · ');
}

export const MILESTONE_KEPT = 'Your milestone stays earned';

const LESSON_NAME: Record<CatalogCategory, string> = {
  'card-values': 'card values',
  'running-count': 'running count',
  conversion: 'true-count conversion',
  table: 'table counting',
};

export const keptDetail = (key: Pick<ChallengeGroupKey, 'category' | 'table'>, earnedAt: number) =>
  `You earned the ${ACCURACY_SKILL[catalogCategory(key)]} readiness milestone at these settings on ${dayText(earnedAt)}. A slip never takes it away. To brush up: a Learn ${GAME_WORDS.blackjack.turn}, or the ${LESSON_NAME[catalogCategory(key)]} lesson.`;

export const openLessonLabel = (key: Pick<ChallengeGroupKey, 'category' | 'table'>) => `Open the ${LESSON_NAME[catalogCategory(key)]} lesson`;
export const PRACTICE_IN_LEARN = 'Practice in Learn';

export const nextOnPath = (next: CatalogCategory) => `Next on the suggested path: ${lowerFirst(CATEGORY_TEXT[next].title)}.`;

// Spec 3 S3-08 nXGFk
export const practiceNote = (allowance: AllowanceCopy | undefined) => allowance?.practice ?? '';

// Spec 3 S3-10 OVKkc
export const milestoneLine = (group: GroupProgress) => (group.milestone ? `Readiness milestone · earned ${dayText(group.milestone.earnedAt)}` : null);

export const MILESTONE_HISTORY = 'milestone earned (2 in a row)';

export const earningAttempts = (progress: Progress) =>
  new Set(progress.groups.flatMap((group) => (group.milestone ? [attemptIdentity({ installation: group.milestone.record.installation, attemptId: group.milestone.record.attempts[1] })] : [])));
