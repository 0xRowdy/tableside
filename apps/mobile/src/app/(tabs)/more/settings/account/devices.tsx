// TODO(spec 2 S2-19)

import type { DeviceEntry, SignInMethodEntry } from '@tableside/account';
import { router, useFocusEffect } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useCallback, useState } from 'react';

import { deviceName, deviceShortName, namesList } from '@/account/account-text';
import { useAccount } from '@/account/AccountProvider';
import { ConfirmItsYouSheet } from '@/account/ConfirmItsYouSheet';
import { DeviceCard, DoneBanner, SignOutDevicesSheet } from '@/account/DeviceParts';
import { InlineMessage } from '@/account/FirstRunParts';
import { confirmReason } from '@/account/method-text';
import { Button } from '@/components/Button';
import { Note, SettingsScreen } from '@/settings/SettingsParts';

type Target = { readonly kind: 'one'; readonly entry: DeviceEntry } | { readonly kind: 'others'; readonly entries: readonly DeviceEntry[] };

const SIGN_OUT_FAILED = "Couldn't sign out. Check your connection and try again.";

const names = (target: Target) => (target.kind === 'one' ? [deviceShortName(target.entry.label)] : target.entries.map((entry) => deviceShortName(entry.label)));

export default function DevicesScreen() {
  const { service } = useAccount();
  const [entries, setEntries] = useState<readonly DeviceEntry[] | null | undefined>();
  const [readAt, setReadAt] = useState(0);
  const [asking, setAsking] = useState<Target | null>(null);
  const [confirming, setConfirming] = useState<{ readonly target: Target; readonly methods: readonly SignInMethodEntry[] } | null>(null);
  const [done, setDone] = useState<{ readonly names: readonly string[]; readonly email: string | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const listed = await service.devices.list();
    setReadAt(Date.now());
    setEntries(listed);
  }, [service]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const back = { label: 'Account', onPress: () => router.dismissTo('/more/settings/account') };
  if (entries === undefined) {
    return (
      <SettingsScreen title="Devices" back={back}>
        <Note>Loading…</Note>
      </SettingsScreen>
    );
  }
  if (entries === null) {
    return (
      <SettingsScreen title="Devices" back={back}>
        <Note>Devices need a connection. Check it, then come back.</Note>
      </SettingsScreen>
    );
  }

  const signOut = async (target: Target) => {
    setBusy(true);
    setProblem(null);
    try {
      const result = target.kind === 'one' ? await service.devices.signOut(target.entry.id) : await service.devices.signOutOthers();
      if (result.status === 'signed-out') {
        setDone({ names: names(target), email: result.email });
        await reload();
      } else if (result.status === 'fresh-authentication-required') {
        const methods = await service.signInMethods.list();
        if (methods) setConfirming({ target, methods });
        else setProblem(SIGN_OUT_FAILED);
      } else if (result.status === 'not-found') {
        setProblem(`${namesList(names(target))} ${target.kind === 'one' ? 'is' : 'are'} already signed out.`);
        await reload();
      } else {
        setProblem(SIGN_OUT_FAILED);
      }
    } finally {
      setBusy(false);
    }
  };

  const others = entries.filter((entry) => !entry.thisDevice);
  const ask = (target: Target) => {
    setDone(null);
    setProblem(null);
    setAsking(target);
  };

  return (
    <SettingsScreen title="Devices" back={back}>
      {done ? (
        <DoneBanner names={done.names} email={done.email} />
      ) : (
        <Note>{"Devices signed in to your account. This shows sign-ins, not where a device is now. Labels come from the device; they're private to you."}</Note>
      )}
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      {entries.map((entry) => (
        <DeviceCard key={entry.id} entry={entry} now={readAt} disabled={busy} onSignOut={entry.thisDevice ? undefined : () => ask({ kind: 'one', entry })} />
      ))}
      {others.length > 0 && (
        <Button label="Sign out all other devices" icon={LogOut} variant="secondary" stretch disabled={busy} onPress={() => ask({ kind: 'others', entries: others })} />
      )}
      {asking && (
        <SignOutDevicesSheet
          names={names(asking)}
          all={asking.kind === 'others'}
          thisDevice={deviceName()}
          busy={busy}
          onClose={() => setAsking(null)}
          onConfirm={() => {
            const target = asking;
            setAsking(null);
            void signOut(target);
          }}
        />
      )}
      {confirming && (
        <ConfirmItsYouSheet
          reason={confirmReason({ kind: 'sign-out-devices' })}
          methods={confirming.methods}
          onClose={() => setConfirming(null)}
          onConfirmed={() => {
            const { target } = confirming;
            setConfirming(null);
            void signOut(target);
          }}
        />
      )}
    </SettingsScreen>
  );
}
