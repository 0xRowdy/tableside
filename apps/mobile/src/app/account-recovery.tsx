// Recovery needed (spec 2, *Account gate*): this installation can't open the
// account's data. The vault kept the original files untouched. The locked-state
// screens (support links, restoring synced history) are later spec 2 work;
// this holds the place so the gate never lands on an empty screen.

import { Redirect } from 'expo-router';

import { useAccount } from '@/account/AccountProvider';
import { FirstRunScreen } from '@/account/FirstRunParts';

export default function AccountRecovery() {
  const { gate } = useAccount();
  if (gate.state !== 'recovery-needed') return <Redirect href="/" />;
  return <FirstRunScreen title="Your data can't be opened" intro="Tableside can't open your data on this device. It has kept it exactly as it was." />;
}
