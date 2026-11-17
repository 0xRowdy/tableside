// Spec 2 S2-19

import { instant } from '../values';

import type { ServiceContext } from './context';
import type { DeviceSignOutResult, Devices } from './types';

export function createDevices(ctx: ServiceContext): Devices {
  const revokeDevices = async (body: { readonly device: string } | { readonly others: true }): Promise<DeviceSignOutResult> => {
    const answer = await ctx.actAsPlayer('revoke-devices', body);
    if (answer?.code === 200 && answer.status === 'signed-out') {
      const { devices: count, email } = answer.body ?? {};
      return { status: 'signed-out', devices: typeof count === 'number' ? count : 0, email: typeof email === 'string' ? email : null };
    }
    if (answer?.code === 403 && answer.status === 'fresh-authentication-required') return { status: answer.status };
    if (answer?.code === 404 && answer.status === 'not-found') return { status: answer.status };
    return { status: 'failed' };
  };

  return {
    async list() {
      const data = await ctx.operation('devices_v1');
      if (!Array.isArray(data)) return null;
      return (data as { id?: unknown; platform?: unknown; label?: unknown; last_active_at?: unknown; this_device?: unknown }[]).flatMap((entry) =>
        typeof entry.id === 'string'
          ? [
              {
                id: entry.id,
                platform: entry.platform === 'ios' || entry.platform === 'android' || entry.platform === 'web' ? entry.platform : null,
                label: typeof entry.label === 'string' ? entry.label : null,
                lastActiveAt: instant(entry.last_active_at),
                thisDevice: entry.this_device === true,
              },
            ]
          : [],
      );
    },
    signOut: (id) => revokeDevices({ device: id }),
    signOutOthers: () => revokeDevices({ others: true }),
  };
}
