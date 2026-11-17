// TODO(spec 2 S2-23)

import { type AccountGate, CANCEL_FAILED, CANCEL_TOO_LATE, type DeletionStatus, type SignInMethodEntry, scheduledDetail } from '@tableside/account';
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

function statusDetail(gate: DeletionScheduledGate, status: DeletionStatus | null | undefined): string {
  const deadline = status?.status === 'scheduled' ? status.deadline : gate.deadline;
  return scheduledDetail(deadline);
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
      if (result.status === 'fresh-authentication-required') {
        const found = await service.freshAuthentication.methods();
        if (found) setMethods(found);
        else setProblem(CANCEL_NEEDS_CONNECTION);
      } else if (result.status === 'offline') setProblem(CANCEL_NEEDS_CONNECTION);
      else if (result.status === 'too-late') setProblem(CANCEL_TOO_LATE);
      else if (result.status === 'failed') setProblem(CANCEL_FAILED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FirstRunScreen title="Your account is scheduled for deletion" bar={{ title: 'Account locked' }} lead={<ScheduledIcon />}>
      <Body>
        {`It will be deleted permanently on ${dayText(gate.deadline)}. Until then, practice and your account are locked, your public content is hidden, and your data is kept.`}
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
