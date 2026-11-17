// Spec 3 Modules › Training service (Progress projection); Comparison groups; Amendment 1 C2; #140

import { canonicalJson, CHALLENGE_METRICS, type ChallengeAttemptSummary, type ChallengeGroupKey, type ChallengeMetric, type MetricResult } from '@tableside/engine';

import type { AcceptedAttempt } from './store';

// Spec 3 Comparison groups (local and accepted attempts)
export interface ProgressAttempt {
  // Spec 3 Amendment 1 C8; #142
  readonly record: AcceptedAttempt;
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
}

export interface Fastest {
  readonly performanceMs: number;
  readonly attempt: AcceptedAttempt;
}

export interface Progress {
  readonly groups: readonly GroupProgress[];
  readonly history: readonly ProgressAttempt[];
}

// Spec 3 Comparison groups › Milestones; Audio and haptics (cue 16)
export interface AttemptEarned {
  readonly bests: readonly ChallengeMetric[];
  readonly fastest: number | null;
}

export const NOTHING_EARNED: AttemptEarned = { bests: [], fastest: null };

export const setsPersonalBest = (earned: AttemptEarned) => earned.bests.length > 0 || earned.fastest !== null;

export const comparisonGroup = (key: ChallengeGroupKey): string => canonicalJson(key);

// Spec 3 Amendment 1 C2
export function baseConfiguration(key: ChallengeGroupKey): string {
  const { assistanceClass: _assistance, countRevealed: _revealed, ...base } = key;
  return canonicalJson(base);
}

export function progressProjection(attempts: readonly ProgressAttempt[]): Progress {
  const history = distinct(attempts).sort((a, b) => b.record.endedAt - a.record.endedAt || (lowerIdentity(a.record, b.record) ? -1 : 1));
  const groups = new Map<string, ProgressAttempt[]>();
  for (const entry of history) {
    const id = comparisonGroup(entry.record.groupKey);
    groups.set(id, [...(groups.get(id) ?? []), entry]);
  }
  return { groups: [...groups].map(([id, members]) => groupProgress(id, members)), history };
}

export function attemptEarned(attempts: readonly ProgressAttempt[], attemptId: string): AttemptEarned {
  const all = distinct(attempts).map((entry) => entry.record);
  const record = all.find((candidate) => candidate.attemptId === attemptId);
  if (record?.endingReason !== 'completed') return NOTHING_EARNED;
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

function groupProgress(id: string, attempts: readonly ProgressAttempt[]): GroupProgress {
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
