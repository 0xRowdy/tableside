// Deleted (#104): the server confirmed the account's permanent deletion, so
// this device erased it, and nothing of it is left here. What stays is the
// deletion's status (spec 2, *Status and email*): processing or completed,
// apart from any delay, with the analytics provider's erasure and backups
// reported on their own and never as done before they are. The store
// subscription isn't canceled by deleting, so its paths stay. Done leaves for
// the welcome screen; signing up again later is a new account. No tab bar, so
// the support and privacy links are here (Amendment 9 §1).
// TODO(frames): unverified against S2-23's processing and completed states — the frame couldn't be read (Pencil unreachable). The copy and layout come from spec 2 *Deletion*, Amendments 1 C2–C3, 8 §3 and 9 §1, and #104.

import type { DeletionProgress, DeletionStatus } from '@tableside/account';
import { ChartBar, CalendarClock, Database, KeyRound, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Group, GroupLabel, ListRow } from '@/settings/SettingsParts';
import { palette, radius } from '@/theme/tokens';

import { dayText } from './account-text';
import { useAccount } from './AccountProvider';
import { BillingHelpRows } from './BillingHelp';
import { Actions, Body, FirstRunScreen, SupportLinks } from './FirstRunParts';

const isProgress = (status: DeletionStatus | null | undefined): status is DeletionProgress =>
  status?.status === 'processing' || status?.status === 'completed';

/** The lead paragraph: what happened, and when the erasure finishes. */
export function deletedBody(progress: DeletionProgress | null): string {
  const here = 'Nothing of it is left on this device.';
  if (!progress) return `Its data is being erased from Tableside. ${here}`;
  if (progress.status === 'completed' && progress.completedAt !== null) return `Its data was erased from Tableside on ${dayText(progress.completedAt)}. ${here}`;
  return `Its data is being erased from Tableside, by ${dayText(progress.cleanupBy)}. ${here}`;
}

/** The deletion's own row: processing (or delayed) or completed, never a deadline. */
export function deletionDetail(progress: DeletionProgress | null): string {
  if (!progress) return "Can't check right now. Connect to see how it's going.";
  if (progress.status === 'completed') return progress.completedAt !== null ? `Completed on ${dayText(progress.completedAt)}` : 'Completed';
  if (progress.delayed) return "Taking longer than expected · it's still being deleted";
  return `Processing · finished by ${dayText(progress.cleanupBy)}`;
}

/** The analytics provider's erasure: requested, and erased only once the provider says so. */
export function analyticsDetail(progress: DeletionProgress | null): string {
  const { requestedAt, completedAt } = progress?.analytics ?? { requestedAt: null, completedAt: null };
  if (completedAt !== null) return `Erased on ${dayText(completedAt)}`;
  if (requestedAt !== null) return "Erasure requested · the analytics provider hasn't confirmed it yet";
  return 'Erasure not requested yet';
}

export function AccountDeleted() {
  const { service } = useAccount();
  const [status, setStatus] = useState<DeletionStatus | null | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void service.deletion.status().then((answer) => live && setStatus(answer));
    return () => {
      live = false;
    };
  }, [service]);

  const progress = isProgress(status) ? status : null;
  const done = async () => {
    setBusy(true);
    try {
      await service.deletion.dismiss();
    } finally {
      setBusy(false);
    }
  };

  return (
    <FirstRunScreen title="Your account was deleted" lead={<DeletedIcon />}>
      <Body>{deletedBody(progress)}</Body>
      <Actions>
        <Button label="Done" stretch disabled={busy} onPress={() => void done()} />
      </Actions>
      <GroupLabel>DELETION STATUS</GroupLabel>
      <Group>
        <ListRow icon={CalendarClock} title="Deletion" detail={status === undefined ? 'Checking…' : deletionDetail(progress)} />
        <ListRow icon={ChartBar} title="Analytics data" detail={analyticsDetail(progress)} />
        <ListRow icon={Database} title="Backups" detail="Backups age out on their own schedule, set out in the privacy policy." />
        {progress?.providers === 'not-held' && (
          <ListRow icon={KeyRound} title="Apple or Google sign-in" detail="To remove Tableside there too, open your Apple ID or Google Account settings." />
        )}
      </Group>
      <GroupLabel>YOUR SUBSCRIPTION</GroupLabel>
      <BillingHelpRows />
      <SupportLinks />
    </FirstRunScreen>
  );
}

function DeletedIcon() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.icon}>
      <Trash2 color={palette.mutedForeground} size={30} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
});
