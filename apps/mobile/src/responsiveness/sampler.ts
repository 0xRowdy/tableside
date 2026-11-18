// Spec 1 Launch gates 5; #121; docs/development.md Responsiveness sampling

import { INSURANCE_TARGET, type Command, type GameId } from '@tableside/engine';

import type { ActivityStore, StoredActivity } from '@/practice/store';

import { COLD_LAUNCH, type DeviceInfo, type Measure, type ResponsivenessSample } from './samples';

export const CLAIM_MS = 1000;

export interface SamplerPorts {
  readonly device: DeviceInfo;
  // docs/development.md Responsiveness sampling (one clock)
  now(): number;
  afterCommit(run: () => void): void;
  nextFrame(): Promise<number>;
  processStart(): number | null;
  record(sample: ResponsivenessSample): void;
}

export interface TouchLike {
  readonly nativeEvent: { readonly timestamp: number };
}

export interface Sampler {
  touchStart(event: TouchLike): void;
  touchEnd(event: TouchLike): void;
  // docs/development.md Responsiveness sampling (what is measured)
  action<T>(game: GameId, family: string, run: () => Promise<T>, committed: (result: T) => boolean): Promise<T>;
  practiceStore<S extends ActivityStore>(store: S): S;
  launchUsable(): void;
}

interface Touch {
  readonly start: number;
  readonly acknowledged: Promise<number>;
  end: number | null;
  claimed: boolean;
}

// Spec 1 Launch gates 5 (long work tested separately)
export function practiceFamily(command: Command): string | null {
  switch (command.kind) {
    case 'place-wager':
      if (command.target === INSURANCE_TARGET) return 'insurance';
      return command.amount === '0' ? 'remove-wager' : 'place-wager';
    case 'play':
      return `play:${command.action}`;
    case 'begin-turn':
    case 'set-working':
    case 'rebuy':
    case 'retry-correction':
    case 'override-correction':
    case 'restart-cycle':
    case 'collect-instead':
    case 'stop-strategy':
      return command.kind;
    case 'settle-turn':
    case 'request-stop':
    case 'advance-final-settlement':
    case 'advance-strategy-settlement':
      return null;
  }
}

export function createSampler(ports: SamplerPorts): Sampler {
  let touch: Touch | null = null;
  let launched = false;
  const games = new Map<string, GameId>();

  const nextFrameAfterCommit = () => new Promise<number>((resolve, reject) => ports.afterCommit(() => void ports.nextFrame().then(resolve, reject)));

  const record = (measure: Measure, game: GameId | null, family: string, start: number, end: number) =>
    ports.record({ version: 1, device: ports.device, measure, game, family, start, end, ms: end - start });

  const claim = (): Touch | null => {
    const claimed = touch;
    if (!claimed || claimed.claimed || claimed.end === null || ports.now() - claimed.end > CLAIM_MS) return null;
    claimed.claimed = true;
    return claimed;
  };

  const remember = <A extends StoredActivity | null>(activity: A): A => {
    if (activity) games.set(activity.activityId, activity.specification.game);
    return activity;
  };

  const sampler: Sampler = {
    touchStart(event) {
      touch = { start: event.nativeEvent.timestamp, acknowledged: nextFrameAfterCommit(), end: null, claimed: false };
      touch.acknowledged.catch(() => undefined);
    },
    touchEnd(event) {
      if (touch && touch.end === null) touch.end = event.nativeEvent.timestamp;
    },
    async action(game, family, run, committed) {
      const claimed = claim();
      if (claimed) void claimed.acknowledged.then((frame) => record('acknowledgement', game, family, claimed.start, frame), () => undefined);
      const result = await run();
      if (claimed && claimed.end !== null && committed(result)) {
        const end = claimed.end;
        void nextFrameAfterCommit().then((frame) => record('completion', game, family, end, frame), () => undefined);
      }
      return result;
    },
    practiceStore(store) {
      return new Proxy(store, {
        get(target, property) {
          const value: unknown = Reflect.get(target, property);
          if (typeof value !== 'function') return value;
          if (property === 'commitTransition') {
            return (commit: Parameters<ActivityStore['commitTransition']>[0]) => {
              const game = games.get(commit.activityId);
              const family = practiceFamily(JSON.parse(commit.receipt.command) as Command);
              const run = () => target.commitTransition(commit);
              if (!game || !family) return run();
              return sampler.action(game, family, run, (outcome) => outcome.status === 'committed');
            };
          }
          if (property === 'createActivity' || property === 'load' || property === 'findUnfinished') {
            return async (...args: unknown[]) => remember(await (value as (...a: unknown[]) => Promise<StoredActivity | null>).apply(target, args));
          }
          return (value as (...a: unknown[]) => unknown).bind(target);
        },
      });
    },
    launchUsable() {
      if (launched) return;
      launched = true;
      const start = ports.processStart();
      if (start === null) return;
      void nextFrameAfterCommit().then((frame) => record('cold-launch', null, COLD_LAUNCH, start, frame), () => undefined);
    },
  };
  return sampler;
}
