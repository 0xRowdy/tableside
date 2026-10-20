// Runs the engine suite inside the app on an iOS simulator or Android emulator.
// The app is built in Release, so the suite runs on the same bundled Hermes
// bytecode a store build ships, and posts its report back over HTTP.
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, openSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

import { MOBILE_APP, REPO_ROOT } from './paths';
import type { Report } from './portable';

const PORT = 8099;
const BUILD_TIMEOUT_MS = 45 * 60_000;
const REPORT_TIMEOUT_AFTER_LAUNCH_MS = 3 * 60_000;

// Each run bundles its own report path, so a harness app left running from an
// earlier run can't deliver a report for this one.
const RUN_ID = randomUUID();
const REPORT_PATH = `/report/${RUN_ID}`;

const harnessEnv = {
  ...process.env,
  // Bundle the harness entry instead of the app (inlined at bundle time).
  EXPO_PUBLIC_ENGINE_HARNESS: '1',
  EXPO_PUBLIC_ENGINE_HARNESS_URL: `http://127.0.0.1:${PORT}${REPORT_PATH}`,
  // Prebuild applies the harness-only config plugin.
  ENGINE_HARNESS: '1',
  // Non-interactive Expo CLI.
  CI: '1',
};

export async function runDeviceLeg(platform: 'ios' | 'android'): Promise<Report> {
  const reports = receiveReports();
  try {
    if (platform === 'ios') {
      const udid = bootedIosSimulator();
      log(`iOS: building Release harness for simulator ${udid}`);
      await run('pnpm', ['exec', 'expo', 'run:ios', '--configuration', 'Release', '--no-bundler', '--device', udid]);
    } else {
      await ensureAndroidDevice();
      execFileSync('adb', ['reverse', `tcp:${PORT}`, `tcp:${PORT}`]);
      log('Android: generating native project with the harness plugin');
      await run('pnpm', ['exec', 'expo', 'prebuild', '--platform', 'android', '--no-install']);
      log('Android: building Release harness');
      // Gradle's bundle task ignores environment variables, so it would reuse an
      // app bundle here, and later reuse this harness bundle in an app build.
      discardAndroidJsBundle();
      try {
        await run('pnpm', ['exec', 'expo', 'run:android', '--variant', 'release', '--no-bundler']);
      } finally {
        discardAndroidJsBundle();
      }
    }
    log(`waiting for the ${platform} report`);
    return await withTimeout(reports.next, REPORT_TIMEOUT_AFTER_LAUNCH_MS, `no report from ${platform}`);
  } finally {
    reports.close();
  }
}

function discardAndroidJsBundle(): void {
  for (const dir of ['generated/assets/react', 'generated/sourcemaps/react']) {
    rmSync(path.join(MOBILE_APP, 'android/app/build', dir), { recursive: true, force: true });
  }
}

function receiveReports() {
  let deliver: (report: Report) => void = () => {};
  const next = new Promise<Report>((resolve) => (deliver = resolve));
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== REPORT_PATH) {
      response.writeHead(404).end();
      return;
    }
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => (body += chunk));
    request.on('end', () => {
      response.writeHead(204).end();
      deliver(JSON.parse(body) as Report);
    });
  });
  server.listen(PORT, '127.0.0.1');
  return { next, close: () => server.close() };
}

function bootedIosSimulator(): string {
  const list = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { encoding: 'utf8' })) as {
    devices: Record<string, { udid: string; name: string; state: string }[]>;
  };
  const devices = Object.values(list.devices).flat();
  const booted = devices.find((d) => d.state === 'Booted');
  if (booted) return booted.udid;
  const iphone = devices.find((d) => d.name.startsWith('iPhone'));
  if (!iphone) throw new Error('no iOS simulator available; create one in Xcode');
  execFileSync('xcrun', ['simctl', 'boot', iphone.udid]);
  return iphone.udid;
}

async function ensureAndroidDevice(): Promise<void> {
  if (androidDevices().length > 0) return;
  const [avd] = execFileSync('emulator', ['-list-avds'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  if (!avd) throw new Error('no Android device or emulator; create an AVD in Android Studio');
  const logFile = path.join(REPO_ROOT, 'harness-reports', 'emulator.log');
  mkdirSync(path.dirname(logFile), { recursive: true });
  log(`Android: starting emulator ${avd} (output in ${path.relative(process.cwd(), logFile)})`);
  const output = openSync(logFile, 'w');
  const emulator = spawn('emulator', ['-avd', avd, '-no-snapshot-save'], { detached: true, stdio: ['ignore', output, output] });
  let exited: number | null = null;
  emulator.on('exit', (code) => (exited = code ?? -1));
  emulator.unref();

  const deadline = Date.now() + 5 * 60_000;
  while (!isBooted()) {
    if (exited !== null) throw new Error(`Android emulator exited with ${exited}; see ${logFile}`);
    if (Date.now() > deadline) throw new Error('Android emulator did not finish booting');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

function isBooted(): boolean {
  if (androidDevices().length === 0) return false;
  try {
    return execFileSync('adb', ['shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf8', stdio: 'pipe' }).trim() === '1';
  } catch {
    return false;
  }
}

function androidDevices(): string[] {
  return execFileSync('adb', ['devices'], { encoding: 'utf8' })
    .split('\n')
    .slice(1)
    .filter((line) => line.endsWith('\tdevice'));
}

function run(command: string, args: string[]): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, { cwd: MOBILE_APP, env: harnessEnv, stdio: 'inherit' });
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))));
    }),
    BUILD_TIMEOUT_MS,
    `${command} ${args.join(' ')} timed out`,
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(message)), ms)));
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function log(message: string): void {
  console.log(`[harness] ${message}`);
}
