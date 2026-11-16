// S2-18 "Confirm it's you (re-authenticate)": before a change to how the
// account signs in (and, for later tickets, revoking devices, export and
// deletion), the player signs in again with one of the account's own methods.
// Being signed in already isn't enough. The Account service confirms it for
// this session only, for a few minutes.
// TODO(frames): the code-entry step after "Send a code", the problem messages, and the removal's reason (method-text.ts) are unverified against S2-18, which draws only the choice of method for adding one.

import { INVALID_CODE, type SignInMethodEntry } from '@tableside/account';
import { Mail } from 'lucide-react-native';
import { useState } from 'react';

import { Sheet, SheetText } from '@/components/Sheet';

import { useAccount } from './AccountProvider';
import { codeRequestProblem } from './code-request-text';
import { CodeField, enteredCode, InlineMessage, MethodButton, Status } from './FirstRunParts';
import { PROVIDERS } from './providers';

export function ConfirmItsYouSheet({
  reason,
  methods,
  onConfirmed,
  onClose,
}: {
  /** Why it's asked: what the change does. */
  reason: string;
  /** The methods the player may confirm with (for a removal, the ones that stay). */
  methods: readonly SignInMethodEntry[];
  onConfirmed: () => void;
  onClose: () => void;
}) {
  const { service } = useAccount();
  const [codeTo, setCodeTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const email = methods.find((method) => method.method === 'email')?.email ?? null;
  const providers = [...new Set(methods.flatMap((method) => (method.method === 'email' ? [] : [method.method])))];

  const run = async (attempt: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    await attempt();
    setBusy(false);
  };

  const withProvider = (provider: (typeof providers)[number]) =>
    run(async () => {
      const result = await service.freshAuthentication.withProvider(provider);
      if (result.status === 'confirmed') onConfirmed();
      else if (result.status === 'not-a-method') setProblem(`That ${PROVIDERS[provider].identity} isn't one of this account's sign-in methods. Use the one you sign in with.`);
      else if (result.status === 'failed') setProblem("Couldn't confirm it's you. Check your connection and try again.");
    });

  const sendCode = (again: boolean) =>
    run(async () => {
      setResent(false);
      const result = await service.freshAuthentication.requestCode();
      if (result.status === 'sent') {
        setCodeTo(email);
        setResent(again);
      } else if (result.status === 'rate-limited' || result.status === 'failed') {
        setProblem(codeRequestProblem(result));
      }
    });

  const confirmCode = () =>
    run(async () => {
      const entered = enteredCode(code);
      if (!entered) {
        setProblem('Enter the 6-digit code from the email.');
        return;
      }
      const result = await service.freshAuthentication.withCode(entered);
      if (result.status === 'confirmed') onConfirmed();
      else if (result.status === 'invalid-code') setProblem(INVALID_CODE);
      else setProblem("Couldn't confirm it's you. Check your connection and try again.");
    });

  return (
    <Sheet title="Confirm it's you" onClose={onClose} testID="confirm-its-you">
      {codeTo === null ? (
        <>
          <SheetText>{reason}</SheetText>
          {providers.map((provider) => (
            <MethodButton
              key={provider}
              label={`Continue with ${PROVIDERS[provider].name}`}
              icon={PROVIDERS[provider].icon}
              disabled={busy}
              onPress={() => void withProvider(provider)}
            />
          ))}
          {email !== null && <MethodButton label={`Send a code to ${email}`} icon={Mail} disabled={busy} onPress={() => void sendCode(false)} />}
        </>
      ) : (
        <>
          <SheetText>{`Enter the code we sent to ${codeTo}.`}</SheetText>
          <CodeField value={code} onChangeText={setCode} problem={problem !== null} onSubmit={() => void confirmCode()} />
          {resent && <Status>{"We've sent a new code. Only the newest one works."}</Status>}
          <MethodButton label="Confirm" variant="primary" disabled={busy} onPress={() => void confirmCode()} />
          <MethodButton label="Send a new code" disabled={busy} onPress={() => void sendCode(true)} />
        </>
      )}
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      <MethodButton label="Cancel" variant="ghost" disabled={busy} onPress={onClose} />
    </Sheet>
  );
}
