// TODO(spec 2 S2-23)

import { BACKUPS_DETAIL, type DeletionProgress, type DeletionStatus, PROVIDER_GRANT_DETAIL, analyticsDetail, deletionDetail } from '@tableside/account';
import { ChartBar, CalendarClock, Database, KeyRound, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { useLoaded } from '@/hooks/use-loaded';
import { Group, GroupLabel, ListRow } from '@/settings/SettingsParts';
import { palette, radius } from '@/theme/tokens';

import { dayText } from './account-text';
import { useAccount } from './AccountProvider';
import { BillingHelpRows } from './BillingHelp';
import { Actions, Body, FirstRunScreen, SupportLinks } from './FirstRunParts';

const isProgress = (status: DeletionStatus | null | undefined): status is DeletionProgress =>
  status?.status === 'processing' || status?.status === 'completed';

export function deletedBody(progress: DeletionProgress | null): string {
  const here = 'Nothing of it is left on this device.';
  if (!progress) return `Its data is being erased from Tableside. ${here}`;
  if (progress.status === 'completed' && progress.completedAt !== null) return `Its data was erased from Tableside on ${dayText(progress.completedAt)}. ${here}`;
  return `Its data is being erased from Tableside, by ${dayText(progress.cleanupBy)}. ${here}`;
}

export { analyticsDetail, deletionDetail };

export function AccountDeleted() {
  const { service } = useAccount();
  const status: DeletionStatus | null | undefined = useLoaded((accountService) => accountService.deletion.status(), service);
  const [busy, setBusy] = useState(false);

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
        <ListRow icon={Database} title="Backups" detail={BACKUPS_DETAIL} />
        {progress?.providers === 'not-held' && (
          <ListRow icon={KeyRound} title="Apple or Google sign-in" detail={PROVIDER_GRANT_DETAIL} />
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
