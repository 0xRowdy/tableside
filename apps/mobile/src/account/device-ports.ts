import type { DevicePorts, DeviceSignal } from '@tableside/account';
import { AppState } from 'react-native';

const foreground: DeviceSignal<boolean> = {
  current: () => AppState.currentState === 'active',
  subscribe(listener) {
    let last = AppState.currentState === 'active';
    const subscription = AppState.addEventListener('change', (state) => {
      const next = state === 'active';
      if (next !== last) listener((last = next));
    });
    return () => subscription.remove();
  },
};

const online: DeviceSignal<boolean> = {
  current: () => true,
  subscribe: () => () => undefined,
};

export const appDevicePorts: DevicePorts = {
  foreground,
  online,
  every(milliseconds, run) {
    const timer = setInterval(run, milliseconds);
    return () => clearInterval(timer);
  },
  after(milliseconds, run) {
    const timer = setTimeout(run, milliseconds);
    return () => clearTimeout(timer);
  },
};
