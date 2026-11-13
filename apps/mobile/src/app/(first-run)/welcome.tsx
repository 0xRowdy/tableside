// S2-13 Welcome: Sign in and Create are separate paths, and the screen says why
// a connection is needed. Sign in never asks for age.
// TODO(frames): unverified against S2-13 (Pencil couldn't open Tableside.pen for #88).

import { router } from 'expo-router';

import { Actions, Body, FirstRunScreen } from '@/account/FirstRunParts';
import { useSignInFlow } from '@/account/sign-in-flow';
import { Button } from '@/components/Button';

export default function Welcome() {
  const flow = useSignInFlow();
  return (
    <FirstRunScreen title="Tableside" intro="Practice blackjack, craps and roulette with coaching, and keep your sessions in your account.">
      <Body>You need a connection to sign in or create an account. After that, Tableside works offline.</Body>
      <Actions>
        <Button
          label="Sign in"
          hint="For an account you already have"
          stretch
          onPress={() => {
            flow.start('sign-in');
            router.push('/email');
          }}
        />
        <Button
          label="Create account"
          hint="Start a new account"
          variant="secondary"
          stretch
          onPress={() => {
            flow.start('create');
            router.push('/age');
          }}
        />
      </Actions>
    </FirstRunScreen>
  );
}
