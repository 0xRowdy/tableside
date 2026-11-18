// Spec 3 Modules › Training service; Training service interface; #158, #132, #133, #134, #137

import {
  BLACKJACK_LIMITS,
  BLACKJACK_PRESETS,
  blackjackPreset,
  CATALOG_CATEGORIES,
  CHALLENGE_CONTENT,
  DEFAULT_TABLE_SETUP,
  tableSetup,
  type TableOptions,
  HINTS,
  LESSONS,
  type Hint,
  type HintId,
  type CatalogCategory,
  type Lesson,
  type LessonContent,
  type LessonHandoff,
  type LessonSection,
  type LessonSource,
  type LessonStep,
  type WorkedExample,
} from '@tableside/definitions';
import {
  BET_SCHEDULE_UNITS,
  CHALLENGE_PACINGS,
  CHALLENGE_VARIANTS,
  FUNDING_CEILING,
  MAX_CHECKPOINT_INTERVAL,
  MAX_OTHER_PLAYERS,
  pacingApplies,
  PENETRATIONS,
  type ChallengeAttemptRecord, type ChallengeCategory, type ChallengeGroupKey, type ChallengePacing, type ChallengeVariant } from '@tableside/engine';

import type { LifecycleEvent } from '../practice/adapters';
import type { TrainingAdapters } from './adapters';
import type { ChallengeAllowance } from './allowance';
import { ChallengeController, type AttemptSnapshot, type DirectSuspendCause, type LearnerCommand, type PauseCause, type StartProblem } from './controller';
import { DeviceLearningPreferences, type LearningPreferences } from './learning-preferences';
import { attemptEarned, milestoneCandidates, progressProjection, readinessOutcome, type AttemptEarned, type Progress, type ProgressAttempt, type ProgressMilestone } from './progress';
import { milestoneSlot } from './readiness-milestone';
import { lessonProgress, type LessonChange, type LessonProgress, type LessonProgressChange, type LessonStatus } from './lesson-progress';

// Spec 3 Recommendations
export const SUGGESTED_ORDER = CATALOG_CATEGORIES;

export type { CatalogCategory };

export interface CatalogEntry {
  readonly category: CatalogCategory;
  readonly available: true;
  readonly ready: readonly ChallengeVariant[];
  // Spec 3 Attempt lifecycle › Automatic pacing; #136
  readonly pacings: readonly ChallengePacing[];
}

export interface ChallengeSetup {
  readonly category: CatalogCategory;
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
  | { readonly field: 'base-wager'; readonly problem: 'outside-limits' | 'schedule-over-maximum' }
  | { readonly field: 'starting-balance'; readonly problem: 'not-whole' | 'over-ceiling' | 'short' };

export type FundingDiagnostic = Extract<SetupDiagnostic, { readonly field: 'base-wager' | 'starting-balance' }>;

export interface SetupValidation {
  readonly valid: boolean;
  readonly diagnostics: readonly SetupDiagnostic[];
}

export type TrainingSnapshot =
  | Exclude<AttemptSnapshot, { readonly status: 'none' }>
  | { readonly status: 'none'; readonly problem: StartProblem | null; readonly diagnostics: readonly SetupDiagnostic[]; readonly busy: boolean };

export type { LearnerCommand, StartProblem };

const READY: Readonly<Partial<Record<CatalogCategory, readonly ChallengeVariant[]>>> = {
  'card-values': ['learn', 'check'],
  'running-count': ['learn', 'check'],
  conversion: ['learn', 'check'],
  table: ['learn', 'check'],
};

// Spec 3 Challenge content › Table; S3-02 ZreSb, FkMDw; #138
function isTableOptions(value: unknown): value is TableOptions {
  if (typeof value !== 'object' || value === null) return false;
  const options = value as Record<string, unknown>;
  const whole = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;
  return (
    Object.keys(options).length === 9 &&
    (options.seat === 'observe' || options.seat === 'play') &&
    typeof options.betSchedule === 'boolean' &&
    typeof options.baseWager === 'number' &&
    typeof options.startingBalance === 'number' &&
    (options.countingMode === 'basic' || options.countingMode === 'deviations') &&
    BLACKJACK_PRESETS.includes(options.preset as TableOptions['preset']) &&
    PENETRATIONS.includes(options.penetration as number) &&
    whole(options.extraPlayers, 0, MAX_OTHER_PLAYERS) &&
    whole(options.interval, 1, MAX_CHECKPOINT_INTERVAL)
  );
}


// Spec 3 Play challenge funding (#20) › Starting balance; S3-02 Al6Pw; #139
const TOP_UNITS = (BET_SCHEDULE_UNITS[BET_SCHEDULE_UNITS.length - 1] as { readonly units: number }).units;

export function tableFundingProblems(options: TableOptions): FundingDiagnostic[] {
  if (options.seat !== 'play') return [];
  const min = Number(BLACKJACK_LIMITS.initial.min);
  const max = Number(BLACKJACK_LIMITS.initial.max);
  const { baseWager, startingBalance } = options;
  const problems: FundingDiagnostic[] = [];
  const base = Number.isInteger(baseWager) && baseWager >= min && baseWager <= max;
  if (!base) problems.push({ field: 'base-wager', problem: 'outside-limits' });
  else if (options.betSchedule && baseWager * TOP_UNITS > max) problems.push({ field: 'base-wager', problem: 'schedule-over-maximum' });
  if (!Number.isInteger(startingBalance) || startingBalance < 1) problems.push({ field: 'starting-balance', problem: 'not-whole' });
  else if (startingBalance > Number(FUNDING_CEILING)) problems.push({ field: 'starting-balance', problem: 'over-ceiling' });
  else if (base && startingBalance < baseWager) problems.push({ field: 'starting-balance', problem: 'short' });
  return problems;
}

// Spec 3 Training service interface › Results: Retry keeps the attempt's settings
export function retrySetup(groupKey: ChallengeGroupKey): ChallengeSetup {
  const { category, variant, table } = groupKey;
  if (!table) return { category, variant };
  const preset = blackjackPreset(table.dealer, table.lateSurrender);
  const countingMode = table.countingMode ?? DEFAULT_TABLE_SETUP.countingMode;
  // Spec 3 Comparison groups: bet schedule, base wager, starting balance; #139
  const funding = {
    betSchedule: table.betSchedule,
    baseWager: table.baseWager === null ? DEFAULT_TABLE_SETUP.baseWager : Number(table.baseWager),
    startingBalance: table.startingBalance === null ? DEFAULT_TABLE_SETUP.startingBalance : Number(table.startingBalance),
  };
  return { category, variant, table: { seat: table.seat, preset, penetration: table.penetration, extraPlayers: table.extraPlayers, interval: table.checkpointInterval, countingMode, ...funding } };
}

// Spec 3 Amendment 1 C7
export const LAST_SETUP = 'challenge.last-setup';

// Spec 3 Play challenge funding › Starting balance; Amendment 1 C7; #139
export const PLAY_AMOUNT = 'challenge.play-amount';

export function setupFor(entry: CatalogEntry, preferred: readonly (ChallengeSetup | null | undefined)[], playAmount: number | null = null): ChallengeSetup {
  const fits = preferred.find((setup) => setup?.category === entry.category && entry.ready.includes(setup.variant));
  const chosen = fits ?? { category: entry.category, variant: entry.ready[0] ?? 'learn' };
  if (entry.category !== 'table' || chosen.table) return chosen;
  const remembered = preferred.find((setup) => setup?.category === 'table' && setup.table)?.table;
  return { ...chosen, table: remembered ?? { ...DEFAULT_TABLE_SETUP, startingBalance: playAmount ?? DEFAULT_TABLE_SETUP.startingBalance } };
}

const withFundingDefaults = (table: unknown): unknown =>
  typeof table === 'object' && table !== null
    ? { betSchedule: DEFAULT_TABLE_SETUP.betSchedule, baseWager: DEFAULT_TABLE_SETUP.baseWager, startingBalance: DEFAULT_TABLE_SETUP.startingBalance, ...table }
    : table;

// Spec 3 Training service interface › List catalog, Lesson progress; #143
export interface LessonEntry {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly section: LessonSection;
  readonly steps: number | null;
  // TODO(#149)
  readonly access: 'available';
  readonly status: LessonStatus;
}

export interface LessonView {
  readonly id: string;
  readonly title: string;
  readonly section: LessonSection;
  readonly step: number;
  readonly steps: readonly LessonStep[];
  readonly prompt: { readonly kind: 'resume-or-restart'; readonly step: number } | null;
  // Spec 3 Lessons › Progress, Amendment 1 C10
  readonly notice: { readonly kind: LessonChange; readonly change: string } | null;
  // Spec 3 Lessons › Structure (worked examples); #144
  readonly example: WorkedExample | null;
  // Spec 3 Lessons › Structure (Handoff)
  readonly handoffs: readonly LessonHandoff[];
  // Spec 3 Amendment 1 C11; S3-12 hGHha; #154
  readonly sources: readonly LessonSource[];
}

// Spec 3 S3-12 hGHha; #154
export const stepCount = (lesson: Pick<LessonContent, 'steps' | 'sources'>): number => lesson.steps.length + (lesson.sources.length > 0 ? 1 : 0);

export interface TrainingOptions {
  readonly lessons?: readonly Lesson[];
  readonly hints?: Readonly<Record<HintId, Hint>>;
}

export type { LearningPreferences };

type AuthoredLesson = Lesson & { readonly content: LessonContent };

const isCatalogCategory = (value: unknown): value is CatalogCategory => SUGGESTED_ORDER.includes(value as CatalogCategory);

export class TrainingService {
  private readonly challenges: ChallengeController;
  private diagnostics: readonly SetupDiagnostic[] | null = null;
  private current: TrainingSnapshot = { status: 'loading' };
  private readonly listeners = new Set<() => void>();

  private readonly lessons: readonly Lesson[];
  private lessonChanges = 0;
  private readonly preferences: DeviceLearningPreferences;
  private learningChanges = 0;

  constructor(
    private readonly adapters: TrainingAdapters,
    options: TrainingOptions = {},
  ) {
    this.lessons = options.lessons ?? LESSONS;
    this.preferences = new DeviceLearningPreferences(adapters.store, options.hints ?? HINTS);
    this.challenges = new ChallengeController(adapters, (record) => this.earned(record));
    this.challenges.subscribe(() => this.refresh());
  }

  snapshot = (): TrainingSnapshot => this.current;

  lessonRevision = (): number => this.lessonChanges;

  learningRevision = (): number => this.learningChanges;

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
    return SUGGESTED_ORDER.map((category) => ({ category, available: true, ready: READY[category] ?? [], pacings: pacingsOf(category) }));
  }

  validateSetup(setup: { readonly category: unknown; readonly variant: unknown; readonly pacing?: unknown; readonly table?: unknown }): SetupValidation {
    const diagnostics: SetupDiagnostic[] = [];
    const known = isCatalogCategory(setup.category);
    if (!known) diagnostics.push({ field: 'category', problem: 'unknown' });
    else if ((READY[setup.category as CatalogCategory] ?? []).length === 0) diagnostics.push({ field: 'category', problem: 'not-ready' });
    if (!CHALLENGE_VARIANTS.includes(setup.variant as ChallengeVariant)) diagnostics.push({ field: 'variant', problem: 'unknown' });
    else if (known && diagnostics.length === 0 && !READY[setup.category as CatalogCategory]?.includes(setup.variant as ChallengeVariant)) {
      diagnostics.push({ field: 'variant', problem: 'not-ready' });
    }
    // Spec 3 Attempt lifecycle › Automatic pacing; #136
    const pacing = pacingOf(setup);
    if (!CHALLENGE_PACINGS.includes(pacing as ChallengePacing)) diagnostics.push({ field: 'pacing', problem: 'unknown' });
    else if (known && !pacingsOf(setup.category as CatalogCategory).includes(pacing as ChallengePacing)) diagnostics.push({ field: 'pacing', problem: 'not-ready' });
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
    if (remembered.table?.seat === 'play') await this.adapters.store.writePreference(PLAY_AMOUNT, String(remembered.table.startingBalance)).catch(() => undefined);
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

  lifecycle(event: LifecycleEvent): Promise<void> {
    return this.challenges.lifecycle(event);
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
    const own = milestoneCandidates(attempts, this.adapters.device).map((milestone) => ({ record: milestone, local: true }));
    return { ...attemptEarned(attempts, record.attemptId), readiness: readinessOutcome(attempts, [...(await this.milestones()), ...own], record.attemptId) };
  }

  // Spec 3 Synchronized record types › Readiness milestone
  private async recordMilestones(): Promise<void> {
    const recorded = await this.adapters.store.readMilestones();
    const missing = milestoneCandidates(await this.attempts(), this.adapters.device).filter(
      (candidate) => !recorded.some((milestone) => milestoneSlot(milestone) === milestoneSlot(candidate)),
    );
    for (const milestone of missing) await this.adapters.store.recordMilestone(milestone);
  }

  // TODO(#148)
  private async milestones(): Promise<readonly ProgressMilestone[]> {
    return (await this.adapters.store.readMilestones()).map((record) => ({ record, local: true }));
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
      if (!isCatalogCategory(value.category) || !CHALLENGE_VARIANTS.includes(value.variant as ChallengeVariant)) return null;
      const pacing = pacingsOf(value.category).includes(value.pacing as ChallengePacing) ? (value.pacing as ChallengePacing) : 'self-paced';
      return rememberedSetup({ category: value.category, variant: value.variant as ChallengeVariant, timed: value.timed === true, pacing, ...(value.table === undefined ? {} : { table: withFundingDefaults(value.table) as TableOptions }) });
    } catch {
      return null;
    }
  }

  // Spec 3 Play challenge funding › Starting balance; Amendment 1 C7; #139
  async playAmount(): Promise<number | null> {
    const text = await this.adapters.store.readPreference(PLAY_AMOUNT).catch(() => null);
    const amount = text === null ? Number.NaN : Number(text);
    return Number.isInteger(amount) && amount >= 1 && amount <= Number(FUNDING_CEILING) ? amount : null;
  }

  // Spec 3 Lessons › Access
  async listLessons(): Promise<readonly LessonEntry[]> {
    const events = await this.adapters.store.readLessonEvents();
    return this.lessons.map(({ id, title, summary, section, content }) => ({
      id,
      title,
      summary,
      section,
      steps: content ? stepCount(content) : null,
      access: 'available' as const,
      status: content ? lessonProgress(events, progressKey(id, content)).status : { kind: 'not-started' as const },
    }));
  }

  async openLesson(id: string): Promise<LessonView> {
    const lesson = this.authored(id);
    const progress = await this.progressOf(lesson);
    const resume = progress.bookmark !== null && progress.bookmark > 1 ? progress.bookmark : null;
    return viewOf(lesson, progress, resume ?? 1, resume === null ? null : { kind: 'resume-or-restart', step: resume });
  }

  stepForward(id: string, from: number): Promise<LessonView> {
    const lesson = this.authored(id);
    return this.record(lesson, { kind: 'bookmark', step: Math.min(from + 1, stepCount(lesson.content)) });
  }

  stepBack(id: string, from: number): Promise<LessonView> {
    return this.record(this.authored(id), { kind: 'bookmark', step: Math.max(from - 1, 1) });
  }

  async restartLesson(id: string): Promise<LessonView> {
    const lesson = this.authored(id);
    const progress = await this.progressOf(lesson);
    if ((progress.bookmark ?? 1) === 1 && progress.changed === null) return viewOf(lesson, progress, 1, null);
    return this.record(lesson, { kind: 'restarted' });
  }

  async completeLesson(id: string): Promise<void> {
    await this.record(this.authored(id), { kind: 'completed' });
  }

  // Spec 3 Lessons › Entry points, Structure (First-use hints), Amendment 1 C7; #146
  learningPreferences(): Promise<LearningPreferences> {
    return this.preferences.read();
  }

  setStartHere(shown: boolean): Promise<void> {
    return this.changePreferences(this.preferences.setStartHere(shown));
  }

  hintSeen(id: HintId): Promise<void> {
    return this.changePreferences(this.preferences.hintSeen(id));
  }

  resetHints(): Promise<void> {
    return this.changePreferences(this.preferences.resetHints());
  }

  private async changePreferences(change: Promise<void>): Promise<void> {
    await change;
    this.learningChanges++;
    this.notify();
  }

  private authored(id: string): AuthoredLesson {
    const lesson = this.lessons.find((candidate) => candidate.id === id);
    if (!lesson?.content) throw new Error(`lesson ${id} is not available in this version`);
    return lesson as AuthoredLesson;
  }

  private async progressOf(lesson: AuthoredLesson): Promise<LessonProgress> {
    return lessonProgress(await this.adapters.store.readLessonEvents(), progressKey(lesson.id, lesson.content));
  }

  private async record(lesson: AuthoredLesson, event: LessonProgressChange): Promise<LessonView> {
    const { version, materialVersion } = lesson.content;
    await this.adapters.store.recordLessonEvent({
      recordVersion: 1,
      eventId: this.adapters.newId(),
      owner: this.adapters.owner,
      installation: this.adapters.device,
      lesson: { id: lesson.id, version, materialVersion },
      event,
      recordedAt: this.adapters.clock.now(),
    });
    this.lessonChanges++;
    this.notify();
    const progress = await this.progressOf(lesson);
    return viewOf(lesson, progress, progress.bookmark ?? 1, null);
  }

  private refresh(): void {
    const attempt = this.challenges.snapshot();
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

const pacingsOf = (category: CatalogCategory): readonly ChallengePacing[] =>
  CHALLENGE_PACINGS.filter((pacing) => pacingApplies(category, pacing));

const progressKey = (id: string, content: LessonContent) => ({ id, materialVersion: content.materialVersion, steps: stepCount(content) });

function viewOf(lesson: AuthoredLesson, progress: LessonProgress, step: number, prompt: LessonView['prompt']): LessonView {
  const { change } = lesson.content;
  return {
    id: lesson.id,
    title: lesson.title,
    section: lesson.section,
    step,
    steps: lesson.content.steps,
    prompt,
    notice: progress.changed && change ? { kind: progress.changed, change } : null,
    example: lesson.content.workedExample,
    handoffs: lesson.content.handoffs,
    sources: lesson.content.sources,
  };
}
