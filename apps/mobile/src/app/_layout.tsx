import { Fraunces_400Regular } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountProvider } from '@/account/AccountProvider';
import { SetupPreferencesProvider } from '@/play/setup/SetupPreferencesProvider';
import { sampling } from '@/responsiveness/probe';
import { palette } from '@/theme/tokens';
import { TextSizeProvider, useTextSize } from '@/theme/type';

SplashScreen.preventAutoHideAsync();

let splashHidden = false;
const hideSplash = () => {
  if (splashHidden) return;
  splashHidden = true;
  void SplashScreen.hideAsync();
};

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: palette.background,
    card: palette.card,
    text: palette.foreground,
    border: palette.border,
    primary: palette.primary,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Fraunces_400Regular, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const ready = fontsLoaded || fontError !== null;

  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <TextSizeProvider>
          <TextSizeLoaded>
            <AccountProvider>
              <View style={styles.root} onLayout={hideSplash} onTouchStart={sampling?.touchStart} onTouchEnd={sampling?.touchEnd} onTouchCancel={sampling?.touchCancel}>
                <SetupPreferencesProvider>
                  <Slot />
                </SetupPreferencesProvider>
                {sampling && <sampling.Badge />}
              </View>
            </AccountProvider>
          </TextSizeLoaded>
        </TextSizeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function TextSizeLoaded({ children }: { children: ReactNode }) {
  return useTextSize().loaded ? children : null;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
