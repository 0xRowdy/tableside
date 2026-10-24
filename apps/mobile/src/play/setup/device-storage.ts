// The setup preferences file, in the app's document directory on this device.

import { File, Paths } from 'expo-file-system';

import type { SetupPreferencesStorage } from './preferences';

export const SETUP_PREFERENCES_FILE = 'setup-preferences.json';

export function createSetupStorage(): SetupPreferencesStorage {
  const file = new File(Paths.document, SETUP_PREFERENCES_FILE);
  return {
    read: async () => (file.exists ? file.text() : null),
    write: async (text) => {
      await file.write(text);
    },
  };
}
