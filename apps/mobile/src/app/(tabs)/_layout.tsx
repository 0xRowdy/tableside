import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { TabBar, TabButton } from '@/navigation/TabBar';
import { TABS } from '@/navigation/tabs';
import { palette } from '@/theme/tokens';

export default function TabsLayout() {
  return (
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
});
