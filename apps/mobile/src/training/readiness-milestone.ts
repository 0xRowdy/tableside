// Spec 3 Synchronized record types › Readiness milestone; Comparison groups (Milestones); #141, #148
import { canonicalJson } from '@tableside/engine';
import { READINESS_MILESTONE_RECORD_VERSION, readinessMilestone, type ReadinessMilestoneRecord } from '@tableside/account';

// Spec 2 registry
export const READINESS_MILESTONE_RECORD_TYPE = readinessMilestone.name;

export { READINESS_MILESTONE_RECORD_VERSION, type ReadinessMilestoneRecord };

// #148
export const milestoneIdentity = (milestone: ReadinessMilestoneRecord): string => readinessMilestone.identity.of(milestone);

// #148
export interface MilestoneSync {
  readonly accepted: readonly ReadinessMilestoneRecord[];
  readonly refused: readonly string[];
}

// Spec 3 Comparison groups (Readiness streak); Amendment 1 B3
export const milestoneSlot = (milestone: Pick<ReadinessMilestoneRecord, 'installation' | 'groupKey'>): string => `${milestone.installation}/${canonicalJson(milestone.groupKey)}`;
