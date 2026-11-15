// S2-15 Age — unresolved before any account exists (Create path, nothing
// kept): a required platform check stands in the way, so no answer can decide.
// The frame (B5g04d) draws only Contact support; Amendment 9 §1 adds Make a
// privacy request to every restricted screen, and amendments win over frames.

import { router } from 'expo-router';

import { Actions, FirstRunScreen, LinkButton } from '@/account/FirstRunParts';
import { RestrictedPathRows } from '@/account/RestrictedPaths';
import { Button } from '@/components/Button';
import { GroupLabel } from '@/settings/SettingsParts';

export default function AgeUnresolved() {
  return (
    <FirstRunScreen
      title="We couldn't confirm your age"
      bar={{ title: 'Create your account' }}
      intro="No account was created and nothing was kept. You can try again when your device can share an age range, or answer the age question if it's offered."
    >
      <GroupLabel>NEED HELP?</GroupLabel>
      <RestrictedPathRows only={['contact-support', 'privacy-request']} />
      <Actions>
        <Button label="Try the age check again" variant="secondary" stretch onPress={() => router.replace('/age')} />
        <LinkButton label="Back to welcome" onPress={() => router.dismissTo('/welcome')} />
      </Actions>
    </FirstRunScreen>
  );
}
