// S2-17 Account (More → Settings → Account): identity with the sign-in email
// kept private, sign-in methods and devices, the account's data, Delete
// account, and Sign out of this device. The entries open their own screens
// (S2-18 to S2-22), which later spec 2 tickets build.
// TODO(frames): the Currency row is unverified against S2-17, which has none (spec 2 Amendment 4 §4 adds it).

import { router } from 'expo-router';
import { Banknote, Download, HardDriveDownload, KeyRound, Lock, LogOut, RefreshCw, Smartphone, Trash2, User } from 'lucide-react-native';
import { useState } from 'react';

import { currencyText, devicesText, methodsList, waitingText } from '@/account/account-text';
import { SignOutSheet } from '@/account/SignOutSheet';
import { useAccountOverview } from '@/account/use-account-overview';
import { Button } from '@/components/Button';
import { Group, GroupLabel, ListRow, Note, SettingsScreen } from '@/settings/SettingsParts';

const open = (area: string) => () => router.navigate({ pathname: '/more/settings/account/[area]', params: { area } });

export default function Account() {
  const overview = useAccountOverview();
  const [confirming, setConfirming] = useState(false);
  const summary = overview?.summary;
  return (
    <SettingsScreen title="Account" back={{ label: 'Settings', onPress: () => router.dismissTo('/more/settings') }}>
      <GroupLabel>YOU</GroupLabel>
      <Group>
        <ListRow
          icon={User}
          title="Display name"
          detail="Not set. You'll choose one the first time you publish or rate."
          value="Set"
          onPress={open('display-name')}
        />
        {summary?.email && <ListRow icon={Lock} title="Sign-in email" detail={`${summary.email} · private, never shown to other players`} />}
        {summary &&
          (summary.currencyChangeable === false ? (
            <ListRow icon={Banknote} title="Currency" detail={`${currencyText(summary.currency)} · can't change while you have casino sessions`} />
          ) : (
            <ListRow
              icon={Banknote}
              title="Currency"
              detail={`${currencyText(summary.currency)} · used for casino records`}
              onPress={() => router.navigate('/more/settings/account/currency')}
            />
          ))}
      </Group>
      <GroupLabel>SECURITY</GroupLabel>
      <Group>
        <ListRow
          icon={KeyRound}
          title="Sign-in methods"
          detail={summary ? methodsList(summary.methods) : 'Apple, Google and email code'}
          value={summary ? String(summary.methods.length) : undefined}
          onPress={open('sign-in-methods')}
        />
        <ListRow
          icon={Smartphone}
          title="Devices"
          detail={summary?.devices ? devicesText(summary.devices) : 'Where this account is signed in'}
          value={summary?.devices ? String(summary.devices) : undefined}
          onPress={open('devices')}
        />
      </Group>
      <GroupLabel>YOUR DATA</GroupLabel>
      <Group>
        <ListRow icon={RefreshCw} title="Sync status" detail={overview ? waitingText(overview.waiting) : 'Checking…'} onPress={() => router.navigate('/more/settings/account/sync')} />
        <ListRow
          icon={HardDriveDownload}
          title="Download all history"
          detail="Keep everything on this device, for offline trips"
          onPress={open('download-history')}
        />
        <ListRow icon={Download} title="Export my data" detail="Spreadsheet and data files, plus anything not yet synced" onPress={open('export')} />
      </Group>
      <Group>
        <ListRow icon={Trash2} title="Delete account" detail="Choose a 30-day undo or permanent deletion" destructive onPress={open('delete')} />
      </Group>
      <Button label="Sign out of this device" icon={LogOut} variant="secondary" stretch onPress={() => setConfirming(true)} />
      <Note>Signs out only this device. Unsynced work stays here until you sign back in to this account.</Note>
      {confirming && <SignOutSheet waiting={overview?.waiting ?? 0} onClose={() => setConfirming(false)} />}
    </SettingsScreen>
  );
}
