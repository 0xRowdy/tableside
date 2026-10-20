// Runs the engine's cross-runtime suite on this device's Hermes and posts the
// report to the harness on the development machine. See
// docs/cross-runtime-harness.md.
import { runSuite, type Report, type Runtime } from '@tableside/harness';
import { engineSuite } from '@tableside/engine/test-suite';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/tokens';

// Set by the harness (packages/harness/src/devices.ts) when it builds the app.
const REPORT_URL = process.env.EXPO_PUBLIC_ENGINE_HARNESS_URL;

declare const HermesInternal: { getRuntimeProperties?: () => Record<string, string | undefined> } | undefined;

function currentRuntime(): Runtime {
  const hermes = typeof HermesInternal === 'undefined' ? undefined : HermesInternal;
  const hermesVersion = hermes?.getRuntimeProperties?.()['OSS Release Version'];
  return {
    jsEngine: hermes ? 'hermes' : 'other',
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'other',
    version: `Hermes ${hermesVersion ?? 'unknown'} / ${Platform.OS} ${Platform.Version}`,
  };
}

async function send(report: Report): Promise<void> {
  if (!REPORT_URL) throw new Error('EXPO_PUBLIC_ENGINE_HARNESS_URL is not set; run the suite through `pnpm harness`');
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const response = await fetch(REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw lastError;
}

export function HarnessApp() {
  // The suite is synchronous, so it runs once, during the first render.
  const [{ report, summary }] = useState(() => {
    const result = runSuite(engineSuite, currentRuntime());
    const failed = result.cases.filter((c) => c.status === 'fail').length;
    return { report: result, summary: `${result.cases.length - failed}/${result.cases.length} cases passed on ${result.runtime.version}` };
  });
  const [delivery, setDelivery] = useState('Sending report…');

  useEffect(() => {
    send(report).then(
      () => setDelivery('Report sent.'),
      (error: unknown) => setDelivery(`Could not send report to ${REPORT_URL}: ${String(error)}`),
    );
  }, [report]);

  const status = `${summary}\n${delivery}`;
  return (
    <View style={styles.root}>
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: palette.background },
  text: { color: palette.foreground, fontSize: 16, lineHeight: 24 },
});
