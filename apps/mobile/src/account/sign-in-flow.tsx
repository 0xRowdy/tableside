import type { CodeIntent } from '@tableside/account';
import { router } from 'expo-router';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { useAccount } from './AccountProvider';
import { codeRequestProblem } from './code-request-text';

interface SignInFlow {
  readonly intent: CodeIntent;
  /** The address the code goes to. Held in memory only, never in a route or log. */
  readonly email: string;
  /** Sign in: straight to the email step, never the age step. */
  startSignIn(): void;
  /** Create: the age step first. */
  startCreate(): void;
  setEmail(email: string): void;
}

const SignInFlowContext = createContext<SignInFlow | null>(null);

/** The first run's choices so far, shared by its screens. */
export function SignInFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ intent: CodeIntent; email: string }>({ intent: 'sign-in', email: '' });
  const value: SignInFlow = {
    ...state,
    startSignIn: () => {
      setState((current) => ({ ...current, intent: 'sign-in' }));
      router.push('/email');
    },
    startCreate: () => {
      setState((current) => ({ ...current, intent: 'create' }));
      router.push('/age');
    },
    setEmail: (email) => setState((current) => ({ ...current, email })),
  };
  return <SignInFlowContext.Provider value={value}>{children}</SignInFlowContext.Provider>;
}

export function useSignInFlow(): SignInFlow {
  const flow = useContext(SignInFlowContext);
  if (!flow) throw new Error('useSignInFlow needs a SignInFlowProvider');
  return flow;
}

/**
 * Asks for a code for the flow's address and intent. True when it was sent.
 * When the age answer has expired it goes back to the age step; otherwise it
 * hands `onProblem` what to tell the player.
 */
export function useCodeRequest(onProblem: (problem: string) => void): (email: string) => Promise<boolean> {
  const { service } = useAccount();
  const flow = useSignInFlow();
  return async (email) => {
    const result = await service.requestEmailCode({ email, intent: flow.intent });
    if (result.status === 'sent') return true;
    if (result.status === 'age-required') router.replace('/age');
    else onProblem(codeRequestProblem(result));
    return false;
  };
}
