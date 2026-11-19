import { File, Paths } from 'expo-file-system';

import type { TextSizeStorage } from './text-size';

export const TEXT_SIZE_FILE = 'text-size.json';

export function createTextSizeStorage(): TextSizeStorage {
  const file = new File(Paths.document, TEXT_SIZE_FILE);
  return {
    read: async () => (file.exists ? file.text() : null),
    write: async (text) => {
      await file.write(text);
    },
  };
}
