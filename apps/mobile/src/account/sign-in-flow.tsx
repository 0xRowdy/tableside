import type { CodeIntent, IdentityProvider } from '@tableside/account';
import { router } from 'expo-router';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { useAccount } from './AccountProvider';
import { codeRequestProblem } from './code-request-text';
import { PROVIDERS } from './providers';

interface SignInFlow {
  readonly intent: CodeIntent;
  readonly email: string;
  readonly provider: IdentityProvider | null;
  startSignIn(): void;
  startCreate(): void;
  createWith(provider: IdentityProvider): void;
  setEmail(email: string): void;
}

const SignInFlowContext = createContext<SignInFlow | null>(null);

export function SignInFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ intent: CodeIntent; email: string; provider: IdentityProvider | null }>({
    intent: 'sign-in',
    email: '',
    provider: null,
  });
  const value: SignInFlow = {
    ...state,
    startSignIn: () => {
      setState((current) => ({ ...current, intent: 'sign-in', provider: null }));
      router.push('/email');
    },
    startCreate: () => {
      setState((current) => ({ ...current, intent: 'create', provider: null }));
      router.push('/age');
    },
    createWith: (provider) => {
      setState((current) => ({ ...current, intent: 'create', provider }));
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

const providerProblem = (provider: IdentityProvider) =>
  `Couldn't continue with ${PROVIDERS[provider].name}. Check your connection and try again, or use another way to sign in.`;

export interface ProviderStep {
  run(provider: IdentityProvider): Promise<void>;
  readonly busy: boolean;
  readonly problem: string | null;
}

function useProviderStep(step: (provider: IdentityProvider) => Promise<'failed' | 'done'>): ProviderStep {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return {
    busy,
    problem,
    async run(provider) {
      setBusy(true);
      setProblem(null);
      const outcome = await step(provider);
      setBusy(false);
      if (outcome === 'failed') setProblem(providerProblem(provider));
    },
  };
}

export function useProviderSignIn(): ProviderStep {
  const { service } = useAccount();
  return useProviderStep(async (provider) => {
    const result = await service.signInWithProvider(provider);
    if (result.status === 'no-account') router.push({ pathname: '/no-account', params: { provider } });
    return result.status === 'failed' ? 'failed' : 'done';
  });
}

export function useProviderCreate(): ProviderStep {
  const { service } = useAccount();
  const flow = useSignInFlow();
  return useProviderStep(async (provider) => {
    const result = await service.createWithProvider(provider, { sameIdentity: flow.provider === provider });
    if (result.status === 'age-required') router.replace('/age');
    return result.status === 'failed' ? 'failed' : 'done';
  });
}
