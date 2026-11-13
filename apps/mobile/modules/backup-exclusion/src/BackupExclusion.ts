// Android: nothing to do per directory. The app's backup rules
// (plugins/with-backup-exclusion.js) exclude the whole vault directory and
// SecureStore from Auto Backup and device transfer.
export async function excludeFromBackup(_uri: string): Promise<void> {}
