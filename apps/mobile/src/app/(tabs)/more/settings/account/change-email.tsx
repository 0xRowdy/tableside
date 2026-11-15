// S2-18 Change email: confirm it's you first (P5pP8), then the new address
// (V2l31Q). Secure Email Change sends a code to both addresses, and the
// current one keeps working until both are confirmed. Changing an address
// the player can no longer reach is support's (spec 2, *Sign-in, linking and recovery*).
// TODO(frames): the step entering both codes, and the changed confirmation, are unverified against S2-18, which draws neither.

import type { SignInMethodEntry } from '@tableside/account';
import { router, useFocusEffect } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useCallback, useState } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { ConfirmItsYouSheet } from '@/account/ConfirmItsYouSheet';
import { Field, InlineMessage, MethodButton, Status } from '@/account/FirstRunParts';
import { confirmReason } from '@/account/method-text';
import { Button } from '@/components/Button';
import { Note, SettingsScreen } from '@/settings/SettingsParts';

type Step = 'confirm' | 'address' | 'codes' | 'changed';

export default function ChangeEmail() {
  const { service } = useAccount();
  const [methods, setMethods] = useState<readonly SignInMethodEntry[] | null>();
  const [step, setStep] = useState<Step>('confirm');
  const [next, setNext] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void service.signInMethods.list().then((list) => live && setMethods(list));
      return () => {
        live = false;
      };
    }, [service]),
  );

  const back = { label: 'Sign-in methods', onPress: () => router.dismissTo('/more/settings/account/sign-in-methods') };
  const current = methods?.find((entry) => entry.method === 'email')?.email ?? null;
  if (methods === undefined) return <SettingsScreen title="Change email" back={back}><Note>Loading…</Note></SettingsScreen>;
  if (methods === null || current === null) {
    return (
      <SettingsScreen title="Change email" back={back}>
        <Note>{methods === null ? 'Changing your email needs a connection. Check it, then come back.' : 'This account has no email code to change.'}</Note>
      </SettingsScreen>
    );
  }

  const sendCodes = async () => {
    setBusy(true);
    setProblem(null);
    const result = await service.signInMethods.changeEmail(next);
    setBusy(false);
    if (result.status === 'codes-sent') setStep('codes');
    else if (result.status === 'fresh-authentication-required') setStep('confirm');
    else if (result.status === 'in-use') setProblem('Another Tableside account uses that address. Choose a different one.');
    else if (result.status === 'same-address') setProblem("That's already your sign-in email.");
    else if (result.status === 'invalid') setProblem('Enter a whole email address, like name@example.com.');
    else setProblem("Couldn't send the codes. Check your connection and try again.");
  };

  const confirmCodes = async () => {
    const codes = { currentCode: currentCode.replace(/\s/g, ''), newCode: newCode.replace(/\s/g, '') };
    if (!/^\d{6}$/.test(codes.currentCode) || !/^\d{6}$/.test(codes.newCode)) {
      setProblem('Enter the 6-digit code from each email.');
      return;
    }
    setBusy(true);
    setProblem(null);
    const result = await service.signInMethods.confirmEmailChange(codes);
    setBusy(false);
    if (result.status === 'changed') setStep('changed');
    else if (result.status === 'invalid-code') setProblem(`The code sent to ${result.address === 'current' ? current : next} didn't work. Check it and try again.`);
    else setProblem("Couldn't confirm the change. Check your connection and try again.");
  };

  return (
    <SettingsScreen title="Change email" back={back}>
      {step === 'changed' ? (
        <>
          <Status>{`Your sign-in email is now ${next.trim()}.`}</Status>
          <Button label="Back to sign-in methods" variant="secondary" stretch onPress={back.onPress} />
        </>
      ) : step === 'codes' ? (
        <>
          <Note>{"We've sent a code to each address. Enter both to finish. Until then, your current address keeps working."}</Note>
          <Field label={`Code sent to ${current}`} value={currentCode} onChangeText={setCurrentCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} />
          <Field label={`Code sent to ${next.trim()}`} value={newCode} onChangeText={setNewCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} />
          {problem !== null && <InlineMessage>{problem}</InlineMessage>}
          <MethodButton label="Confirm email change" variant="primary" disabled={busy} onPress={() => void confirmCodes()} />
        </>
      ) : (
        <>
          <Field label="Current email" value={current} editable={false} />
          <Field
            label="New email"
            value={next}
            onChangeText={setNext}
            problem={problem !== null}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void sendCodes()}
          />
          <Note>{"We'll send a code to both addresses. Your current address keeps working until both are confirmed. If you can't reach your current address, contact support."}</Note>
          {problem !== null && <InlineMessage>{problem}</InlineMessage>}
          <Button label="Send codes" icon={Send} stretch disabled={busy || step === 'confirm'} onPress={() => void sendCodes()} />
        </>
      )}
      {step === 'confirm' && (
        <ConfirmItsYouSheet
          reason={confirmReason({ kind: 'change-email' })}
          methods={methods}
          onClose={back.onPress}
          onConfirmed={() => setStep('address')}
        />
      )}
    </SettingsScreen>
  );
}
