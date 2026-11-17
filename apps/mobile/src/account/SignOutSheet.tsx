// TODO(spec 2 S2-17)

import { LogOut } from 'lucide-react-native';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { Sheet, SheetText } from '@/components/Sheet';

import { useAccount } from './AccountProvider';
import { signOutText, deviceName } from './account-text';

export function SignOutSheet({ waiting, onClose }: { waiting: number; onClose: () => void }) {
  const { service } = useAccount();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = () => {
    setSigningOut(true);
    void service.signOut();
  };
  return (
    <Sheet title={`Sign out of this ${deviceName()}?`} onClose={onClose} testID="sign-out-scroll">
      <SheetText>{signOutText(waiting)}</SheetText>
      <SheetText small>
        {waiting > 0 ? 'Export the local supplement first if you want a copy. Other devices stay signed in.' : 'Other devices stay signed in.'}
      </SheetText>
      <Button label="Sign out" icon={LogOut} stretch disabled={signingOut} onPress={signOut} />
      <Button label="Cancel" variant="ghost" stretch disabled={signingOut} onPress={onClose} />
    </Sheet>
  );
}
