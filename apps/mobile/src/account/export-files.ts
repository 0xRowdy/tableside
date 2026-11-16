// Handing an export to the player (S2-21): the file is written to the app's
// own cache (exports/), then offered through the system share sheet, where
// they save or send it. Each account's copies stay in its own folder
// (exports/<account>/), so its permanent deletion (#104) erases every
// app-owned export copy of it, and none of another account's (spec 2, *Deletion*).

import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** A file to hand over: its name, media type and contents. */
export interface ExportFile {
  readonly name: string;
  readonly mimeType: 'application/zip' | 'application/json';
  readonly contents: Uint8Array | string;
}

/** The share step's port: the app account's, so screen tests substitute it. */
export interface ExportFiles {
  /** Writes the account's file and opens the share sheet; 'failed' when the file couldn't be written or sharing isn't available. */
  share(accountId: string, file: ExportFile): Promise<'shared' | 'failed'>;
  /** Erases every export copy the app holds of the account (its permanent deletion, #104). */
  clear(accountId: string): Promise<void>;
}

const UTIS: Readonly<Record<ExportFile['mimeType'], string>> = { 'application/zip': 'public.zip-archive', 'application/json': 'public.json' };

export const deviceExportFiles: ExportFiles = {
  async share(accountId, file) {
    try {
      if (!(await Sharing.isAvailableAsync())) return 'failed';
      const folder = new Directory(Paths.cache, 'exports', accountId);
      folder.create({ intermediates: true, idempotent: true });
      const copy = new File(folder, file.name);
      copy.create({ overwrite: true });
      copy.write(file.contents);
      await Sharing.shareAsync(copy.uri, { mimeType: file.mimeType, UTI: UTIS[file.mimeType], dialogTitle: file.name });
      return 'shared';
    } catch {
      return 'failed';
    }
  },
  async clear(accountId) {
    const folder = new Directory(Paths.cache, 'exports', accountId);
    if (folder.exists) folder.delete();
  },
};
