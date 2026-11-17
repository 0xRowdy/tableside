import { Fraunces_400Regular } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountProvider } from '@/account/AccountProvider';
import { SetupPreferencesProvider } from '@/play/setup/SetupPreferencesProvider';
import { palette } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

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
  const [fontsLoaded, fontError] = useFonts({ Fraunces_400Regular, Inter_400Regular, Inter_500Medium, Inter_700Bold });
  const ready = fontsLoaded || fontError !== null;

  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <AccountProvider>
          <HideSplash />
          <SetupPreferencesProvider>
            <Slot />
          </SetupPreferencesProvider>
        </AccountProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function HideSplash() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return null;
}
