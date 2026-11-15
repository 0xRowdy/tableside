import { Redirect } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { isAgeRestricted, isSignedIn, useAccount } from '@/account/AccountProvider';
import { AgeRestricted } from '@/account/AgeRestricted';
import { FeedbackProvider } from '@/feedback/FeedbackProvider';
import { TabBar, TabButton } from '@/navigation/TabBar';
import { TABS } from '@/navigation/tabs';
import { PracticeProvider } from '@/practice/PracticeProvider';
import { palette } from '@/theme/tokens';

/**
 * The signed-in app: the six tabs, with practice on the account's own store.
 * First run comes before it: welcome, age (Create only), sign-in, then the
 * offline game choice. While the account's age eligibility isn't established,
 * the restricted screen replaces the tabs (no tab bar), under the same
 * practice controller, so a turn in progress can finish before it suspends.
 */
export default function TabsLayout() {
  const { gate, offlineGame } = useAccount();
  if (gate.state === 'recovery-needed' || gate.state === 'database-unavailable') return <Redirect href="/account-recovery" />;
  const restricted = isAgeRestricted(gate);
  if (!restricted) {
    if (!isSignedIn(gate)) return <Redirect href="/welcome" />;
    if (offlineGame === undefined) return null;
    if (offlineGame === null) return <Redirect href="/offline-game" />;
  }
  return (
    // A new account session gets its own practice controller; the gate's age states keep it.
    <PracticeProvider key={gate.accountId}>
      {restricted ? (
        <AgeRestricted gate={gate} />
      ) : (
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
      )}
    </PracticeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
});
