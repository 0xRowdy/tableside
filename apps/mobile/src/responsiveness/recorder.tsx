// Spec 1 Launch gates 5; #121; docs/development.md Responsiveness sampling
import * as Device from 'expo-device';
import * as Sharing from 'expo-sharing';
import { useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, palette, radius, space } from '@/theme/tokens';
import { typeScale } from '@/theme/type';

import { responsivenessSampling, type ResponsivenessSamplingNative } from '../../modules/responsiveness-sampling';
import { nativeTiming } from './native-ports';
import { createSampler, type Sampler } from './sampler';
import type { DeviceInfo } from './samples';

// docs/development.md Responsiveness sampling (one clock)
export const CLOCK_TOLERANCE_MS = 5;

export interface SamplingMode extends Sampler {
  readonly Badge: () => React.JSX.Element;
}

interface Status {
  readonly samples: number;
  readonly problem: string | null;
}

export function clockProblem(native: Pick<ResponsivenessSamplingNative, 'now'>, jsNow: () => number): string | null {
  const before = jsNow();
  const nativeNow = native.now();
  const after = jsNow();
  if (nativeNow >= before - CLOCK_TOLERANCE_MS && nativeNow <= after + CLOCK_TOLERANCE_MS) return null;
  return `Sampling off: native clock is ${Math.round(nativeNow - after)} ms from the touch clock`;
}

export function samplingMode(native: ResponsivenessSamplingNative = responsivenessSampling()): SamplingMode {
  let status: Status = { samples: 0, problem: clockProblem(native, () => performance.now()) };
  const listeners = new Set<() => void>();
  const update = (next: Status) => {
    status = next;
    for (const listener of listeners) listener();
  };
  const device: DeviceInfo = {
    model: Device.modelName ?? 'unknown',
    os: Platform.OS === 'ios' ? 'iOS' : 'Android',
    osVersion: Device.osVersion ?? 'unknown',
    build: native.build(),
    abi: native.abi(),
  };
  const sampler = createSampler({
    device,
    ...nativeTiming(native),
    record(sample) {
      if (status.problem) return;
      native.append(`${JSON.stringify(sample)}\n`).then(
        () => update({ ...status, samples: status.samples + 1 }),
        () => update({ ...status, problem: 'Sampling off: a sample could not be saved' }),
      );
    },
  });

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };

  function Badge() {
    const { samples, problem } = useSyncExternalStore(subscribe, () => status);
    const insets = useSafeAreaInsets();
    const share = () => void Sharing.shareAsync(native.exportUri(), { mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle: 'Responsiveness samples' });
    return (
      <View pointerEvents="box-none" style={[styles.badge, { top: insets.top + space[1], right: insets.right + space[2] }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Share ${samples} responsiveness samples`} onPress={share} style={styles.pill}>
          <Text style={[styles.text, problem !== null && styles.problem]}>{problem ?? `Samples ${samples} · Share`}</Text>
        </Pressable>
      </View>
    );
  }

  return { ...sampler, Badge };
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', zIndex: 1000 },
  pill: { minHeight: 32, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: palette.secondary, opacity: 0.85 },
  text: { fontFamily: fonts.uiBold, ...typeScale('standard').label, color: palette.foreground },
  problem: { color: palette.destructive },
});
