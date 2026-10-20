import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildProblems, MODULE_PATH, REFERENCE_DIR } from '../scripts/blackjack-reference';
import { BLACKJACK_REFERENCE } from '../src/index';
import { REFERENCE_FILES } from '../src/blackjack/reference-files.generated';

// SHA-256 per file from reference-manifest.json at
// research/blackjack-coaching-validation@ae3776d (frozen_files).
const FROZEN: Record<string, string> = {
  'basic_S17_LS.csv': '77fd89fe6491380c15d077a1e58eea24739ea87ae7db89a8fac11b9c096e63d8',
  'basic_S17_noLS.csv': '8c9c38381e60bd11eecb8eed3c0e434efcfed246c5fc6fd9c04819382fca47f7',
  'basic_H17_LS.csv': 'ddcc77135aa6a0be5aeed62a71d052732a46324d5ea29cf76dd3eab55c96c36e',
  'basic_H17_noLS.csv': '8918f41bd80a34065ed771a255ee6d273efd4f22ee7fac7ccf2c262b04f7c745',
  'continuation_S17.csv': 'b9a8fface72b73cacbabc2e5d8ae2f637591671846f27bd6fbb92bdf2d00f915',
  'continuation_H17.csv': '7ebca8577e43f9e9003d8019928a5e991a666c25b0e124fc3ff9ec63876d0b32',
  'indices_S17_final.csv': '46dae4e25b3fa4d54370bdee6fa40252bf6176f6169b43eda1c547dcd1f10754',
  'indices_H17_final.csv': '38f20e116b5fbf9428823b6ba9d1cebbd9fab39221691dbf3e2c666c98a09719',
};

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

function copyOfReference(): { dir: string; module: string } {
  const root = mkdtempSync(join(tmpdir(), 'blackjack-reference-'));
  const dir = join(root, 'blackjack');
  cpSync(REFERENCE_DIR, dir, { recursive: true });
  const module = join(root, 'reference-files.generated.ts');
  cpSync(MODULE_PATH, module);
  return { dir, module };
}

describe('certified blackjack reference integrity (launch gate 2)', () => {
  it('ships exactly the frozen bytes of every reference file', () => {
    expect(Object.keys(REFERENCE_FILES).sort()).toEqual(Object.keys(FROZEN).sort());
    for (const [file, { sha256: recorded, text }] of Object.entries(REFERENCE_FILES)) {
      expect(sha256(text), file).toBe(FROZEN[file]);
      expect(recorded, file).toBe(FROZEN[file]);
      expect(BLACKJACK_REFERENCE.files[file as keyof typeof REFERENCE_FILES]).toBe(FROZEN[file]);
    }
  });

  it('passes the build check as committed', () => {
    expect(buildProblems()).toEqual([]);
  });

  it('fails the build check when a frozen file changes by one byte', () => {
    const { dir, module } = copyOfReference();
    const file = join(dir, 'indices_S17_final.csv');
    writeFileSync(file, readFileSync(file, 'utf8').replace('16 vs 10,hard,16,10,stand,hit,H,1', '16 vs 10,hard,16,10,stand,hit,H,0'));
    expect(buildProblems(dir, module)).toEqual([expect.stringMatching(/^indices_S17_final\.csv: SHA-256 \w+ does not match the manifest/)]);
  });

  it('fails the build check when the manifest itself is edited to match', () => {
    const { dir, module } = copyOfReference();
    const manifest = join(dir, 'reference-manifest.json');
    writeFileSync(manifest, readFileSync(manifest, 'utf8').replace(FROZEN['basic_S17_LS.csv'] ?? '', '0'.repeat(64)));
    expect(buildProblems(dir, module)).toEqual(['reference-manifest.json differs from the manifest frozen at ae3776d']);
  });

  it('fails the build check when the shipped module drifts from the files', () => {
    const { dir, module } = copyOfReference();
    writeFileSync(module, readFileSync(module, 'utf8').replace('S17_LS,hard,16,10,R', 'S17_LS,hard,16,10,H'));
    expect(buildProblems(dir, module)).toEqual([expect.stringContaining('does not embed the frozen files')]);
  });

  it('exits non-zero from the build script on a mismatch', () => {
    const script = fileURLToPath(new URL('../scripts/blackjack-reference.ts', import.meta.url));
    expect(() => execFileSync(process.execPath, ['--import', 'tsx', script, 'check'], { stdio: 'pipe' })).not.toThrow();
    expect(() => execFileSync(process.execPath, ['--import', 'tsx', script, 'nonsense'], { stdio: 'pipe' })).toThrow();
  });

  it('ships no research calculator code', () => {
    // The research's scripts (including the GPL-linked farmer_driver.cpp) are
    // listed in its manifest; none may appear anywhere in the product tree.
    const manifest = JSON.parse(readFileSync(join(REFERENCE_DIR, 'reference-manifest.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const researchScripts = new Set(Object.keys(manifest.scripts));
    const researchHashes = new Set(Object.values(manifest.scripts));
    expect(researchScripts).toContain('farmer_driver.cpp');

    const repo = fileURLToPath(new URL('../../../', import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.git', '.claude', 'ios', 'android'].includes(entry.name)) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (researchScripts.has(entry.name) || researchHashes.has(sha256(readFileSync(path)))) offenders.push(path);
      }
    };
    for (const top of ['apps', 'packages']) walk(join(repo, top));
    expect(offenders).toEqual([]);
    expect(readdirSync(REFERENCE_DIR).sort()).toEqual(['.gitattributes', 'reference-manifest.json', ...Object.keys(FROZEN)].sort());
  });
});
