// TODO(spec 2 S2-18)

import type { IdentityProvider, SignInMethod, SignInMethodEntry } from '@tableside/account';
import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { codeRequestProblem } from '@/account/code-request-text';
import { ConfirmItsYouSheet } from '@/account/ConfirmItsYouSheet';
import { CodeField, enteredCode, InlineMessage, MethodButton, Status } from '@/account/FirstRunParts';
import { confirmReason, methodName } from '@/account/method-text';
import { PROVIDERS } from '@/account/providers';
import { AddMethodRow, Banner, MethodCard } from '@/account/SignInMethodParts';
import { Sheet, SheetText } from '@/components/Sheet';
import { Group, GroupLabel, Note, SettingsScreen } from '@/settings/SettingsParts';

const ADDABLE: readonly SignInMethod[] = ['apple', 'google', 'email'];

type Change = { readonly kind: 'add'; readonly method: SignInMethod } | { readonly kind: 'remove'; readonly entry: SignInMethodEntry };

export default function SignInMethodsScreen() {
  const { service } = useAccount();
  const [methods, setMethods] = useState<readonly SignInMethodEntry[] | null | undefined>();
  const [confirming, setConfirmingChange] = useState<Change | null>(null);
  const [confirmSheetKey, setConfirmSheetKey] = useState(0);
  const setConfirming = (change: Change | null) => {
    if (change) setConfirmSheetKey((count) => count + 1);
    setConfirmingChange(change);
  };
  const [conflict, setConflict] = useState<IdentityProvider | null>(null);
  const [lastMethod, setLastMethod] = useState<string | null>(null);
  const [emailCodeTo, setEmailCodeTo] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => setMethods(await service.signInMethods.list()), [service]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const back = { label: 'Account', onPress: () => router.dismissTo('/more/settings/account') };
  if (methods === undefined) return <SettingsScreen title="Sign-in methods" back={back}><Note>Loading…</Note></SettingsScreen>;
  if (methods === null) {
    return (
      <SettingsScreen title="Sign-in methods" back={back}>
        <Note>Sign-in methods need a connection. Check it, then come back.</Note>
      </SettingsScreen>
    );
  }

  const done = (message: string) => {
    setStatus(message);
    void reload();
  };

  const apply = async (change: Change) => {
    setBusy(true);
    setProblem(null);
    setStatus(null);
    try {
      if (change.kind === 'remove') {
        const result = await service.signInMethods.remove(change.entry.id);
        const name = methodName(change.entry.method);
        if (result.status === 'removed') done(`${name} removed.`);
        else if (result.status === 'last-method') setLastMethod(change.entry.id);
        else if (result.status === 'fresh-authentication-required') setConfirming(change);
        else if (result.status === 'confirm-with-another-method') setProblem(`Confirm it's you with a method you're keeping, then remove ${name}.`);
        else setProblem(`Couldn't remove ${name}. Check your connection and try again.`);
      } else if (change.method === 'email') {
        const result = await service.signInMethods.requestEmailMethodCode();
        if (result.status === 'sent') setEmailCodeTo((await service.accountSummary())?.email ?? 'your sign-in email');
        else if (result.status === 'fresh-authentication-required') setConfirming(change);
        else if (result.status === 'rate-limited' || result.status === 'failed') setProblem(codeRequestProblem(result));
      } else {
        const provider = change.method;
        const result = await service.signInMethods.link(provider);
        if (result.status === 'linked') done(`${PROVIDERS[provider].name} added. We've emailed you about it.`);
        else if (result.status === 'already-linked') done(`That ${PROVIDERS[provider].identity} is already a sign-in method.`);
        else if (result.status === 'conflict') setConflict(provider);
        else if (result.status === 'fresh-authentication-required') setConfirming(change);
        else if (result.status === 'failed') setProblem(`Couldn't add ${PROVIDERS[provider].name}. Check your connection and try again.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = (entry: SignInMethodEntry) => {
    setStatus(null);
    setProblem(null);
    if (methods.length <= 1) setLastMethod(entry.id);
    else setConfirming({ kind: 'remove', entry });
  };
  const add = (method: SignInMethod) => {
    setLastMethod(null);
    setStatus(null);
    setProblem(null);
    setConfirming({ kind: 'add', method });
  };

  if (conflict) {
    const { name, identity } = PROVIDERS[conflict];
    return (
      <SettingsScreen title="Sign-in methods" back={back}>
        <Banner tone="other-account" title={`This ${identity} is already in use`}>
          {"It's linked to a different Tableside account. We never merge accounts, so histories and purchases stay separate."}
        </Banner>
        <Note>{`To use this ${identity} here, sign in to the other account, remove ${name} there, then try again.`}</Note>
        <MethodButton
          label={`Choose a different ${identity}`}
          icon={PROVIDERS[conflict].icon}
          variant="primary"
          disabled={busy}
          onPress={() => {
            setConflict(null);
            void apply({ kind: 'add', method: conflict });
          }}
        />
        <MethodButton label="Back to sign-in methods" disabled={busy} onPress={() => setConflict(null)} />
      </SettingsScreen>
    );
  }

  const have = new Set(methods.map((entry) => entry.method));
  const missing = ADDABLE.filter((method) => !have.has(method));
  const first = methods[0];
  const backupDetail = first ? `A backup way in if you lose access to ${methodName(first.method)}` : 'Another way to sign in';
  const confirmWith = confirming?.kind === 'remove' ? methods.filter((entry) => entry.id !== confirming.entry.id) : methods;

  return (
    <SettingsScreen title="Sign-in methods" back={back}>
      <Note>You need at least one way to sign in. A second one helps if you lose access to the first.</Note>
      {status !== null && <Status>{status}</Status>}
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      {methods.map((entry) => (
        <Fragment key={entry.id}>
          <MethodCard
            entry={entry}
            disabled={busy}
            onRemove={() => remove(entry)}
            onChangeEmail={entry.method === 'email' ? () => router.navigate('/more/settings/account/change-email') : undefined}
          />
          {lastMethod === entry.id && (
            <Banner
              tone="last-method"
              title="This is your only way to sign in"
              action={missing[0] ? { label: 'Add a method', onPress: () => add(missing[0]!) } : undefined}
            >
              Removing it would lock you out. Add another method first, then you can remove this one.
            </Banner>
          )}
        </Fragment>
      ))}
      {missing.length > 0 && (
        <>
          <GroupLabel>Add a method</GroupLabel>
          <Group>
            {missing.map((method) => (
              <AddMethodRow key={method} method={method} detail={backupDetail} disabled={busy} onPress={() => add(method)} />
            ))}
          </Group>
        </>
      )}
      <Note>{"Changes ask you to confirm it's you. We email you when a method is added or a device is signed out."}</Note>
      {confirming && (
        <ConfirmItsYouSheet
          key={confirmSheetKey}
          reason={confirmReason(confirming.kind === 'add' ? confirming : { kind: 'remove', method: confirming.entry.method })}
          methods={confirmWith}
          onClose={() => setConfirming(null)}
          onConfirmed={() => {
            const change = confirming;
            setConfirming(null);
            void apply(change);
          }}
        />
      )}
      {emailCodeTo !== null && (
        <EmailMethodCodeSheet
          email={emailCodeTo}
          onClose={() => setEmailCodeTo(null)}
          onLinked={() => {
            setEmailCodeTo(null);
            done("Email code added. We've emailed you about it.");
          }}
          onExpired={() => {
            setEmailCodeTo(null);
            setConfirming({ kind: 'add', method: 'email' });
          }}
        />
      )}
    </SettingsScreen>
  );
}

function EmailMethodCodeSheet({ email, onClose, onLinked, onExpired }: { email: string; onClose: () => void; onLinked: () => void; onExpired: () => void }) {
  const { service } = useAccount();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const confirm = async () => {
    const entered = enteredCode(code);
    if (!entered) {
      setProblem('Enter the 6-digit code from the email.');
      return;
    }
    setBusy(true);
    setProblem(null);
    const result = await service.signInMethods.confirmEmailMethod(entered);
    setBusy(false);
    if (result.status === 'linked' || result.status === 'already-linked') onLinked();
    else if (result.status === 'fresh-authentication-required') onExpired();
    else if (result.status === 'invalid-code') setProblem("That code didn't work. Check it, or start again for a new code.");
    else setProblem("Couldn't add the email code. Check your connection and try again.");
  };
  return (
    <Sheet title="Add email code" onClose={onClose} testID="add-email-code">
      <SheetText>{`Enter the code we sent to ${email}. Then you can sign in with a code sent there.`}</SheetText>
      <CodeField value={code} onChangeText={setCode} problem={problem !== null} onSubmit={() => void confirm()} />
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      <MethodButton label="Add email code" variant="primary" disabled={busy} onPress={() => void confirm()} />
      <MethodButton label="Cancel" variant="ghost" disabled={busy} onPress={onClose} />
    </Sheet>
  );
}
