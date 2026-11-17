// Spec 3 Amendment 4 §2–3; #150

// TODO(spec 5)
export type ChallengeAllowance =
  | { readonly kind: 'premium' }
  | {
      readonly kind: 'free';
      readonly amount: number;
      readonly left: number;
      readonly resetsAt: number;
      readonly timeZone: string;
      readonly allowanceDevice: { readonly here: true } | { readonly here: false; readonly name: string };
    };

export interface ChallengeAllowanceState {
  challengeAllowance(): Promise<ChallengeAllowance>;
}

export const canStartChallenge = (allowance: ChallengeAllowance) => allowance.kind === 'premium' || (allowance.allowanceDevice.here && allowance.left > 0);

// Spec 5 Summary (launch policy)
const STUB_POLICY = { challengeAttempts: 5 } as const;

// TODO(spec 5)
export function plentyAllowance(now: () => number): ChallengeAllowanceState {
  return {
    challengeAllowance: async () => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const today = new Date(now());
      const resetsAt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
      const amount = STUB_POLICY.challengeAttempts;
      return { kind: 'free', amount, left: amount, resetsAt, timeZone, allowanceDevice: { here: true } };
    },
  };
}
