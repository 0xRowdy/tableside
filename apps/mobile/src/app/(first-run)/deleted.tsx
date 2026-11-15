// Deleted (#104): the account was deleted permanently and this device erased it.

import { Redirect } from 'expo-router';

import { AccountDeleted } from '@/account/AccountDeleted';
import { useAccount } from '@/account/AccountProvider';

export default function Deleted() {
  const { gate } = useAccount();
  if (gate.state !== 'deleted') return <Redirect href="/" />;
  return <AccountDeleted />;
}
