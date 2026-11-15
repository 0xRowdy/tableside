// When this installation can't open the account's data: Recovery needed (spec
// 2, *Account gate*), a database from a later build, or a migration that failed
// and tries again at the next launch. The vault kept the files untouched. The
// locked-state screens (support links, restoring synced history, the update
// prompt) are later spec 2 work; this holds the place so the gate never lands
// on an empty screen.

import { Redirect } from 'expo-router';

import { useAccount } from '@/account/AccountProvider';
import { FirstRunScreen } from '@/account/FirstRunParts';

export default function AccountRecovery() {
  const { gate } = useAccount();
  if (gate.state === 'database-unavailable' && gate.reason === 'needs-update') {
    return <FirstRunScreen title="Update Tableside" intro="Your data on this device was saved by a newer version of Tableside. Update the app to open it." />;
  }
  if (gate.state === 'database-unavailable') {
    return <FirstRunScreen title="Your data can't be opened yet" intro="Tableside couldn't finish updating your data, so it left it exactly as it was. Close and reopen the app to try again." />;
  }
  if (gate.state !== 'recovery-needed') return <Redirect href="/" />;
  return <FirstRunScreen title="Your data can't be opened" intro="Tableside can't open your data on this device. It has kept it exactly as it was." />;
}
