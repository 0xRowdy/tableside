// What the device tells the Account service about itself, for synchronization
// (packages/account/src/sync/session.ts): whether the app is in the
// foreground, whether it has a connection, and timers.

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

/**
 * The app has no connectivity signal yet, so it always reads as connected: a
 * request made offline fails and backs off like any other failure, and the
 * foreground and 60-second triggers still reconcile. A reconnection trigger
 * needs a connectivity module in the build.
 */
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
