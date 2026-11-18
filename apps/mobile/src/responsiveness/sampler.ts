// Spec 1 Launch gates 5; #121; docs/development.md Responsiveness sampling

import { INSURANCE_TARGET, type Command, type GameId } from '@tableside/engine';

import type { ActivityStore, StoredActivity, TransitionCommit } from '@/practice/store';

import { COLD_LAUNCH, type DeviceInfo, type Measure, type ResponsivenessSample } from './samples';

export const CLAIM_MS = 1000;
export const HOLD_MS = 10_000;

// docs/development.md Responsiveness sampling
export interface SamplerPorts {
  readonly device: DeviceInfo;
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
  touchCancel(): void;
  // docs/development.md Responsiveness sampling
  action<T>(game: GameId, family: string, run: () => Promise<T>, committed: (result: T) => boolean): Promise<T>;
  practiceStore(store: ActivityStore): ActivityStore;
  launchUsable(): void;
}

interface Touch {
  readonly start: number;
  readonly acknowledged: Promise<number>;
  end: number | null;
  claimed: boolean;
}

// Spec 1 Launch gates 5
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
  let touched = false;
  let launched = false;
  const games = new Map<string, GameId>();

  const nextFrameAfterCommit = () => new Promise<number>((resolve, reject) => ports.afterCommit(() => void ports.nextFrame().then(resolve, reject)));

  const record = (measure: Measure, game: GameId | null, family: string, start: number, end: number) =>
    ports.record({ version: 1, device: ports.device, measure, game, family, start, end, ms: end - start });

  const recordAt = (frame: Promise<number>, measure: Measure, game: GameId | null, family: string, start: number) =>
    void frame.then((end) => record(measure, game, family, start, end), () => undefined);

  // docs/development.md Responsiveness sampling (touch order)
  const claim = (): Touch | null => {
    const claimed = touch;
    if (!claimed || claimed.claimed) return null;
    if (claimed.end === null ? ports.now() - claimed.start > HOLD_MS : ports.now() - claimed.end > CLAIM_MS) return null;
    claimed.claimed = true;
    return claimed;
  };

  const remember = <A extends StoredActivity | null>(activity: A): A => {
    if (activity) games.set(activity.activityId, activity.specification.game);
    return activity;
  };

  const action: Sampler['action'] = async (game, family, run, committed) => {
    const claimed = claim();
    if (claimed) recordAt(claimed.acknowledged, 'acknowledgment', game, family, claimed.start);
    const result = await run();
    if (claimed && claimed.end !== null && committed(result)) recordAt(nextFrameAfterCommit(), 'completion', game, family, claimed.end);
    return result;
  };

  const commitTransition = (store: ActivityStore, commit: TransitionCommit) => {
    const game = games.get(commit.activityId);
    const family = practiceFamily(JSON.parse(commit.receipt.command) as Command);
    const run = () => store.commitTransition(commit);
    if (!game || !family || commit.facts.some((fact) => fact.kind === 'illegal-action')) return run();
    return action(game, family, run, (outcome) => outcome.status === 'committed');
  };

  return {
    touchStart(event) {
      touched = true;
      touch = { start: event.nativeEvent.timestamp, acknowledged: nextFrameAfterCommit(), end: null, claimed: false };
      touch.acknowledged.catch(() => undefined);
    },
    touchEnd(event) {
      if (touch && touch.end === null) touch.end = event.nativeEvent.timestamp;
    },
    touchCancel() {
      if (touch) touch.claimed = true;
    },
    action,
    practiceStore(store) {
      return {
        createActivity: async (activity) => remember(await store.createActivity(activity)),
        load: async (activityId) => remember(await store.load(activityId)),
        findUnfinished: async () => remember(await store.findUnfinished()),
        commitTransition: (commit) => commitTransition(store, commit),
        recordEffects: (activityId, effects) => store.recordEffects(activityId, effects),
        readEffects: (activityId) => store.readEffects(activityId),
        readTransitions: (activityId) => store.readTransitions(activityId),
        readReceipt: (activityId, commandId) => store.readReceipt(activityId, commandId),
        complete: (completed) => store.complete(completed),
        readOutgoing: () => store.readOutgoing(),
        markIncomplete: async (activityId, reason) => remember(await store.markIncomplete(activityId, reason)),
      };
    },
    // docs/development.md Responsiveness sampling (cold launch)
    launchUsable() {
      if (launched) return;
      launched = true;
      const start = ports.processStart();
      if (start === null || touched) return;
      recordAt(nextFrameAfterCommit(), 'cold-launch', null, COLD_LAUNCH, start);
    },
  };
}
