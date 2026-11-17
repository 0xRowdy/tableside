// Spec 2 Amendment 5 §4, Amendment 9 §1

import { CreditCard, Download, LifeBuoy, ShieldCheck, Trash2 } from 'lucide-react-native';

import { Group, ListRow } from '@/settings/SettingsParts';

import { useAccount } from './AccountProvider';

export type RestrictedPath = 'contact-support' | 'billing-help' | 'export' | 'delete-account' | 'privacy-request';

export interface RestrictedPaths {
  open(path: RestrictedPath): void;
}

export function RestrictedPathRows({ only, supportDetail = 'Ask about confirming your age' }: { only?: readonly RestrictedPath[]; supportDetail?: string }) {
  const { account } = useAccount();
  const shown = (path: RestrictedPath) => !only || only.includes(path);
  const open = (path: RestrictedPath) => () => account.restrictedPaths.open(path);
  return (
    <Group>
      {shown('contact-support') && <ListRow icon={LifeBuoy} title="Contact support" detail={supportDetail} onPress={open('contact-support')} />}
      {shown('billing-help') && <ListRow icon={CreditCard} title="Billing help" detail="Subscriptions and refunds" onPress={open('billing-help')} />}
      {shown('export') && <ListRow icon={Download} title="Export my data" detail="Sign-in needed to confirm it's you" onPress={open('export')} />}
      {shown('delete-account') && <ListRow icon={Trash2} title="Delete account" onPress={open('delete-account')} />}
      {shown('privacy-request') && (
        <ListRow icon={ShieldCheck} title="Make a privacy request" detail="See, correct, delete or get a copy of your data" onPress={open('privacy-request')} />
      )}
    </Group>
  );
}
