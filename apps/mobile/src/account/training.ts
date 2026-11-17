// Spec 3 Amendment 1 C8; #142
import { challengeAttempt, type AccountRecords } from '@tableside/account';
import type { ChallengeAttemptRecord } from '@tableside/engine';

export function attemptDetailFrom(records: Pick<AccountRecords, 'detail'>): (attemptId: string) => Promise<ChallengeAttemptRecord | null> {
  return async (attemptId) => {
    const result = await records.detail(challengeAttempt.name, attemptId);
    return result.status === 'detail' && challengeAttempt.isPayload(result.record.payload) ? result.record.payload : null;
  };
}
