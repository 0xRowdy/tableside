// S2-22 Delete account (More → Settings → Account, and the age-restricted
// paused screen's "Delete account"): Confirm it's you first, then the export
// offer, the store's subscription and refund paths (canceling isn't needed),
// and what scheduling does (access locks, public content is hidden, data is
// kept, billing continues), before the choice: schedule deletion with a
// 30-day undo, or Delete permanently now. Online only: nothing is queued.
// Once scheduled, the gate locks and the deletion-scheduled screen (S2-23)
// replaces this one.
// TODO(frames): unverified against S2-22 — the frame couldn't be read (Pencil unreachable). The steps, copy and layout come from spec 2 *Deletion*, Amendments 1 C2–C3, 3 §3–4 and 9 §3, and #103.

import type { SignInMethodEntry } from '@tableside/account';
import { Archive, CreditCard, Download, EyeOff, Lock } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { Group, GroupLabel, ListRow, Note, SettingsScreen } from '@/settings/SettingsParts';

import { useAccount } from './AccountProvider';
import { BillingHelpRows, STORES, deviceStore } from './BillingHelp';
import { ConfirmItsYouSheet } from './ConfirmItsYouSheet';
import { InlineMessage, Status } from './FirstRunParts';
import { confirmReason } from './method-text';

export const DELETION_NEEDS_CONNECTION = 'Deleting your account needs a connection, and nothing is saved to send later. Connect, then try again.';
const UNKNOWN_OUTCOME = "Couldn't tell whether deletion was scheduled. Check your connection and try again; it won't be scheduled twice.";

export function DeleteAccountScreen({ back, onExport }: { back: { label: string; onPress: () => void }; onExport: () => void }) {
  const { service } = useAccount();
  const [methods, setMethods] = useState<readonly SignInMethodEntry[] | null | undefined>();
  const [confirming, setConfirming] = useState<'begin' | 'schedule' | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const store = STORES[deviceStore()];

  /** Loads the methods Confirm it's you offers, and asks: none means no connection. */
  const ask = useCallback((found: readonly SignInMethodEntry[] | null) => {
    setMethods(found);
    setConfirming(found ? 'begin' : null);
    setProblem(found ? null : DELETION_NEEDS_CONNECTION);
  }, []);

  useEffect(() => {
    let live = true;
    void service.freshAuthentication.methods().then((found) => live && ask(found));
    return () => {
      live = false;
    };
  }, [ask, service]);

  const begin = async () => ask(await service.freshAuthentication.methods());

  const schedule = async () => {
    setBusy(true);
    setProblem(null);
    setStatus(null);
    try {
      const result = await service.deletion.schedule();
      // 'scheduled': the gate is Deletion scheduled now, and its screen replaces this one.
      if (result.status === 'fresh-authentication-required') setConfirming('schedule');
      else if (result.status === 'offline') setProblem(DELETION_NEEDS_CONNECTION);
      else if (result.status === 'failed') setProblem(UNKNOWN_OUTCOME);
    } finally {
      setBusy(false);
    }
  };

  // #104 builds the irreversible boundary (its own warnings: unsynced records
  // lost, "Deleted author", paid time forfeited). Until then the choice is shown
  // and says so.
  const deletePermanently = () => setStatus("Deleting permanently now isn't available yet. Schedule deletion, and it completes on the deadline.");

  return (
    <SettingsScreen title="Delete account" back={back}>
      {!confirmed ? (
        <>
          <Note>{"First, confirm it's you."}</Note>
          {methods && <Button label="Confirm it's you" stretch onPress={() => setConfirming('begin')} />}
          {methods === null && <Button label="Try again" variant="secondary" stretch onPress={() => void begin()} />}
        </>
      ) : (
        <>
          <GroupLabel>BEFORE YOU GO</GroupLabel>
          <Group>
            <ListRow icon={Download} title="Export my data first" detail="Get a copy of your data before you go. Deletion doesn't wait for it." onPress={onExport} />
          </Group>
          <GroupLabel>YOUR SUBSCRIPTION</GroupLabel>
          <BillingHelpRows />
          <GroupLabel>IF YOU SCHEDULE DELETION</GroupLabel>
          <Group>
            <ListRow icon={Lock} title="Access locks now" detail="Practice and your account lock now, and on your other devices once they connect." />
            <ListRow icon={EyeOff} title="Public content is hidden" detail="Your profile, strategies, ratings and contributions are hidden at once." />
            <ListRow icon={Archive} title="Your data is kept" detail="Nothing is deleted for 30 days. Sign in and choose Cancel deletion to keep your account." />
            <ListRow
              icon={CreditCard}
              title="Billing continues"
              detail={`Your subscription isn't canceled. Cancel it in the ${store.name} if you don't want to be charged.`}
            />
          </Group>
          <Button label="Schedule deletion" stretch disabled={busy} onPress={() => void schedule()} />
          <Note>You have 30 days to change your mind.</Note>
          <Button label="Delete permanently now" variant="ghost" stretch disabled={busy} onPress={deletePermanently} />
        </>
      )}
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      {status !== null && <Status>{status}</Status>}
      {confirming && methods && (
        <ConfirmItsYouSheet
          reason={confirmReason({ kind: 'delete-account' })}
          methods={methods}
          onClose={() => setConfirming(null)}
          onConfirmed={() => {
            const then = confirming;
            setConfirming(null);
            setConfirmed(true);
            if (then === 'schedule') void schedule();
          }}
        />
      )}
    </SettingsScreen>
  );
}
