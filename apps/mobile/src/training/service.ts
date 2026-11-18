// Spec 3 Modules › Training service; Training service interface; #158, #132, #133, #134, #137

import {
  BLACKJACK_LIMITS,
  BLACKJACK_PRESETS,
  blackjackPreset,
  CHALLENGE_CONTENT,
  DEFAULT_TABLE_SETUP,
  tableSetup,
  type TableOptions,
  HINTS,
  LESSONS,
  type Hint,
  type HintId,
  type Lesson,
} from '@tableside/definitions';
import {
  CHALLENGE_CATEGORIES,
  CHALLENGE_PACINGS,
  CHALLENGE_VARIANTS,
  MAX_CHECKPOINT_INTERVAL,
  MAX_OTHER_PLAYERS,
  pacingApplies,
  PENETRATIONS,
  hasExactKeys,
  playFundingProblems,
  type ChallengeAttemptRecord,
  type ChallengeCategory,
  type ChallengeGroupKey,
  type ChallengePacing,
  type ChallengeVariant,
  type PlayFunding,
  type PlayFundingProblem,
} from '@tableside/engine';

import type { LifecycleEvent } from '../practice/adapters';
import type { TrainingAdapters } from './adapters';
import type { ChallengeAllowance } from './allowance';
import { ChallengeController, type AttemptSnapshot, type DirectSuspendCause, type LearnerCommand, type PauseCause, type StartProblem } from './controller';
import { DeviceLearningPreferences, type LearningPreferences } from './learning-preferences';
import { attemptEarned, milestoneCandidates, progressProjection, readinessOutcome, type AttemptEarned, type Progress, type ProgressAttempt, type ProgressMilestone } from './progress';
import { milestoneIdentity, milestoneSlot, type ReadinessMilestoneRecord } from './readiness-milestone';
import { stepCount, TrainingLessons, type HeldLessonAccess, type InstructionWithheld, type LessonAccess, type LessonEntry, type LessonView } from './lesson-service';

export interface CatalogEntry {
  readonly category: ChallengeCategory;
  readonly ready: readonly ChallengeVariant[];
  // Spec 3 Attempt lifecycle › Automatic pacing; #136
  readonly pacings: readonly ChallengePacing[];
}

export interface ChallengeSetup {
  readonly category: ChallengeCategory;
  readonly variant: ChallengeVariant;
  // Spec 3 Attempt lifecycle › Performance timer; #135
  readonly timed?: boolean;
  // Spec 3 Attempt lifecycle › Automatic pacing; #136
  readonly pacing?: ChallengePacing;
  // Spec 3 User stories 27
  readonly table?: TableOptions;
}

export type { TableOptions };

export type SetupDiagnostic =
  | { readonly field: 'category' | 'variant' | 'pacing'; readonly problem: 'unknown' | 'not-ready' }
  | { readonly field: 'table'; readonly problem: 'invalid' }
  // Spec 3 Play challenge funding › Starting balance; S3-02 Al6Pw; #139
  | PlayFundingProblem;

export interface SetupValidation {
  readonly valid: boolean;
  readonly diagnostics: readonly SetupDiagnostic[];
}

export type TrainingSnapshot =
  | Exclude<AttemptSnapshot, { readonly status: 'none' }>
  | { readonly status: 'none'; readonly problem: StartProblem | null; readonly diagnostics: readonly SetupDiagnostic[]; readonly busy: boolean };

export type { LearnerCommand, StartProblem };


// Spec 3 Challenge content › Table; S3-02 ZreSb, FkMDw; #138
function isTableOptions(value: unknown): value is TableOptions {
  if (!hasExactKeys(value, Object.keys(DEFAULT_TABLE_SETUP))) return false;
  const options = value;
  const whole = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;
  return (
    (options.seat === 'observe' || options.seat === 'play') &&
    typeof options.betSchedule === 'boolean' &&
    typeof options.baseWager === 'string' &&
    typeof options.startingBalance === 'string' &&
    (options.countingMode === 'basic' || options.countingMode === 'deviations') &&
    BLACKJACK_PRESETS.includes(options.preset as TableOptions['preset']) &&
    PENETRATIONS.includes(options.penetration as number) &&
    whole(options.extraPlayers, 0, MAX_OTHER_PLAYERS) &&
    whole(options.interval, 1, MAX_CHECKPOINT_INTERVAL)
  );
}


// Spec 3 Play challenge funding (#20) › Starting balance; S3-02 Al6Pw; #139
export const tableFundingProblems = (options: TableOptions): PlayFundingProblem[] => (options.seat === 'play' ? playFundingProblems(options, BLACKJACK_LIMITS.initial) : []);

// Spec 3 Play challenge funding; Comparison groups; #139
const tableFunding = (funding: { readonly betSchedule?: boolean; readonly baseWager?: string | null; readonly startingBalance?: string | null }): PlayFunding => ({
  betSchedule: funding.betSchedule ?? DEFAULT_TABLE_SETUP.betSchedule,
  baseWager: funding.baseWager ?? DEFAULT_TABLE_SETUP.baseWager,
  startingBalance: funding.startingBalance ?? DEFAULT_TABLE_SETUP.startingBalance,
});

// Spec 3 Training service interface › Results
export function retrySetup(groupKey: ChallengeGroupKey): ChallengeSetup {
  const { category, variant, table } = groupKey;
  if (!table) return { category, variant };
  const preset = blackjackPreset(table.dealer, table.lateSurrender);
  const countingMode = table.countingMode ?? DEFAULT_TABLE_SETUP.countingMode;
  return { category, variant, table: { seat: table.seat, preset, penetration: table.penetration, extraPlayers: table.extraPlayers, interval: table.checkpointInterval, countingMode, ...tableFunding(table) } };
}

// Spec 3 Amendment 1 C7
export const LAST_SETUP = 'challenge.last-setup';

// Spec 3 Play challenge funding › Starting balance; Amendment 1 C7; #139
export const PLAY_AMOUNT = 'challenge.play-amount';

export function setupFor(entry: CatalogEntry, preferred: readonly (ChallengeSetup | null | undefined)[], playAmount: string | null): ChallengeSetup {
  const fits = preferred.find((setup) => setup?.category === entry.category && entry.ready.includes(setup.variant));
  const chosen = fits ?? { category: entry.category, variant: entry.ready[0] ?? 'learn' };
  if (entry.category !== 'table' || chosen.table) return chosen;
  const remembered = preferred.find((setup) => setup?.category === 'table' && setup.table)?.table;
  return { ...chosen, table: remembered ?? { ...DEFAULT_TABLE_SETUP, ...tableFunding({ startingBalance: playAmount }) } };
}

const withFundingDefaults = (table: unknown): unknown => (typeof table === 'object' && table !== null ? { ...tableFunding({}), ...table } : table);

export { stepCount, type HeldLessonAccess, type InstructionWithheld, type LessonAccess, type LessonEntry, type LessonView };

export interface TrainingOptions {
  readonly lessons?: readonly Lesson[];
  readonly hints?: Readonly<Record<HintId, Hint>>;
}

export type { LearningPreferences };

const isChallengeCategory = (value: unknown): value is ChallengeCategory => CHALLENGE_CATEGORIES.includes(value as ChallengeCategory);

export class TrainingService {
  private readonly challenges: ChallengeController;
  private diagnostics: readonly SetupDiagnostic[] | null = null;
  private current: TrainingSnapshot = { status: 'loading' };
  private readonly listeners = new Set<() => void>();

  private readonly lessons: TrainingLessons;
  private lessonChanges = 0;
  private accessChanges = 0;
  private readonly preferences: DeviceLearningPreferences;

  constructor(
    private readonly adapters: TrainingAdapters,
    options: TrainingOptions = {},
  ) {
    this.lessons = new TrainingLessons(adapters, options.lessons ?? LESSONS, () => this.instructionWithheld(), () => this.reviseLessons());
    this.preferences = new DeviceLearningPreferences(adapters.store, options.hints ?? HINTS, () => this.notify());
    this.challenges = new ChallengeController(adapters, (record) => this.earned(record));
    this.challenges.subscribe(() => this.refresh());
  }

  snapshot = (): TrainingSnapshot => this.current;

  lessonRevision = (): number => this.lessonChanges;

  // Spec 3 Lessons › Access, Check protection; #149
  accessRevision = (): number => this.accessChanges;

  learningRevision = (): number => this.preferences.revision();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async load(): Promise<void> {
    await this.challenges.load();
    // Spec 3 Synchronized record types › Readiness milestone
    await this.recordMilestones().catch(() => undefined);
  }

  listCatalog(): readonly CatalogEntry[] {
    return CHALLENGE_CATEGORIES.map((category) => ({ category, ready: CHALLENGE_VARIANTS, pacings: pacingsOf(category) }));
  }

  validateSetup(setup: { readonly category: unknown; readonly variant: unknown; readonly pacing?: unknown; readonly table?: unknown }): SetupValidation {
    const diagnostics: SetupDiagnostic[] = [];
    const known = isChallengeCategory(setup.category);
    if (!known) diagnostics.push({ field: 'category', problem: 'unknown' });
    if (!CHALLENGE_VARIANTS.includes(setup.variant as ChallengeVariant)) diagnostics.push({ field: 'variant', problem: 'unknown' });
    // Spec 3 Attempt lifecycle › Automatic pacing; #136
    const pacing = pacingOf(setup);
    if (!CHALLENGE_PACINGS.includes(pacing as ChallengePacing)) diagnostics.push({ field: 'pacing', problem: 'unknown' });
    else if (known && !pacingsOf(setup.category as ChallengeCategory).includes(pacing as ChallengePacing)) diagnostics.push({ field: 'pacing', problem: 'not-ready' });
    if (setup.category === 'table' && !isTableOptions(setup.table)) diagnostics.push({ field: 'table', problem: 'invalid' });
    else if (setup.category === 'table') diagnostics.push(...tableFundingProblems(setup.table as TableOptions));
    return { valid: diagnostics.length === 0, diagnostics };
  }

  async startAttempt(setup: ChallengeSetup): Promise<void> {
    const validation = this.validateSetup(setup);
    if (!validation.valid) {
      this.diagnostics = validation.diagnostics;
      return this.refresh();
    }
    this.diagnostics = null;
    const remembered = rememberedSetup(setup);
    await this.adapters.store.writePreference(LAST_SETUP, JSON.stringify(remembered)).catch(() => undefined);
    if (remembered.table?.seat === 'play') await this.adapters.store.writePreference(PLAY_AMOUNT, remembered.table.startingBalance).catch(() => undefined);
    const table = remembered.table ? tableSetup(remembered.table) : undefined;
    await this.challenges.start(setup.variant, CHALLENGE_CONTENT[setup.category as ChallengeCategory], { timed: setup.timed === true, pacing: pacingOf(setup), ...(table ? { table } : {}) });
  }

  submit(command: LearnerCommand): Promise<void> {
    return this.challenges.submit(command);
  }

  retrySave(): Promise<void> {
    return this.challenges.retrySave();
  }

  // Spec 3 Training service interface › Resume / suspend / pause / end; #135
  pause(cause?: PauseCause): void {
    this.challenges.pause(cause);
  }

  resume(): Promise<void> {
    return this.challenges.resume();
  }

  // Spec 3 Attempt lifecycle › Performance timer
  performanceMs = (): number | null => this.challenges.performanceMs();

  // Spec 3 Training service interface › End
  end(options?: { readonly showResults?: boolean }): Promise<void> {
    return this.challenges.end(options);
  }

  // Spec 3 Attempt lifecycle › Charge (Retry)
  async retry(): Promise<void> {
    const snapshot = this.current;
    if (snapshot.status !== 'ended') return;
    const { record } = snapshot;
    this.dismissResults();
    await this.startAttempt({ ...retrySetup(record.groupKey), timed: record.performanceMs !== null, pacing: record.groupKey.pacing });
  }

  // Spec 3 Amendment 1 B5
  suspend(cause?: DirectSuspendCause): void {
    this.challenges.suspend(cause);
  }

  async lifecycle(event: LifecycleEvent): Promise<void> {
    await this.challenges.lifecycle(event);
    // Spec 3 Lessons › Access; #149
    if (event === 'access-changed') {
      this.accessMayHaveChanged();
      this.notify();
    }
  }

  // Spec 3 Amendment 4 §2–3
  allowance(): Promise<ChallengeAllowance> {
    return this.adapters.allowance.challengeAllowance();
  }

  // Spec 3 Training service interface › Results
  async results(attemptId: string): Promise<ChallengeAttemptRecord | null> {
    return (await this.adapters.store.loadAttempt(attemptId))?.record ?? null;
  }

  // Spec 3 Comparison groups, records and progression; S3-10 OVKkc; #140
  now = (): number => this.adapters.clock.now();

  async progress(): Promise<Progress> {
    return progressProjection(await this.attempts(), await this.milestones());
  }

  // Spec 3 Comparison groups (Milestones); Audio and haptics (cue 16)
  private async earned(record: ChallengeAttemptRecord): Promise<AttemptEarned> {
    await this.recordMilestones().catch(() => undefined);
    const attempts = await this.attempts();
    const milestones = await this.milestones(milestoneCandidates(attempts, this.adapters.device, await this.refusedMilestones()));
    return { ...attemptEarned(attempts, record.attemptId), readiness: readinessOutcome(attempts, milestones, record.attemptId) };
  }

  // Spec 3 Synchronized record types › Readiness milestone
  private async recordMilestones(): Promise<void> {
    const recorded = await this.adapters.store.readMilestones();
    const refused = await this.refusedMilestones();
    const missing = milestoneCandidates(await this.attempts(), this.adapters.device, refused).filter(
      (candidate) => !recorded.some((milestone) => milestoneSlot(milestone) === milestoneSlot(candidate) && !refused.has(milestoneIdentity(milestone))),
    );
    for (const milestone of missing) await this.adapters.store.recordMilestone(milestone);
  }

  private async refusedMilestones(): Promise<ReadonlySet<string>> {
    return new Set((await this.adapters.store.readMilestoneSync()).refused);
  }

  // Spec 3 Synchronized record types › Readiness milestone; #148
  private async milestones(candidates: readonly ReadinessMilestoneRecord[] = []): Promise<readonly ProgressMilestone[]> {
    const { store } = this.adapters;
    const [{ accepted, refused }, local] = await Promise.all([store.readMilestoneSync(), store.readMilestones()]);
    const refusedIdentities = new Set(refused);
    return [
      ...accepted.map((record) => ({ record, local: false })),
      ...[...local, ...candidates].filter((record) => !refusedIdentities.has(milestoneIdentity(record))).map((record) => ({ record, local: true })),
    ];
  }

  // Spec 3 Comparison groups (local and accepted attempts); #142
  private async attempts(): Promise<readonly ProgressAttempt[]> {
    const { store } = this.adapters;
    const [local, accepted] = await Promise.all([store.readAttemptRecords(), store.readAcceptedAttempts()]);
    return [...accepted.map((record) => ({ record, local: false })), ...local.map((record) => ({ record, local: true }))];
  }

  // Spec 3 Amendment 1 C8; #142
  async attemptReview(attemptId: string): Promise<ChallengeAttemptRecord | null> {
    const { store, attemptDetail } = this.adapters;
    const local = (await store.readAttemptRecords()).find((record) => record.attemptId === attemptId);
    if (local) return local;
    const accepted = (await store.readAcceptedAttempts()).find((record) => record.attemptId === attemptId);
    if (!accepted) return null;
    if (accepted.review) return { ...accepted, review: accepted.review };
    return attemptDetail ? attemptDetail(attemptId) : null;
  }

  dismissResults(): void {
    this.challenges.dismissResults();
  }

  clearProblem(): void {
    this.diagnostics = null;
    this.refresh();
  }

  async lastSetup(): Promise<ChallengeSetup | null> {
    const text = await this.adapters.store.readPreference(LAST_SETUP).catch(() => null);
    if (text === null) return null;
    try {
      const value = JSON.parse(text) as Partial<ChallengeSetup>;
      if (!isChallengeCategory(value.category) || !CHALLENGE_VARIANTS.includes(value.variant as ChallengeVariant)) return null;
      const pacing = pacingsOf(value.category).includes(value.pacing as ChallengePacing) ? (value.pacing as ChallengePacing) : 'self-paced';
      return rememberedSetup({ category: value.category, variant: value.variant as ChallengeVariant, timed: value.timed === true, pacing, ...(value.table === undefined ? {} : { table: withFundingDefaults(value.table) as TableOptions }) });
    } catch {
      return null;
    }
  }

  // Spec 3 Play challenge funding › Starting balance; Amendment 1 C7; #139
  async playAmount(): Promise<string | null> {
    const text = await this.adapters.store.readPreference(PLAY_AMOUNT).catch(() => null);
    if (text === null) return null;
    const remembered = { ...DEFAULT_TABLE_SETUP, seat: 'play', startingBalance: text } as const;
    return tableFundingProblems(remembered).some((problem) => problem.field === 'starting-balance' && problem.problem !== 'short') ? null : text;
  }

  // Spec 3 Lessons › Check protection; Amendment 1 A2, Amendments 3 and 5
  async instructionWithheld(): Promise<InstructionWithheld | null> {
    const unfinished = await this.adapters.store.findUnfinishedAttempt();
    // Spec 3 Amendment 1 C6
    if (!unfinished || unfinished.sequence === 0 || unfinished.specification.variant !== 'check') return null;
    const { content, table } = unfinished.specification;
    return { category: content.category, play: table?.seat === 'play' };
  }

  // Spec 3 Lessons › Access
  listLessons(): Promise<readonly LessonEntry[]> {
    return this.lessons.list();
  }

  // Spec 3 S3-14 SUUN4, S3-12 JsXMJ
  aboutLesson(id: string): Pick<Lesson, 'id' | 'title' | 'section'> | null {
    return this.lessons.about(id);
  }

  // Spec 3 Lessons › Access, Check protection; #149
  lessonAccess(id: string): Promise<LessonAccess> {
    return this.lessons.access(id);
  }

  openLesson(id: string): Promise<LessonView> {
    return this.lessons.open(id);
  }

  stepForward(id: string, from: number): Promise<LessonView> {
    return this.lessons.stepForward(id, from);
  }

  stepBack(id: string, from: number): Promise<LessonView> {
    return this.lessons.stepBack(id, from);
  }

  restartLesson(id: string): Promise<LessonView> {
    return this.lessons.restart(id);
  }

  completeLesson(id: string): Promise<void> {
    return this.lessons.complete(id);
  }

  // Spec 3 Lessons › Entry points, Structure (First-use hints), Amendment 1 C7; #146
  learningPreferences(): Promise<LearningPreferences> {
    return this.preferences.read();
  }

  setStartHere(shown: boolean): Promise<void> {
    return this.preferences.setStartHere(shown);
  }

  hintSeen(id: HintId): Promise<void> {
    return this.preferences.hintSeen(id);
  }

  resetHints(): Promise<void> {
    return this.preferences.resetHints();
  }

  private accessMayHaveChanged(): void {
    this.accessChanges++;
    this.lessonChanges++;
  }

  private reviseLessons(): void {
    this.lessonChanges++;
    this.notify();
  }

  private refresh(): void {
    const attempt = this.challenges.snapshot();
    // Spec 3 Lessons › Check protection; #149
    if (attempt.status !== this.current.status) this.accessMayHaveChanged();
    if (attempt.status === 'none') {
      const problem = this.diagnostics ? 'invalid-setup' : attempt.problem;
      this.current = { status: 'none', problem, diagnostics: this.diagnostics ?? [], busy: attempt.busy };
    } else {
      this.current = attempt;
    }
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

function rememberedSetup({ category, variant, timed, pacing, table }: ChallengeSetup): ChallengeSetup {
  return {
    category,
    variant,
    ...(timed ? { timed } : {}),
    ...(pacing && pacing !== 'self-paced' ? { pacing } : {}),
    ...(category === 'table' && isTableOptions(table) ? { table } : {}),
  };
}

// Spec 3 Attempt lifecycle › Automatic pacing; #136
export const pacingOf = <T>(setup: { readonly pacing?: T }): T | 'self-paced' => setup.pacing ?? 'self-paced';

const pacingsOf = (category: ChallengeCategory): readonly ChallengePacing[] =>
  CHALLENGE_PACINGS.filter((pacing) => pacingApplies(category, pacing));
