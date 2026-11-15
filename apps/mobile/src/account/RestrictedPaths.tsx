// The paths a restricted account keeps (spec 2, *Age eligibility*; Amendment 5
// §4, Amendment 9 §1): Contact support, Make a privacy request, billing help
// (Manage subscription and refund requests, never a purchase), authenticated
// export and deletion. Their screens belong to other work (support and privacy
// requests: web pages for now, spec 7 later; billing help: spec 5; export and
// deletion: spec 2's own tickets). Each opens through the app account's port.

import { CreditCard, Download, LifeBuoy, ShieldCheck, Trash2 } from 'lucide-react-native';

import { Group, ListRow } from '@/settings/SettingsParts';

import { useAccount } from './AccountProvider';

export type RestrictedPath = 'contact-support' | 'billing-help' | 'export' | 'delete-account' | 'privacy-request';

/** Opens a restricted path's screen. */
export interface RestrictedPaths {
  open(path: RestrictedPath): void;
}

/** The rows of a restricted screen; `only` limits them (before any account exists, only support). */
export function RestrictedPathRows({ only }: { only?: readonly RestrictedPath[] }) {
  const { account } = useAccount();
  const shown = (path: RestrictedPath) => !only || only.includes(path);
  const open = (path: RestrictedPath) => () => account.restrictedPaths.open(path);
  return (
    <Group>
      {shown('contact-support') && <ListRow icon={LifeBuoy} title="Contact support" detail="Ask about confirming your age" onPress={open('contact-support')} />}
      {shown('billing-help') && <ListRow icon={CreditCard} title="Billing help" detail="Subscriptions and refunds" onPress={open('billing-help')} />}
      {shown('export') && <ListRow icon={Download} title="Export my data" detail="Sign-in needed to confirm it's you" onPress={open('export')} />}
      {shown('delete-account') && <ListRow icon={Trash2} title="Delete account" onPress={open('delete-account')} />}
      {shown('privacy-request') && (
        <ListRow icon={ShieldCheck} title="Make a privacy request" detail="See, correct, delete or get a copy of your data" onPress={open('privacy-request')} />
      )}
    </Group>
  );
}
