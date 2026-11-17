// Spec 2 S2-15

import { router } from 'expo-router';

import { Actions, FirstRunScreen } from '@/account/FirstRunParts';
import { Button } from '@/components/Button';

export default function NotAvailable() {
  return (
    <FirstRunScreen
      title="Tableside is for people 13 and older"
      intro="We haven't created an account or kept your answer, and we won't ask for anything else."
    >
      <Actions>
        <Button label="Done" variant="secondary" stretch onPress={() => router.dismissTo('/welcome')} />
      </Actions>
    </FirstRunScreen>
  );
}
