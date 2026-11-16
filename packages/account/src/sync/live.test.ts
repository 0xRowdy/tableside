// Live updates over a scripted channel: who holds the connection, and when it
// is left or joined again. Seam 2 covers the same rules against Realtime.

import { describe, expect, it } from 'vitest';

import { type LiveChannel, type LiveChannelStatus, LiveUpdates } from './live';

/** A channel the test drives: it reports joins, claims and announcements when told. */
class ScriptedChannel implements LiveChannel {
  handlers: Parameters<LiveChannel['join']>[0] | null = null;
  left = false;
  private resolveClaim: ((claim: number) => void) | null = null;

  join(handlers: Parameters<LiveChannel['join']>[0]) {
    this.handlers = handlers;
  }
  claim() {
    return new Promise<number>((resolve) => (this.resolveClaim = resolve));
  }
  leave() {
    this.left = true;
  }
  status(status: LiveChannelStatus) {
    this.handlers!.status(status);
  }
  async answerClaim(claim: number) {
    this.resolveClaim!(claim);
    await Promise.resolve();
  }
}

function live() {
  const channels: ScriptedChannel[] = [];
  let hints = 0;
  const updates = new LiveUpdates(
    () => {
      const channel = new ScriptedChannel();
      channels.push(channel);
      return channel;
    },
    () => hints++,
  );
  return { updates, channels, hints: () => hints };
}

describe('live updates', () => {
  it('hold the connection once joined and claimed, and pass hints on', async () => {
    const { updates, channels, hints } = live();
    updates.start();
    expect(updates.live).toBe(false);
    channels[0]!.status('joined');
    await channels[0]!.answerClaim(3);
    expect(updates.live).toBe(true);

    channels[0]!.handlers!.hint();
    expect(hints()).toBe(1);
  });

  it('leave when a newer claim is announced, even one announced before their own claim was answered', async () => {
    const { updates, channels } = live();
    updates.start();
    channels[0]!.status('joined');
    await channels[0]!.answerClaim(3);
    channels[0]!.handlers!.holder(3);
    expect(updates.live).toBe(true);
    channels[0]!.handlers!.holder(4);
    expect([updates.live, channels[0]!.left]).toEqual([false, true]);

    updates.start();
    channels[1]!.status('joined');
    channels[1]!.handlers!.holder(9);
    await channels[1]!.answerClaim(8);
    expect([updates.live, channels[1]!.left]).toEqual([false, true]);
  });

  it('leave a refused connection, and ignore anything the left connection still delivers', async () => {
    const { updates, channels, hints } = live();
    updates.start();
    channels[0]!.status('closed');
    expect([updates.live, channels[0]!.left]).toEqual([false, true]);
    channels[0]!.handlers!.hint();
    expect(hints()).toBe(0);
  });

  it('join again with new credentials, and never again once the account session has ended', async () => {
    const { updates, channels } = live();
    updates.start();
    channels[0]!.status('joined');
    await channels[0]!.answerClaim(1);

    updates.renew();
    expect(channels[0]!.left).toBe(true);
    expect(channels).toHaveLength(2);

    updates.end();
    expect(channels[1]!.left).toBe(true);
    updates.start();
    updates.renew();
    expect(channels).toHaveLength(2);
  });
});
