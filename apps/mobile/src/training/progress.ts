// Spec 3 Modules › Training service (Progress projection); Comparison groups; Amendment 1 C2; #140

import { canonicalJson, CHALLENGE_CATEGORIES, CHALLENGE_METRICS, type ChallengeAttemptSummary, type ChallengeCategory, type ChallengeGroupKey, type ChallengeMetric, type MetricResult } from '@tableside/engine';

import type { AcceptedAttempt } from './store';
import { meetsReadinessThreshold, milestoneIdentity, milestoneSlot, READINESS_MILESTONE_RECORD_VERSION, readinessStreakEffect, type ReadinessMilestoneRecord } from './readiness-milestone';

// Spec 3 Comparison groups (local and accepted attempts)
export interface ProgressAttempt {
  // Spec 3 Amendment 1 C8; #142
  readonly record: AcceptedAttempt;
  readonly local: boolean;
}

// Spec 3 Synchronized record types › Readiness milestone (local and accepted)
export interface ProgressMilestone {
  readonly record: ReadinessMilestoneRecord;
  readonly local: boolean;
}

export interface PersonalBest {
  readonly metric: ChallengeMetric;
  readonly result: MetricResult;
  readonly attempt: AcceptedAttempt;
}

export interface GroupProgress {
  readonly id: string;
  readonly key: ChallengeGroupKey;
  readonly attempts: readonly ProgressAttempt[];
  readonly completed: boolean;
  readonly bests: readonly PersonalBest[];
  readonly fastest: Fastest | null;
  // Spec 3 Comparison groups (Milestones)
  readonly milestone: EarnedMilestone | null;
}

export interface EarnedMilestone {
  readonly earnedAt: number;
  readonly local: boolean;
  readonly record: ReadinessMilestoneRecord;
}

export interface Fastest {
  readonly performanceMs: number;
  readonly attempt: AcceptedAttempt;
}

export interface Progress {
  readonly groups: readonly GroupProgress[];
  readonly history: readonly ProgressAttempt[];
  readonly recommendation: Recommendation;
}

// Spec 3 Comparison groups (Recommendations)
export type TableStretch = 'play' | 'deviations' | 'more-players' | 'deeper-penetration' | 'larger-n';

export type RecommendationReason =
  | { readonly kind: 'start' }
  | { readonly kind: 'next'; readonly after: ChallengeCategory }
  | { readonly kind: 'beyond'; readonly suggestions: readonly TableStretch[] };

export interface Recommendation {
  readonly category: ChallengeCategory;
  readonly reason: RecommendationReason;
  readonly enter: 'observe' | null;
}

// Spec 3 Comparison groups (Milestones)
export type ReadinessOutcome = { readonly kind: 'earned'; readonly next: ChallengeCategory | null } | { readonly kind: 'kept'; readonly earnedAt: number };

// Spec 3 Comparison groups › Milestones; Audio and haptics (cue 16)
export interface PersonalBestEarned {
  readonly bests: readonly ChallengeMetric[];
  readonly fastest: number | null;
}

export interface AttemptEarned extends PersonalBestEarned {
  readonly readiness: ReadinessOutcome | null;
}

const NO_PERSONAL_BEST: PersonalBestEarned = { bests: [], fastest: null };

export const NOTHING_EARNED: AttemptEarned = { ...NO_PERSONAL_BEST, readiness: null };

export const setsPersonalBest = (earned: PersonalBestEarned) => earned.bests.length > 0 || earned.fastest !== null;

// Spec 3 Comparison groups (Milestones); Audio and haptics (cue 16)
export const earnsRecord = (earned: AttemptEarned) => setsPersonalBest(earned) || earned.readiness?.kind === 'earned';

export const comparisonGroup = (key: ChallengeGroupKey): string => canonicalJson(key);

// Spec 3 Amendment 1 C2
export function baseConfiguration(key: ChallengeGroupKey): string {
  const { assistanceClass: _assistance, countRevealed: _revealed, ...base } = key;
  return canonicalJson(base);
}

export function progressProjection(attempts: readonly ProgressAttempt[], milestones: readonly ProgressMilestone[] = []): Progress {
  const earned = earliestMilestones(milestones);
  const history = distinct(attempts).sort((a, b) => b.record.endedAt - a.record.endedAt || (lowerIdentity(a.record, b.record) ? -1 : 1));
  const groups = new Map<string, ProgressAttempt[]>();
  for (const entry of history) {
    const id = comparisonGroup(entry.record.groupKey);
    groups.set(id, [...(groups.get(id) ?? []), entry]);
  }
  return {
    groups: [...groups].map(([id, members]) => groupProgress(id, members, earned.get(id) ?? null)),
    history,
    recommendation: recommendation(milestones.map((milestone) => milestone.record)),
  };
}

// Spec 3 Comparison groups (Milestones)
export function readinessOutcome(attempts: readonly ProgressAttempt[], milestones: readonly ProgressMilestone[], attemptId: string): ReadinessOutcome | null {
  const record = distinct(attempts).find((entry) => entry.record.attemptId === attemptId)?.record;
  if (!record) return null;
  const records = milestones.map((milestone) => milestone.record);
  if (records.some((milestone) => milestone.installation === record.installation && milestone.attempts[1] === record.attemptId)) {
    const next = recommendation(records).category;
    return { kind: 'earned', next: next === record.groupKey.category ? null : next };
  }
  const kept = earliestMilestones(milestones).get(comparisonGroup(record.groupKey));
  return kept && belowReadinessThreshold(record) ? { kind: 'kept', earnedAt: kept.earnedAt } : null;
}

// Spec 3 Comparison groups (Recommendations)
export function recommendation(milestones: readonly ReadinessMilestoneRecord[]): Recommendation {
  const earned = new Set(milestones.map((milestone) => milestone.groupKey.category));
  const furthest = Math.max(...CHALLENGE_CATEGORIES.map((category, index) => (earned.has(category) ? index : -1)));
  if (furthest < 0) return { category: CHALLENGE_CATEGORIES[0]!, reason: { kind: 'start' }, enter: null };
  const after = CHALLENGE_CATEGORIES[furthest]!;
  const next = CHALLENGE_CATEGORIES[furthest + 1];
  if (next) return { category: next, reason: { kind: 'next', after }, enter: next === 'table' ? 'observe' : null };
  const tables = milestones.flatMap((milestone) => milestone.groupKey.table ?? []);
  const suggestions: TableStretch[] = [
    ...(tables.some((table) => table.seat === 'play') ? [] : (['play'] as const)),
    ...(tables.some((table) => table.countingMode === 'deviations') ? [] : (['deviations'] as const)),
    'more-players',
    'deeper-penetration',
    'larger-n',
  ];
  return { category: after, reason: { kind: 'beyond', suggestions }, enter: null };
}

function earliestMilestones(milestones: readonly ProgressMilestone[]): Map<string, EarnedMilestone> {
  const byIdentity = new Map<string, ProgressMilestone>();
  for (const entry of milestones) {
    const identity = `${milestoneSlot(entry.record)}/${entry.record.attempts.join('/')}`;
    const known = byIdentity.get(identity);
    if (!known || (known.local && !entry.local)) byIdentity.set(identity, entry);
  }
  const earliest = new Map<string, EarnedMilestone>();
  for (const { record, local } of byIdentity.values()) {
    const group = comparisonGroup(record.groupKey);
    const known = earliest.get(group);
    if (!known || record.earnedAt < known.earnedAt) earliest.set(group, { earnedAt: record.earnedAt, local, record });
  }
  return earliest;
}

export function attemptEarned(attempts: readonly ProgressAttempt[], attemptId: string): PersonalBestEarned {
  const all = distinct(attempts).map((entry) => entry.record);
  const record = all.find((candidate) => candidate.attemptId === attemptId);
  if (record?.endingReason !== 'completed') return NO_PERSONAL_BEST;
  const id = comparisonGroup(record.groupKey);
  const group = all.filter((candidate) => candidate.endingReason === 'completed' && comparisonGroup(candidate.groupKey) === id);
  const before = group.filter((candidate) => candidate !== record);
  const bests = CHALLENGE_METRICS.filter((metric) => {
    const best = bestOf(group, metric);
    const previous = bestOf(before, metric);
    return best?.attempt === record && (!previous || rank(best.result, previous.result) > 0);
  });
  const fastest = fastestOf(group);
  const previous = fastestOf(before);
  return { bests, fastest: fastest?.attempt === record && (!previous || fastest.performanceMs < previous.performanceMs) ? fastest.performanceMs : null };
}

// Spec 3 Comparison groups (Readiness streak); Amendment 1 B3
export function milestoneCandidates(attempts: readonly ProgressAttempt[], installation: string, refused: ReadonlySet<string> = new Set()): readonly ReadinessMilestoneRecord[] {
  const own = distinct(attempts)
    .map((entry) => entry.record)
    .filter((record) => record.installation === installation)
    .sort((a, b) => a.deviceSequence - b.deviceSequence);
  // Spec 3 Amendment 1 C2
  const streaks = new Map<string, AcceptedAttempt | null>();
  const earned = new Map<string, ReadinessMilestoneRecord>();
  for (const record of own) {
    const effect = readinessStreakEffect(record);
    if (effect === 'neutral') continue;
    const base = baseConfiguration(record.groupKey);
    if (effect === 'breaks') {
      streaks.set(base, null);
      continue;
    }
    const previous = streaks.get(base) ?? null;
    streaks.set(base, record);
    if (!previous || earned.has(base)) continue;
    const milestone: ReadinessMilestoneRecord = {
      recordVersion: READINESS_MILESTONE_RECORD_VERSION,
      owner: record.owner,
      installation,
      groupKey: record.groupKey,
      attempts: [previous.attemptId, record.attemptId],
      deviceSequences: [previous.deviceSequence, record.deviceSequence],
      earnedAt: record.endedAt,
    };
    // #148
    if (!refused.has(milestoneIdentity(milestone))) earned.set(base, milestone);
  }
  return [...earned.values()];
}

// Spec 3 Comparison groups (Readiness streak)
export const belowReadinessThreshold = (record: AcceptedAttempt) =>
  record.endingReason === 'completed' && record.groupKey.assistanceClass === 'unassisted-check' && !meetsReadinessThreshold(record);

// Spec 3 Synchronized record types › Challenge attempt
export const attemptIdentity = (record: Pick<ChallengeAttemptSummary, 'installation' | 'attemptId'>) => `${record.installation}/${record.attemptId}`;

// Spec 3 Comparison groups (local and accepted attempts); Synchronized record types
function distinct(attempts: readonly ProgressAttempt[]): ProgressAttempt[] {
  const byIdentity = new Map<string, ProgressAttempt>();
  for (const entry of attempts) {
    const identity = attemptIdentity(entry.record);
    const known = byIdentity.get(identity);
    if (!known || (known.local && !entry.local)) byIdentity.set(identity, entry);
  }
  return [...byIdentity.values()];
}

function groupProgress(id: string, attempts: readonly ProgressAttempt[], milestone: EarnedMilestone | null): GroupProgress {
  const completed = attempts.map((entry) => entry.record).filter((record) => record.endingReason === 'completed');
  return {
    id,
    key: attempts[0]!.record.groupKey,
    attempts,
    completed: completed.length > 0,
    bests: CHALLENGE_METRICS.flatMap((metric) => {
      const best = bestOf(completed, metric);
      return best ? [best] : [];
    }),
    fastest: fastestOf(completed),
    milestone,
  };
}

// Spec 3 Comparison groups › Personal bests (Fastest)
// Spec 3 Amendment 1 C8; #142
export const offersReview = (record: AcceptedAttempt): boolean =>
  record.review ? record.review.length > 0 : Object.values(record.metrics).some((result) => result !== null && result.total > 0);

export function everyMetricPerfect(record: AcceptedAttempt): boolean {
  const tested = CHALLENGE_METRICS.flatMap((metric) => record.metrics[metric] ?? []);
  return tested.length > 0 && tested.every((result) => result.correct === result.total);
}

// Spec 3 Comparison groups › Personal bests (Fastest); Attempt lifecycle › Pause
function fastestEligible(record: AcceptedAttempt): record is AcceptedAttempt & { readonly performanceMs: number } {
  return record.endingReason === 'completed' && record.groupKey.assistanceClass === 'unassisted-check' && !record.interrupted && record.performanceMs !== null && everyMetricPerfect(record);
}

function fastestOf(records: readonly AcceptedAttempt[]): Fastest | null {
  let fastest: Fastest | null = null;
  for (const attempt of records) {
    if (!fastestEligible(attempt)) continue;
    const { performanceMs } = attempt;
    if (!fastest || performanceMs < fastest.performanceMs || (performanceMs === fastest.performanceMs && lowerIdentity(attempt, fastest.attempt))) fastest = { performanceMs, attempt };
  }
  return fastest;
}

// Spec 3 Comparison groups › Personal bests
function bestOf(records: readonly AcceptedAttempt[], metric: ChallengeMetric): PersonalBest | null {
  let best: PersonalBest | null = null;
  for (const attempt of records) {
    const result = attempt.metrics[metric];
    if (result && result.total > 0 && (!best || beats({ metric, result, attempt }, best))) best = { metric, result, attempt };
  }
  return best;
}

const beats = (a: PersonalBest, b: PersonalBest) => {
  const ranked = rank(a.result, b.result);
  return ranked !== 0 ? ranked > 0 : lowerIdentity(a.attempt, b.attempt);
};

const rank = (a: MetricResult, b: MetricResult) => Math.sign(a.correct * b.total - b.correct * a.total) || Math.sign(a.total - b.total);

// Spec 3 Synchronized record types › Challenge attempt (identity)
const lowerIdentity = (a: AcceptedAttempt, b: AcceptedAttempt) =>
  a.attemptId !== b.attemptId ? a.attemptId < b.attemptId : a.installation !== b.installation ? a.installation < b.installation : a.deviceSequence < b.deviceSequence;
