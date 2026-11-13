// Spec 1 gate 9: every visual asset the app bundles has a provenance record
// that matches it byte for byte. Sounds have their own register (cue-assets).

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const APP = join(__dirname, '..');
const REPO = join(APP, '..', '..');
const ASSETS = join(APP, 'assets');
const register = JSON.parse(readFileSync(join(ASSETS, 'visual-provenance.json'), 'utf8')) as {
  records: { item: string; files: ({ path: string; sha256: string } | { module: string; sha256: string })[] }[];
};

const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const files = register.records.flatMap((record) => record.files);

/** Files under assets/, as repo-relative paths, leaving out the sounds and the register itself. */
function bundled(dir = ASSETS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'sounds' ? [] : bundled(path);
    return entry.name === 'visual-provenance.json' || entry.name.startsWith('.') ? [] : [relative(REPO, path).split(sep).join('/')];
  });
}

/** Font files the app imports from @expo-google-fonts, as register module ids. */
function bundledFonts(dir = join(APP, 'src')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return bundledFonts(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    return [...readFileSync(path, 'utf8').matchAll(/import\s*{([^}]*)}\s*from\s*'@expo-google-fonts\/([\w-]+)'/g)].flatMap(([, names = '', pkg]) =>
      names.split(',').map((name) => name.trim()).filter((name) => /^\w+_\d+\w+$/.test(name))
        .map((name) => `@expo-google-fonts/${pkg}/${name.slice(name.indexOf('_') + 1)}/${name}.ttf`),
    );
  });
}

describe('visual asset provenance', () => {
  it('has a record for every bundled visual asset, matching the file', () => {
    const recorded = new Map(files.flatMap((file) => ('path' in file ? [[file.path, file.sha256] as const] : [])));
    for (const path of bundled()) expect({ path, sha256: recorded.get(path) }).toEqual({ path, sha256: sha256(join(REPO, path)) });
  });

  it('has a record for every font the app imports', () => {
    const modules = new Set(files.flatMap((file) => ('module' in file ? [file.module] : [])));
    const fonts = bundledFonts();
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.filter((font) => !modules.has(font))).toEqual([]);
  });

  it('records only files that still exist, unchanged, including the bundled fonts', () => {
    for (const file of files) {
      const path = 'path' in file ? join(REPO, file.path) : require.resolve(file.module);
      expect({ file: 'path' in file ? file.path : file.module, sha256: sha256(path) }).toEqual({ file: 'path' in file ? file.path : file.module, sha256: file.sha256 });
    }
  });
});
