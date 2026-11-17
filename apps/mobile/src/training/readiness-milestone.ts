// Spec 3 Synchronized record types › Readiness milestone; Comparison groups (Milestones); #141

import { canonicalJson, type ChallengeGroupKey } from '@tableside/engine';

// Spec 2 registry; #148
export const READINESS_MILESTONE_RECORD_TYPE = 'readiness-milestone';

export const READINESS_MILESTONE_RECORD_VERSION = 1 as const;

export interface ReadinessMilestoneRecord {
  readonly recordVersion: typeof READINESS_MILESTONE_RECORD_VERSION;
  readonly owner: string;
  readonly installation: string;
  readonly groupKey: ChallengeGroupKey;
  readonly attempts: readonly [first: string, second: string];
  readonly earnedAt: number;
}

// Spec 3 Comparison groups (Readiness streak); Amendment 1 B3
export const milestoneSlot = (milestone: Pick<ReadinessMilestoneRecord, 'installation' | 'groupKey'>): string => `${milestone.installation}/${canonicalJson(milestone.groupKey)}`;
