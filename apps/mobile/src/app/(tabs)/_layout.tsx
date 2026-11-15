import { Redirect } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { isRestricted, isSignedIn, useAccount, type AgeRestrictedGate } from '@/account/AccountProvider';
import { AgeRestricted } from '@/account/AgeRestricted';
import { DeletionScheduled, type DeletionScheduledGate } from '@/account/DeletionScheduled';
import { FeedbackProvider } from '@/feedback/FeedbackProvider';
import { TabBar, TabButton } from '@/navigation/TabBar';
import { TABS } from '@/navigation/tabs';
import { PracticeProvider, usePractice } from '@/practice/PracticeProvider';
import { palette } from '@/theme/tokens';

/**
 * The signed-in app: the six tabs, with practice on the account's own store.
 * First run comes before it: welcome, age (Create only), sign-in, then the
 * offline game choice. While the account's age eligibility isn't established,
 * or its deletion is scheduled, the restricted screen replaces the tabs (no tab
 * bar), under the same practice controller: the session suspends (at once, or
 * once a turn in progress finishes and is seen for an unresolved age) before
 * the screen changes.
 */
export default function TabsLayout() {
  const { gate, offlineGame } = useAccount();
  if (gate.state === 'recovery-needed' || gate.state === 'database-unavailable') return <Redirect href="/account-recovery" />;
  if (gate.state === 'signed-out') return <Redirect href="/signed-out" />;
  if (gate.state === 'revoked') return <Redirect href="/revoked" />;
  const restricted = isRestricted(gate);
  if (!restricted) {
    if (!isSignedIn(gate)) return <Redirect href="/welcome" />;
    if (offlineGame === undefined) return null;
    if (offlineGame === null) return <Redirect href="/offline-game" />;
  }
  return (
    // A new account session gets its own practice controller; the restricted states keep it.
    <PracticeProvider key={gate.accountId}>
      <TabsOrRestricted restricted={restricted ? gate : null} />
    </PracticeProvider>
  );
}

/** The tabs, or the restricted screen once an unfinished practice session has reached its suspension. */
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
