// Spec 3 Modules › Training service; Training service interface; #158, #132, #133, #134, #137

import {
  BLACKJACK_PRESETS,
  blackjackPreset,
  CATALOG_CATEGORIES,
  CHALLENGE_CONTENT,
  DEFAULT_TABLE_SETUP,
  observeSetup,
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
import { CHALLENGE_VARIANTS, MAX_CHECKPOINT_INTERVAL, MAX_OTHER_PLAYERS, PENETRATIONS, type ChallengeAttemptRecord, type ChallengeCategory, type ChallengeGroupKey, type ChallengeVariant } from '@tableside/engine';

import type { TrainingAdapters } from './adapters';
import type { ChallengeAllowance } from './allowance';
import { ChallengeController, type AttemptSnapshot, type LearnerCommand, type StartProblem } from './controller';
import { DeviceLearningPreferences, type LearningPreferences } from './learning-preferences';
import { lessonProgress, type LessonChange, type LessonProgress, type LessonProgressChange, type LessonStatus } from './lesson-progress';

// Spec 3 Recommendations
export const SUGGESTED_ORDER = CATALOG_CATEGORIES;

export type { CatalogCategory };

export interface CatalogEntry {
  readonly category: CatalogCategory;
  readonly available: true;
  readonly ready: readonly ChallengeVariant[];
}

export interface ChallengeSetup {
  readonly category: CatalogCategory;
  readonly variant: ChallengeVariant;
  // Spec 3 User stories 27
  readonly table?: TableOptions;
}

export type { TableOptions };

export type SetupDiagnostic = { readonly field: 'category' | 'variant'; readonly problem: 'unknown' | 'not-ready' } | { readonly field: 'table'; readonly problem: 'invalid' };

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

// Spec 3 Challenge content › Table; S3-02 ZreSb
function isTableOptions(value: unknown): value is TableOptions {
  if (typeof value !== 'object' || value === null) return false;
  const options = value as Record<string, unknown>;
  const whole = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;
  return (
    Object.keys(options).length === 5 &&
    options.seat === 'observe' &&
    BLACKJACK_PRESETS.includes(options.preset as TableOptions['preset']) &&
    PENETRATIONS.includes(options.penetration as number) &&
    whole(options.extraPlayers, 0, MAX_OTHER_PLAYERS) &&
    whole(options.interval, 1, MAX_CHECKPOINT_INTERVAL)
  );
}

const withOptions = (setup: { readonly category: CatalogCategory; readonly variant: ChallengeVariant }, table: unknown): ChallengeSetup =>
  setup.category === 'table' && isTableOptions(table) ? { ...setup, table } : setup;

// Spec 3 Training service interface › Results: Retry keeps the attempt's settings
export function retrySetup(groupKey: ChallengeGroupKey): ChallengeSetup {
  const { category, variant, table } = groupKey;
  if (!table) return { category, variant };
  const preset = blackjackPreset(table.dealer, table.lateSurrender);
  return { category, variant, table: { seat: 'observe', preset, penetration: table.penetration, extraPlayers: table.extraPlayers, interval: table.checkpointInterval } };
}

// Spec 3 Amendment 1 C7
export const LAST_SETUP = 'challenge.last-setup';

export function setupFor(entry: CatalogEntry, preferred: readonly (ChallengeSetup | null | undefined)[]): ChallengeSetup {
  const fits = preferred.find((setup) => setup?.category === entry.category && entry.ready.includes(setup.variant));
  const chosen = fits ?? { category: entry.category, variant: entry.ready[0] ?? 'learn' };
  if (entry.category !== 'table' || chosen.table) return chosen;
  const remembered = preferred.find((setup) => setup?.category === 'table' && setup.table)?.table;
  return { ...chosen, table: remembered ?? DEFAULT_TABLE_SETUP };
}

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
    this.challenges = new ChallengeController(adapters);
    this.challenges.subscribe(() => this.refresh());
  }

  snapshot = (): TrainingSnapshot => this.current;

  lessonRevision = (): number => this.lessonChanges;

  learningRevision = (): number => this.learningChanges;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  load(): Promise<void> {
    return this.challenges.load();
  }

  listCatalog(): readonly CatalogEntry[] {
    return SUGGESTED_ORDER.map((category) => ({ category, available: true, ready: READY[category] ?? [] }));
  }

  validateSetup(setup: { readonly category: unknown; readonly variant: unknown; readonly table?: unknown }): SetupValidation {
    const diagnostics: SetupDiagnostic[] = [];
    const known = isCatalogCategory(setup.category);
    if (!known) diagnostics.push({ field: 'category', problem: 'unknown' });
    else if ((READY[setup.category as CatalogCategory] ?? []).length === 0) diagnostics.push({ field: 'category', problem: 'not-ready' });
    if (!CHALLENGE_VARIANTS.includes(setup.variant as ChallengeVariant)) diagnostics.push({ field: 'variant', problem: 'unknown' });
    else if (known && diagnostics.length === 0 && !READY[setup.category as CatalogCategory]?.includes(setup.variant as ChallengeVariant)) {
      diagnostics.push({ field: 'variant', problem: 'not-ready' });
    }
    if (setup.category === 'table' && !isTableOptions(setup.table)) diagnostics.push({ field: 'table', problem: 'invalid' });
    return { valid: diagnostics.length === 0, diagnostics };
  }

  async startAttempt(setup: ChallengeSetup): Promise<void> {
    const validation = this.validateSetup(setup);
    if (!validation.valid) {
      this.diagnostics = validation.diagnostics;
      return this.refresh();
    }
    this.diagnostics = null;
    const remembered = withOptions(setup, setup.table);
    await this.adapters.store.writePreference(LAST_SETUP, JSON.stringify(remembered)).catch(() => undefined);
    const table = remembered.table ? observeSetup(remembered.table) : undefined;
    await this.challenges.start(setup.variant, CHALLENGE_CONTENT[setup.category as ChallengeCategory], table);
  }

  submit(command: LearnerCommand): Promise<void> {
    return this.challenges.submit(command);
  }

  retrySave(): Promise<void> {
    return this.challenges.retrySave();
  }

  // Spec 3 Amendment 4 §2–3
  allowance(): Promise<ChallengeAllowance> {
    return this.adapters.allowance.challengeAllowance();
  }

  // Spec 3 Training service interface › Results
  async results(attemptId: string): Promise<ChallengeAttemptRecord | null> {
    return (await this.adapters.store.loadAttempt(attemptId))?.record ?? null;
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
      return withOptions({ category: value.category, variant: value.variant as ChallengeVariant }, value.table);
    } catch {
      return null;
    }
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
