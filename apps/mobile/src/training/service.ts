// Spec 3 Modules › Training service; Training service interface; #158

import { CHALLENGE_CONTENT, LESSONS, type Lesson, type LessonContent, type LessonSection, type LessonStep } from '@tableside/definitions';
import { CHALLENGE_VARIANTS, type ChallengeAttemptRecord, type ChallengeCategory, type ChallengeVariant } from '@tableside/engine';

import type { TrainingAdapters } from './adapters';
import { ChallengeController, type AttemptSnapshot, type LearnerCommand, type StartProblem } from './controller';
import { lessonProgress, type LessonProgress, type LessonProgressChange, type LessonStatus } from './lesson-progress';

// Spec 3 Recommendations
export const SUGGESTED_ORDER = ['card-values', 'running-count', 'conversion', 'table'] as const;

export type CatalogCategory = (typeof SUGGESTED_ORDER)[number];

export interface CatalogEntry {
  readonly category: CatalogCategory;
  readonly available: true;
  readonly ready: readonly ChallengeVariant[];
}

export interface ChallengeSetup {
  readonly category: CatalogCategory;
  readonly variant: ChallengeVariant;
}

export interface SetupDiagnostic {
  readonly field: 'category' | 'variant';
  readonly problem: 'unknown' | 'not-ready';
}

export interface SetupValidation {
  readonly valid: boolean;
  readonly diagnostics: readonly SetupDiagnostic[];
}

export type TrainingSnapshot =
  | Exclude<AttemptSnapshot, { readonly status: 'none' }>
  | { readonly status: 'none'; readonly problem: StartProblem | null; readonly diagnostics: readonly SetupDiagnostic[]; readonly busy: boolean };

export type { LearnerCommand, StartProblem };

const READY: Readonly<Partial<Record<CatalogCategory, readonly ChallengeVariant[]>>> = { 'card-values': ['learn'] };


// Spec 3 Amendment 1 C7
export const LAST_SETUP = 'challenge.last-setup';

export function setupFor(entry: CatalogEntry, preferred: readonly (ChallengeSetup | null | undefined)[]): ChallengeSetup {
  const fits = preferred.find((setup) => setup?.category === entry.category && entry.ready.includes(setup.variant));
  return fits ?? { category: entry.category, variant: entry.ready[0] ?? 'learn' };
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
  readonly notice: { readonly kind: 'changed-after-completion' | 'changed-since-last-visit'; readonly change: string } | null;
}

export interface TrainingOptions {
  readonly lessons?: readonly Lesson[];
}

type AuthoredLesson = Lesson & { readonly content: LessonContent };

const isCatalogCategory = (value: unknown): value is CatalogCategory => SUGGESTED_ORDER.includes(value as CatalogCategory);

export class TrainingService {
  private readonly challenges: ChallengeController;
  private diagnostics: readonly SetupDiagnostic[] | null = null;
  private current: TrainingSnapshot = { status: 'loading' };
  private readonly listeners = new Set<() => void>();

  private readonly lessons: readonly Lesson[];
  private lessonChanges = 0;

  constructor(
    private readonly adapters: TrainingAdapters,
    options: TrainingOptions = {},
  ) {
    this.lessons = options.lessons ?? LESSONS;
    this.challenges = new ChallengeController(adapters);
    this.challenges.subscribe(() => this.refresh());
  }

  snapshot = (): TrainingSnapshot => this.current;

  lessonRevision = (): number => this.lessonChanges;

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

  validateSetup(setup: { readonly category: unknown; readonly variant: unknown }): SetupValidation {
    const diagnostics: SetupDiagnostic[] = [];
    const known = isCatalogCategory(setup.category);
    if (!known) diagnostics.push({ field: 'category', problem: 'unknown' });
    else if ((READY[setup.category as CatalogCategory] ?? []).length === 0) diagnostics.push({ field: 'category', problem: 'not-ready' });
    if (!CHALLENGE_VARIANTS.includes(setup.variant as ChallengeVariant)) diagnostics.push({ field: 'variant', problem: 'unknown' });
    else if (known && diagnostics.length === 0 && !READY[setup.category as CatalogCategory]?.includes(setup.variant as ChallengeVariant)) {
      diagnostics.push({ field: 'variant', problem: 'not-ready' });
    }
    return { valid: diagnostics.length === 0, diagnostics };
  }

  async startAttempt(setup: ChallengeSetup): Promise<void> {
    const validation = this.validateSetup(setup);
    if (!validation.valid) {
      this.diagnostics = validation.diagnostics;
      return this.refresh();
    }
    this.diagnostics = null;
    await this.adapters.store.writePreference(LAST_SETUP, JSON.stringify({ category: setup.category, variant: setup.variant })).catch(() => undefined);
    await this.challenges.start(setup.variant, CHALLENGE_CONTENT[setup.category as ChallengeCategory]);
  }

  submit(command: LearnerCommand): Promise<void> {
    return this.challenges.submit(command);
  }

  retrySave(): Promise<void> {
    return this.challenges.retrySave();
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
      return isCatalogCategory(value.category) && CHALLENGE_VARIANTS.includes(value.variant as ChallengeVariant) ? { category: value.category, variant: value.variant as ChallengeVariant } : null;
    } catch {
      return null;
    }
  }

  // Spec 3 Lessons › Access: lessons are unmetered, so nothing here asks the access supervisor
  async listLessons(): Promise<readonly LessonEntry[]> {
    const events = await this.adapters.store.readLessonEvents();
    return this.lessons.map(({ id, title, summary, section, content }) => ({
      id,
      title,
      summary,
      section,
      steps: content ? content.steps.length : null,
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
    return this.record(lesson, { kind: 'bookmark', step: Math.min(from + 1, lesson.content.steps.length) });
  }

  stepBack(id: string, from: number): Promise<LessonView> {
    return this.record(this.authored(id), { kind: 'bookmark', step: Math.max(from - 1, 1) });
  }

  restartLesson(id: string): Promise<LessonView> {
    return this.record(this.authored(id), { kind: 'restarted' });
  }

  async completeLesson(id: string): Promise<void> {
    await this.record(this.authored(id), { kind: 'completed' });
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

const progressKey = (id: string, content: LessonContent) => ({ id, materialVersion: content.materialVersion, steps: content.steps.length });

function viewOf(lesson: AuthoredLesson, progress: LessonProgress, step: number, prompt: LessonView['prompt']): LessonView {
  const { change } = lesson.content;
  return {
    id: lesson.id,
    title: lesson.title,
    section: lesson.section,
    step,
    steps: lesson.content.steps,
    prompt,
    notice: progress.changed && change ? { kind: progress.changed === 'after-completion' ? 'changed-after-completion' : 'changed-since-last-visit', change } : null,
  };
}
