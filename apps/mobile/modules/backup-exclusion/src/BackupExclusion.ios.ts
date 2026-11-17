import { requireNativeModule } from 'expo';

const native = requireNativeModule<{ excludeFromBackup(uri: string): Promise<void> }>('BackupExclusion');

export function excludeFromBackup(uri: string): Promise<void> {
  return native.excludeFromBackup(uri);
}
