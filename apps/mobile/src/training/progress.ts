// Spec 3 Modules › Training service (Progress projection); Comparison groups, records and progression; Amendment 1 C2, C3; #140

import { canonicalJson, CHALLENGE_METRICS, type ChallengeAttemptRecord, type ChallengeGroupKey, type ChallengeMetric, type MetricResult } from '@tableside/engine';

// Spec 3 Comparison groups (local and accepted attempts)
export interface ProgressAttempt {
  readonly record: ChallengeAttemptRecord;
  readonly local: boolean;
}

export interface PersonalBest {
  readonly metric: ChallengeMetric;
  readonly result: MetricResult;
  readonly attempt: ChallengeAttemptRecord;
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
  readonly attempt: ChallengeAttemptRecord;
}

export interface Progress {
  // most recent activity first
  readonly groups: readonly GroupProgress[];
  // newest first
  readonly history: readonly ProgressAttempt[];
}

// Spec 3 Comparison groups › Milestones (cue 16 on the results that set a personal best)
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

// Spec 3 Comparison groups (local and accepted attempts); Synchronized record types › Challenge attempt (identity)
function distinct(attempts: readonly ProgressAttempt[]): ProgressAttempt[] {
  const byIdentity = new Map<string, ProgressAttempt>();
  for (const entry of attempts) {
    const identity = `${entry.record.installation}/${entry.record.attemptId}`;
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

// Spec 3 Comparison groups › Personal bests (Fastest); Attempt lifecycle › Pause
export function fastestEligible(record: ChallengeAttemptRecord): record is ChallengeAttemptRecord & { readonly performanceMs: number } {
  const tested = CHALLENGE_METRICS.flatMap((metric) => record.metrics[metric] ?? []);
  return (
    record.endingReason === 'completed' &&
    record.groupKey.assistanceClass === 'unassisted-check' &&
    !record.interrupted &&
    record.performanceMs !== null &&
    tested.length > 0 &&
    tested.every((result) => result.correct === result.total)
  );
}

function fastestOf(records: readonly ChallengeAttemptRecord[]): Fastest | null {
  let fastest: Fastest | null = null;
  for (const attempt of records) {
    if (!fastestEligible(attempt)) continue;
    const { performanceMs } = attempt;
    if (!fastest || performanceMs < fastest.performanceMs || (performanceMs === fastest.performanceMs && lowerIdentity(attempt, fastest.attempt))) fastest = { performanceMs, attempt };
  }
  return fastest;
}

// Spec 3 Comparison groups › Personal bests
function bestOf(records: readonly ChallengeAttemptRecord[], metric: ChallengeMetric): PersonalBest | null {
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

// Ratio, then the larger denominator
const rank = (a: MetricResult, b: MetricResult) => Math.sign(a.correct * b.total - b.correct * a.total) || Math.sign(a.total - b.total);

// Spec 3 Synchronized record types › Challenge attempt (identity)
const lowerIdentity = (a: ChallengeAttemptRecord, b: ChallengeAttemptRecord) =>
  a.attemptId !== b.attemptId ? a.attemptId < b.attemptId : a.installation !== b.installation ? a.installation < b.installation : a.deviceSequence < b.deviceSequence;
