// S2-22 Delete account (More → Settings → Account, and the age-restricted
// paused screen's "Delete account"): Confirm it's you first, then the export
// offer, the store's subscription and refund paths (canceling isn't needed),
// and what scheduling does (access locks, public content is hidden, data is
// kept, billing continues), before the choice: schedule deletion with a
// 30-day undo, or Delete permanently now. Delete permanently now shows its
// own warnings first (#104: unsynced records lost, "Deleted author", paid
// time forfeited, no undo) and asks once more. Online only: nothing is
// queued. Once scheduled, the gate locks and the deletion-scheduled screen
// (S2-23) replaces this one; once deleted, the device erases the account and the
// Deleted screen replaces it.
// TODO(frames): unverified against S2-22 — the frame couldn't be read (Pencil unreachable). The steps, copy and layout come from spec 2 *Deletion*, Amendments 1 C2–C3, 3 §3–4 and 9 §3, and #103/#104.
// TODO(spec 7 D9): "Paid time is forfeited" is provisional (Amendment 9 §3): under Outcome B its copy follows the owner's choice recorded there.

import { DELETION_UNKNOWN, SCHEDULE_UNKNOWN, type SignInMethodEntry } from '@tableside/account';
import { Archive, CloudOff, CreditCard, Download, EyeOff, Lock, Trash2, UserX } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { Group, GroupLabel, ListRow, Note, SettingsScreen } from '@/settings/SettingsParts';

import { useAccount } from './AccountProvider';
import { BillingHelpRows, STORES, deviceStore } from './BillingHelp';
import { ConfirmItsYouSheet } from './ConfirmItsYouSheet';
import { InlineMessage } from './FirstRunParts';
import { confirmReason } from './method-text';

export const DELETION_NEEDS_CONNECTION = 'Deleting your account needs a connection, and nothing is saved to send later. Connect, then try again.';

/** What Delete permanently now says is lost with the records this device hasn't synced. */
export function unsyncedDetail(waiting: number | null): string {
  if (waiting === null || waiting === 0) return "Anything on this device that hasn't reached your account is erased with it, and can't be recovered.";
  return `${waiting === 1 ? '1 record' : `${waiting} records`} on this device ${waiting === 1 ? "hasn't" : "haven't"} reached your account. ${waiting === 1 ? "It's" : "They're"} erased with it, and can't be recovered.`;
}

export function DeleteAccountScreen({ back, onExport }: { back: { label: string; onPress: () => void }; onExport: () => void }) {
  const { service } = useAccount();
  const [methods, setMethods] = useState<readonly SignInMethodEntry[] | null | undefined>();
  const [confirming, setConfirming] = useState<'begin' | 'schedule' | 'delete' | null>(null);
  const [permanent, setPermanent] = useState(false);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
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
    try {
      const result = await service.deletion.schedule();
      // 'scheduled': the gate is Deletion scheduled now, and its screen replaces this one.
      if (result.status === 'fresh-authentication-required') setConfirming('schedule');
      else if (result.status === 'offline') setProblem(DELETION_NEEDS_CONNECTION);
      else if (result.status === 'failed') setProblem(SCHEDULE_UNKNOWN);
    } finally {
      setBusy(false);
    }
  };

  /** Shows Delete permanently now's own warnings, with how many records haven't synced. */
  const choosePermanent = async () => {
    setPermanent(true);
    setProblem(null);
    setWaiting(await service.sync.countWaiting().catch(() => null));
  };

  const deletePermanently = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await service.deletion.deletePermanently();
      // 'deleted': the gate is Deleted now, and its screen replaces this one.
      if (result.status === 'fresh-authentication-required') setConfirming('delete');
      else if (result.status === 'offline') setProblem(DELETION_NEEDS_CONNECTION);
      else if (result.status === 'failed') setProblem(DELETION_UNKNOWN);
    } finally {
      setBusy(false);
    }
  };

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
          {!permanent ? (
            <Button label="Delete permanently now" variant="ghost" stretch disabled={busy} onPress={() => void choosePermanent()} />
          ) : (
            <>
              <GroupLabel>IF YOU DELETE PERMANENTLY NOW</GroupLabel>
              <Group>
                <ListRow icon={CloudOff} title="Records that haven't synced are lost" detail={unsyncedDetail(waiting)} />
                <ListRow
                  icon={UserX}
                  title={'Shown as "Deleted author"'}
                  detail={'Your profile and strategy descriptions are removed. Strategies others saved or remixed keep working, credited to "Deleted author".'}
                />
                <ListRow
                  icon={CreditCard}
                  title="Paid time is forfeited"
                  detail={`Any subscription time left is lost. Deleting doesn't cancel the subscription: cancel it in the ${store.name} so you aren't charged again.`}
                />
                <ListRow icon={Trash2} title="There's no undo" detail="Your account and its data are erased within seven days, and the account can't come back." />
              </Group>
              <Button label="Delete permanently now" stretch disabled={busy} onPress={() => void deletePermanently()} />
              <Button label="Keep my account" variant="ghost" stretch disabled={busy} onPress={() => setPermanent(false)} />
            </>
          )}
        </>
      )}
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
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
            else if (then === 'delete') void deletePermanently();
          }}
        />
      )}
    </SettingsScreen>
  );
}
