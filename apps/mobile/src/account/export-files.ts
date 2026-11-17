// Spec 2 S2-21

import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface ExportFile {
  readonly name: string;
  readonly mimeType: 'application/zip' | 'application/json';
  readonly contents: Uint8Array | string;
}

export interface ExportFiles {
  share(accountId: string, file: ExportFile): Promise<'shared' | 'failed'>;
  // #104
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
