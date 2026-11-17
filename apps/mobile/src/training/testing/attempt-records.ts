// Spec 3 Testing Decisions › Seam 2 (Projection); #140
import { CHALLENGE_RECORD_VERSION, type ChallengeAttemptRecord, type ChallengeGroupKey, type ChallengeMetric, type MetricResult } from '@tableside/engine';

import type { ProgressAttempt } from '../progress';

export const RUNNING_COUNT_CHECK: ChallengeGroupKey = {
  category: 'running-count',
  variant: 'check',
  assistanceClass: 'unassisted-check',
  countRevealed: false,
  content: { id: 'running-count', version: 1 },
  reference: { id: 'blackjack-coaching-reference@0123456789abcdef', version: 1 },
  length: 52,
  pacing: 'self-paced',
  table: null,
};

// TODO(#137): category 'table' once the engine has it
export const TABLE_PLAY_CHECK: ChallengeGroupKey = {
  category: 'running-count',
  variant: 'check',
  assistanceClass: 'unassisted-check',
  countRevealed: false,
  content: { id: 'table', version: 1 },
  reference: { id: 'blackjack-coaching-reference@0123456789abcdef', version: 1 },
  length: 10,
  pacing: 'self-paced',
  table: {
    rules: { id: 'blackjack-s17-ls', version: 1 },
    penetration: 75,
    extraPlayers: 0,
    seat: 'play',
    countingMode: 'basic',
    betSchedule: false,
    baseWager: '10',
    startingBalance: '1000',
    checkpointInterval: 1,
  },
};

type Scores = Partial<Record<ChallengeMetric, readonly [correct: number, total: number] | null>>;

export interface AttemptFixture {
  readonly id: string;
  readonly key?: ChallengeGroupKey;
  readonly scores?: Scores;
  readonly ending?: ChallengeAttemptRecord['endingReason'];
  readonly interrupted?: boolean;
  readonly performanceMs?: number | null;
  readonly endedAt?: number;
  readonly installation?: string;
  readonly deviceSequence?: number;
  readonly local?: boolean;
}

const NO_METRICS: Record<ChallengeMetric, MetricResult | null> = { 'card-values': null, 'running-count': null, 'true-count': null, 'playing-adherence': null, 'betting-adherence': null };

export function attemptRecord(fixture: AttemptFixture): ChallengeAttemptRecord {
  const key = fixture.key ?? RUNNING_COUNT_CHECK;
  const metrics = { ...NO_METRICS };
  for (const [metric, score] of Object.entries(fixture.scores ?? { 'running-count': [4, 4] }) as [ChallengeMetric, readonly [number, number] | null][]) {
    metrics[metric] = score && { correct: score[0], total: score[1] };
  }
  return {
    recordVersion: CHALLENGE_RECORD_VERSION,
    attemptId: fixture.id,
    owner: 'local',
    installation: fixture.installation ?? 'device-a',
    deviceSequence: fixture.deviceSequence ?? 1,
    groupKey: key,
    identities: { engine: 'engine@test', content: key.content, reference: key.reference, random: { protocol: 1, key: [0, 0], session: [0, 0] } as ChallengeAttemptRecord['identities']['random'] },
    endingReason: fixture.ending ?? 'completed',
    metrics,
    review: [],
    assistanceStep: key.countRevealed ? 1 : null,
    interrupted: fixture.interrupted ?? false,
    performanceMs: fixture.performanceMs === undefined ? 200_000 : fixture.performanceMs,
    finances: null,
    allowancePolicyVersion: null,
    meteringBasis: 'challenge-attempt',
    startedAt: (fixture.endedAt ?? 1_790_000_000_000) - 300_000,
    endedAt: fixture.endedAt ?? 1_790_000_000_000,
  };
}

export const attempt = (fixture: AttemptFixture): ProgressAttempt => ({ record: attemptRecord(fixture), local: fixture.local ?? true });
