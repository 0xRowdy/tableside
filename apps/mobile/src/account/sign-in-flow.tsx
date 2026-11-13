import { createContext, useContext, useState, type ReactNode } from 'react';

/** Which way the player came in: Sign in (an existing account) or Create (a new one). */
export type Intent = 'sign-in' | 'create';

interface SignInFlow {
  readonly intent: Intent;
  /** The address the code goes to. Held in memory only, never in a route or log. */
  readonly email: string;
  start(intent: Intent): void;
  setEmail(email: string): void;
}

const SignInFlowContext = createContext<SignInFlow | null>(null);

/** The first run's choices so far, shared by its screens. */
export function SignInFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ intent: Intent; email: string }>({ intent: 'sign-in', email: '' });
  const value: SignInFlow = {
    ...state,
    start: (intent) => setState((current) => ({ ...current, intent })),
    setEmail: (email) => setState((current) => ({ ...current, email })),
  };
  return <SignInFlowContext.Provider value={value}>{children}</SignInFlowContext.Provider>;
}

export function useSignInFlow(): SignInFlow {
  const flow = useContext(SignInFlowContext);
  if (!flow) throw new Error('useSignInFlow needs a SignInFlowProvider');
  return flow;
}
