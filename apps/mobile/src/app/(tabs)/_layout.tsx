import { Redirect } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { isRestricted, opensOrdinaryAccess, useAccount, type AgeRestrictedGate } from '@/account/AccountProvider';
import { AgeRestricted } from '@/account/AgeRestricted';
import { DeletionScheduled, type DeletionScheduledGate } from '@/account/DeletionScheduled';
import { FeedbackProvider } from '@/feedback/FeedbackProvider';
import { TabBar, TabButton } from '@/navigation/TabBar';
import { TABS } from '@/navigation/tabs';
import { PracticeProvider, usePractice } from '@/practice/PracticeProvider';
import { palette } from '@/theme/tokens';
import { TrainingProvider } from '@/training/TrainingProvider';

export default function TabsLayout() {
  const { gate, offlineGame } = useAccount();
  if (gate.state === 'recovery-needed' || gate.state === 'database-unavailable') return <Redirect href="/account-recovery" />;
  if (gate.state === 'signed-out') return <Redirect href="/signed-out" />;
  if (gate.state === 'revoked') return <Redirect href="/revoked" />;
  if (gate.state === 'deleted') return <Redirect href="/deleted" />;
  const restricted = isRestricted(gate);
  if (!restricted) {
    if (!opensOrdinaryAccess(gate)) return <Redirect href="/welcome" />;
    if (offlineGame === undefined) return null;
    if (offlineGame === null) return <Redirect href="/offline-game" />;
  }
  return (
    <PracticeProvider key={gate.accountId}>
      <TrainingProvider>
        <TabsOrRestricted restricted={restricted ? gate : null} />
      </TrainingProvider>
    </PracticeProvider>
  );
}

function TabsOrRestricted({ restricted }: { restricted: AgeRestrictedGate | DeletionScheduledGate | null }) {
  const { snapshot } = usePractice();
  const turnFinishing = snapshot.status === 'active' && snapshot.suspension?.reached !== true;
  if (restricted && !turnFinishing) {
    return restricted.state === 'deletion-scheduled' ? <DeletionScheduled gate={restricted} /> : <AgeRestricted gate={restricted} />;
  }
  return (
    <FeedbackProvider>
      <Tabs style={styles.root}>
        <TabSlot />
        <TabList asChild>
          <TabBar>
            {TABS.map((tab) => (
              <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
                <TabButton tab={tab} />
              </TabTrigger>
            ))}
          </TabBar>
        </TabList>
      </Tabs>
    </FeedbackProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
});
