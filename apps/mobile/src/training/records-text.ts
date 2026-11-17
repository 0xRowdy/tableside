// Spec 3 S3-10 OVKkc (Amendment 2 §3), S3-01 PDCaD, S3-08 liAfT, CEb6T; Comparison groups; #140

import { CHALLENGE_CONTENT } from '@tableside/definitions';
import type { AssistanceClass, AttemptEndingReason, ChallengeAttemptRecord, ChallengeCategory, ChallengeGroupKey, ChallengeMetric, ChallengePacing } from '@tableside/engine';

import { dayText } from '@/account/account-text';

import { spokenScore, scoreText, timerText, variantLabel } from './challenge-text';
import type { AttemptEarned, GroupProgress, ProgressAttempt } from './progress';
import type { CatalogCategory } from './service';

export const RECORDS_TITLE = 'Records & history';
export const RECORDS_ROW = { title: RECORDS_TITLE, detail: 'Personal bests, fastest times, milestones and every attempt' } as const;

export const RECORD_CLASSES: readonly AssistanceClass[] = ['unassisted-check', 'assisted-check', 'learn'];
export const CLASS_LABEL: Record<AssistanceClass, string> = { 'unassisted-check': 'Check', 'assisted-check': 'Assisted Check', learn: 'Learn' };
const CLASS_NAME: Record<AssistanceClass, string> = { 'unassisted-check': 'unassisted Check', 'assisted-check': 'assisted Check', learn: 'Learn' };

export const bestsLabel = (assistance: AssistanceClass) => `PERSONAL BESTS · ${CLASS_NAME[assistance].toUpperCase()}, BY SETTINGS`;
export const noGroups = (assistance: AssistanceClass) => `No ${CLASS_NAME[assistance]} attempts yet.`;
export const HISTORY_LABEL = 'ATTEMPT HISTORY';
export const NO_HISTORY = 'No attempts yet.';
export const RECORDS_NOTE = 'Records only compare attempts with identical settings. Speed counts only for perfect, unassisted, uninterrupted, timed Check attempts.';

const RECORD_TITLE: Record<CatalogCategory, string> = { 'card-values': 'Card values', 'running-count': 'Running count', conversion: 'Conversion', table: 'Table counting' };
const ITEMS: Record<ChallengeCategory, string> = { 'card-values': 'cards', 'running-count': 'cards', conversion: 'questions' };
const PACING: Record<ChallengePacing, string> = { 'self-paced': 'self-paced', '3s': '3 s pace', '2s': '2 s pace', '1s': '1 s pace' };
const METRIC_TITLE: Record<ChallengeMetric, string> = {
  'card-values': 'card values',
  'running-count': 'running count',
  'true-count': 'true count',
  'playing-adherence': 'playing adherence',
  'betting-adherence': 'betting adherence',
};

// Spec 3 Comparison groups › Reference changes
function versionText(key: Pick<ChallengeGroupKey, 'category' | 'content' | 'reference'>): string | null {
  const current = CHALLENGE_CONTENT[key.category];
  const reference = 'reference' in current ? current.reference : null;
  const parts = [
    key.content.version !== current.version ? `content version ${key.content.version}` : null,
    key.reference && reference && key.reference.version !== reference.version ? `reference version ${key.reference.version}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// TODO(#137)
export const settingsText = (key: ChallengeGroupKey) =>
  [`${key.length} ${ITEMS[key.category]}`, PACING[key.pacing], key.variant === 'learn' && key.countRevealed ? 'count shown' : null, versionText(key)].filter(Boolean).join(' · ');

export const groupTitle = (key: ChallengeGroupKey) => RECORD_TITLE[key.category];

export interface StatText {
  readonly label: string;
  readonly value: string;
  readonly spoken: string;
}

// Spec 3 S3-10 OVKkc
export function bestText(group: GroupProgress): readonly StatText[] {
  if (!group.completed) return [{ label: 'Best', value: '— (no completed attempt yet)', spoken: '— (no completed attempt yet)' }];
  return group.bests.map((best) => ({
    label: group.bests.length === 1 ? 'Best' : `Best ${METRIC_TITLE[best.metric]}`,
    value: scoreText(best.result),
    spoken: spokenScore(best.result),
  }));
}

export function fastestText(group: GroupProgress): StatText {
  const value = group.fastest ? timerText(group.fastest.performanceMs) : group.completed ? '— (needs a perfect run)' : '—';
  return { label: 'Fastest', value, spoken: value };
}

export const groupLabel = (group: GroupProgress, stats: readonly StatText[]) =>
  [`${groupTitle(group.key)}, ${settingsText(group.key)}`, ...stats.map((stat) => `${stat.label} ${stat.spoken}`)].join('. ');

const ENDING: Record<AttemptEndingReason, string> = {
  completed: 'completed',
  abandoned: 'abandoned',
  'insufficient-funds': 'ended early — insufficient funds',
  unusable: "ended · couldn't continue",
};

export const LOCAL_LABEL = 'Local, not synced yet';

export function whenText(at: number, now: number): string {
  const day = new Date(at).toDateString();
  if (day === new Date(now).toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return day === yesterday.toDateString() ? 'Yesterday' : dayText(at);
}

// Spec 3 S3-10 OVKkc (attempt history)
export function historyText({ record, local }: ProgressAttempt, now: number): { readonly title: string; readonly detail: string; readonly value: string } {
  const { groupKey: key } = record;
  const completed = record.endingReason === 'completed';
  const detail = [
    whenText(record.endedAt, now),
    key.pacing === 'self-paced' ? null : PACING[key.pacing],
    completed && key.variant === 'check' ? (key.assistanceClass === 'assisted-check' ? 'assisted' : 'unassisted') : null,
    ENDING[record.endingReason],
    versionText(key),
    local ? LOCAL_LABEL : null,
  ].filter(Boolean);
  return { title: `${RECORD_TITLE[key.category]} · ${variantLabel(key.variant)}`, detail: detail.join(' · '), value: historyValue(record) };
}

function historyValue(record: ChallengeAttemptRecord): string {
  if (record.endingReason === 'insufficient-funds') return 'Partial';
  if (record.endingReason !== 'completed') return '—';
  const tested = Object.values(record.metrics).filter((result) => result !== null);
  return tested.length === 1 ? scoreText(tested[0]!) : 'Completed';
}

// Spec 3 S3-08 liAfT, CEb6T
export function personalBestText(key: Pick<ChallengeGroupKey, 'assistanceClass'>, earned: AttemptEarned): { readonly title: string; readonly detail: string; readonly fastest: string | null } {
  const title = key.assistanceClass === 'learn' ? 'New Learn personal best' : key.assistanceClass === 'assisted-check' ? 'New assisted Check personal best' : 'New personal best';
  return {
    title,
    detail: `Compared only with ${CLASS_NAME[key.assistanceClass]} attempts at these settings.`,
    fastest: earned.fastest === null ? null : `Fastest ${timerText(earned.fastest)}`,
  };
}
