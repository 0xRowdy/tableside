// Spec 1 Launch gates 5; #121; docs/development.md Responsiveness sampling
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const APP = join(__dirname, '..');
const PROBE = join(APP, 'src/responsiveness/probe.ts');

const plugin = require('../plugins/with-responsiveness-sampling') as {
  SAMPLING_MODULE: string;
  excludeFromPodfile(contents: string): string;
  excludeFromSettingsGradle(contents: string): string;
};

interface Babel {
  transformSync(code: string, options: object): { code?: string | null } | null;
}

const resolveFrom = (module: string, from: string) => require.resolve(module, { paths: [from] });
const packageDir = (module: string, from: string) => dirname(resolveFrom(`${module}/package.json`, from));

// docs/development.md Responsiveness sampling (store builds)
function productionTransform(file: string, flag: string | undefined): string {
  const expo = packageDir('expo', APP);
  const preset = packageDir('babel-preset-expo', expo);
  const babel = require(resolveFrom('@babel/core', preset)) as Babel;
  const metro = packageDir('metro', packageDir('@expo/metro-config', expo));
  const { constantFoldingPlugin } = require(resolveFrom('metro-transform-plugins', metro)) as { constantFoldingPlugin: object };
  const saved = process.env.EXPO_PUBLIC_RESPONSIVENESS_SAMPLING;
  try {
    if (flag === undefined) delete process.env.EXPO_PUBLIC_RESPONSIVENESS_SAMPLING;
    else process.env.EXPO_PUBLIC_RESPONSIVENESS_SAMPLING = flag;
    const transformed = babel.transformSync(readFileSync(file, 'utf8'), {
      filename: file,
      cwd: APP,
      babelrc: false,
      configFile: false,
      presets: [preset],
      caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, engine: 'hermes', projectRoot: APP },
      envName: 'production',
    });
    const folded = babel.transformSync(transformed?.code ?? '', { babelrc: false, configFile: false, plugins: [constantFoldingPlugin] });
    return folded?.code ?? '';
  } finally {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_RESPONSIVENESS_SAMPLING;
    else process.env.EXPO_PUBLIC_RESPONSIVENESS_SAMPLING = saved;
  }
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
    return /\.(ts|tsx|js)$/.test(name) ? [path] : [];
  });
}

describe('a build without the sampling flag', () => {
  it('drops the recorder from the bundle: the probe folds to null', () => {
    const store = productionTransform(PROBE, undefined);
    expect(store).toMatch(/exports\.sampling = null/);
    expect(store).not.toMatch(/require\(/);
    const sampling = productionTransform(PROBE, '1');
    expect(sampling).toMatch(/require\(['"]\.\/recorder['"]\)/);
  });

  it('reaches the recorder, and through it the native module, only from the probe', () => {
    const files = [...sourceFiles(join(APP, 'src')), join(APP, 'index.ts')];
    const importers = files
      .filter((file) => /responsiveness\/recorder|['"]\.\/recorder['"]|modules\/responsiveness-sampling|ResponsivenessSampling['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(APP, file));
    expect(importers.sort()).toEqual(['src/responsiveness/native-ports.ts', 'src/responsiveness/probe.ts', 'src/responsiveness/recorder.tsx']);
  });

  it('leaves the native module out of autolinking on both platforms', () => {
    const podfile = "target 'Tableside' do\n  use_expo_modules!\n  config = use_native_modules!(config_command)\nend\n";
    expect(plugin.excludeFromPodfile(podfile)).toContain(`  use_expo_modules!(exclude: ['${plugin.SAMPLING_MODULE}'])\n`);
    const settings = 'expoAutolinking.useExpoModules()\n';
    expect(plugin.excludeFromSettingsGradle(settings)).toBe(`expoAutolinking.exclude = ['${plugin.SAMPLING_MODULE}']\nexpoAutolinking.useExpoModules()\n`);
    expect(readdirSync(join(APP, 'modules'))).toContain(plugin.SAMPLING_MODULE);
  });

  it('fails loudly if the generated projects change shape', () => {
    expect(() => plugin.excludeFromPodfile("target 'Tableside' do\nend\n")).toThrow('use_expo_modules!');
    expect(() => plugin.excludeFromSettingsGradle('useExpoModules()\n')).toThrow('expoAutolinking.useExpoModules()');
  });
});
