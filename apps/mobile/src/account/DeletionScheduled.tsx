// S2-23 Locked — deletion scheduled: the server confirmed the account's
// deletion is scheduled. Ordinary access is closed and the tab bar hidden,
// but the session and the records stay (the database stays open for export),
// until the deadline. Cancel deletion (Confirm it's you again) reopens the
// same account; signing in again never does. The restricted paths stay:
// deletion status, export, billing help, Contact support and Make a privacy
// request (spec 2 Amendments 1 A1, B2, 8 §7 and 9 §1).
// TODO(frames): unverified against S2-23's deletion-scheduled variant — the frame couldn't be read (Pencil unreachable). The copy and layout come from spec 2 *Deletion*, Amendments 1 A1, B2, 3 §4 and 9 §1, and #103.

import type { AccountGate, DeletionStatus, SignInMethodEntry } from '@tableside/account';
import { CalendarClock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Group, GroupLabel, ListRow } from '@/settings/SettingsParts';
import { palette, radius } from '@/theme/tokens';

import { dayText } from './account-text';
import { useAccount } from './AccountProvider';
import { ConfirmItsYouSheet } from './ConfirmItsYouSheet';
import { Actions, Body, FirstRunScreen, InlineMessage } from './FirstRunParts';
import { confirmReason } from './method-text';
import { RestrictedPathRows } from './RestrictedPaths';

export type DeletionScheduledGate = Extract<AccountGate, { state: 'deletion-scheduled' }>;

const CANCEL_NEEDS_CONNECTION = 'Canceling deletion needs a connection. Connect, then try again.';
const TOO_LATE = "It's too late to cancel: the deletion date has passed, so your account is being deleted.";
const FAILED = "Couldn't cancel deletion. Check your connection and try again.";

/** What Deletion status says: the server's answer when it came, else what the gate knows. */
function statusDetail(gate: DeletionScheduledGate, status: DeletionStatus | null | undefined): string {
  const deadline = status?.status === 'scheduled' ? status.deadline : gate.deadline;
  return `Scheduled · deleted permanently on ${dayText(deadline)}`;
}

export function DeletionScheduled({ gate }: { gate: DeletionScheduledGate }) {
  const { service } = useAccount();
  const [status, setStatus] = useState<DeletionStatus | null | undefined>();
  const [methods, setMethods] = useState<readonly SignInMethodEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void service.deletion.status().then((answer) => live && setStatus(answer));
    return () => {
      live = false;
    };
  }, [service]);

  const cancel = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await service.deletion.cancel();
      // 'cancelled': the gate reopens the account, and the tabs replace this screen.
      if (result.status === 'fresh-authentication-required') {
        const found = await service.freshAuthentication.methods();
        if (found) setMethods(found);
        else setProblem(CANCEL_NEEDS_CONNECTION);
      } else if (result.status === 'offline') setProblem(CANCEL_NEEDS_CONNECTION);
      else if (result.status === 'too-late') setProblem(TOO_LATE);
      else if (result.status === 'failed') setProblem(FAILED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FirstRunScreen title="Your account is scheduled for deletion" bar={{ title: 'Account locked' }} lead={<ScheduledIcon />}>
      <Body>
        {`It will be deleted permanently on ${dayText(gate.deadline)}. Until then, practice and your account are locked on every device, your public content is hidden, and your data is kept.`}
      </Body>
      <Actions>
        <Button label="Cancel deletion" stretch disabled={busy} onPress={() => void cancel()} />
      </Actions>
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      <GroupLabel>DELETION STATUS</GroupLabel>
      <Group>
        <ListRow icon={CalendarClock} title="Deletion status" detail={statusDetail(gate, status)} />
      </Group>
      <GroupLabel>YOU CAN STILL</GroupLabel>
      <RestrictedPathRows only={['export', 'billing-help', 'contact-support', 'privacy-request']} supportDetail="Ask about your account or its deletion" />
      {methods && (
        <ConfirmItsYouSheet
          reason={confirmReason({ kind: 'cancel-deletion' })}
          methods={methods}
          onClose={() => setMethods(null)}
          onConfirmed={() => {
            setMethods(null);
            void cancel();
          }}
        />
      )}
    </FirstRunScreen>
  );
}

function ScheduledIcon() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.icon}>
      <CalendarClock color={palette.warning} size={30} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
});
