// S2-15 Age — unresolved before any account exists (Create path, nothing
// kept): a required platform check stands in the way, so no answer can decide.

import { router } from 'expo-router';

import { Actions, FirstRunScreen, LinkButton, SectionLabel } from '@/account/FirstRunParts';
import { RestrictedPathRows } from '@/account/RestrictedPaths';
import { Button } from '@/components/Button';

export default function AgeUnresolved() {
  return (
    <FirstRunScreen
      title="We couldn't confirm your age"
      context={{ title: 'Create your account' }}
      intro="No account was created and nothing was kept. You can try again when your device can share an age range, or answer the age question if it's offered."
    >
      <SectionLabel>Need help?</SectionLabel>
      <RestrictedPathRows only={['contact-support']} />
      <Actions>
        <Button label="Try the age check again" variant="secondary" stretch onPress={() => router.replace('/age')} />
        <LinkButton label="Back to welcome" onPress={() => router.dismissTo('/welcome')} />
      </Actions>
    </FirstRunScreen>
  );
}
