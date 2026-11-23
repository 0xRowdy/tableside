// Spec 3 S3-01 PDCaD, S3-08 CEb6T, nXGFk, S3-10 OVKkc; Comparison groups; #141

import type { ChallengeCategory, ChallengeGroupKey } from '@tableside/engine';

import { dayText } from '@/account/account-text';
import { GAME_WORDS } from '@/play/game-words';

import { CATEGORY_TEXT, pacingLabel, scoreText, timerText, variantLabel, type AllowanceCopy } from './challenge-text';
import { attemptIdentity, setsPersonalBest, type AttemptEarned, type GroupProgress, type Progress, type Recommendation, type TableStretch } from './progress';

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

// Spec 3 S3-01 PDCaD, S3-08 CEb6T, nXGFk
const READINESS_WORDS: Record<ChallengeCategory, { readonly milestone: string; readonly accuracy: string; readonly lesson: string }> = {
  'card-values': { milestone: 'card-values', accuracy: 'card-value', lesson: 'card values' },
  'running-count': { milestone: 'running-count', accuracy: 'running-count', lesson: 'running count' },
  conversion: { milestone: 'true-count conversion', accuracy: 'true-count', lesson: 'true-count conversion' },
  table: { milestone: 'table-counting', accuracy: 'table-counting', lesson: 'table counting' },
};

// Spec 3 S3-01 PDCaD
export const RECOMMENDED_BADGE = 'Recommended next';

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
        `You earned the ${READINESS_WORDS[reason.after].milestone} readiness milestone. ${title} is next on the suggested path.`,
        enter === 'observe' ? 'Start with Observe.' : null,
      ]
        .filter(Boolean)
        .join(' ');
    case 'beyond':
      return `You earned the ${READINESS_WORDS[category].milestone} readiness milestone. To stretch it, try ${orList(reason.suggestions.map((stretch) => STRETCH[stretch]))}.`;
  }
}

export const recommendedLabel = (recommendation: Recommendation) => `Recommended next. ${recommendationText(recommendation)}`;

// Spec 3 S3-01 PDCaD (each category's status line)
export interface CategoryStatus {
  readonly earned: boolean;
  readonly text: string;
}

export function categoryStatus(category: ChallengeCategory, progress: Progress | undefined): CategoryStatus {
  const groups = progress?.groups.filter((group) => group.key.category === category) ?? [];
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
// Spec 3 S3-08 cfKTT
export const BELOW_THRESHOLD = 'Below 95% this time, so your run of Checks at 95% or better starts over.';

export const MILESTONE_EARNED = 'Readiness milestone earned';

export const milestoneDetail = (key: Pick<ChallengeGroupKey, 'category'>) =>
  `Two unassisted Check attempts in a row at 95% or better, at these settings, on this device. It describes your ${READINESS_WORDS[key.category].accuracy} accuracy at these settings only.`;

// Spec 3 S3-08 CEb6T
export function milestonePill(earned: AttemptEarned): string | null {
  if (!setsPersonalBest(earned)) return null;
  return ['New personal best', earned.fastest === null ? null : `fastest ${timerText(earned.fastest)}`].filter(Boolean).join(' · ');
}

export const MILESTONE_KEPT = 'Your milestone stays earned';

export const keptDetail = (key: Pick<ChallengeGroupKey, 'category'>, earnedAt: number) =>
  `You earned the ${READINESS_WORDS[key.category].accuracy} readiness milestone at these settings on ${dayText(earnedAt)}. A slip never takes it away. To brush up: a Learn ${GAME_WORDS.blackjack.turn}, or the ${READINESS_WORDS[key.category].lesson} lesson.`;

export const openLessonLabel = (key: Pick<ChallengeGroupKey, 'category'>) => `Open the ${READINESS_WORDS[key.category].lesson} lesson`;
export const PRACTICE_IN_LEARN = 'Practice in Learn';

export const nextOnPath = (next: ChallengeCategory) => `Next on the suggested path: ${lowerFirst(CATEGORY_TEXT[next].title)}.`;

// Spec 3 S3-08 nXGFk
export const practiceNote = (allowance: AllowanceCopy | undefined) => allowance?.practice ?? '';

// Spec 3 S3-10 OVKkc
export const milestoneLine = (group: GroupProgress) => (group.milestone ? `Readiness milestone · earned ${dayText(group.milestone.earnedAt)}` : null);

export const MILESTONE_HISTORY = 'milestone earned (2 in a row)';

export const earningAttempts = (progress: Progress) =>
  new Set(progress.groups.flatMap((group) => (group.milestone ? [attemptIdentity({ installation: group.milestone.record.installation, attemptId: group.milestone.record.attempts[1] })] : [])));
