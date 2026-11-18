// Spec 3 Lessons › Access, Structure, Check protection; Training service interface; #143, #147, #149
import {
  CHECK_WITHHELD_LESSONS,
  type Lesson,
  type LessonContent,
  type LessonHandoff,
  type LessonSection,
  type LessonSource,
  type LessonStep,
  type WorkedExample,
} from '@tableside/definitions';
import type { ChallengeCategory, GameId } from '@tableside/engine';

import type { GameAccess } from '../practice/adapters';
import type { TrainingAdapters } from './adapters';
import { LESSON_PROGRESS_RECORD_VERSION, lessonProgress, type LessonChange, type LessonHistory, type LessonProgress, type LessonProgressChange, type LessonStatus } from './lesson-progress';

// Spec 3 Lessons › Check protection; Amendment 1 A2; #149
export interface InstructionWithheld {
  readonly category: ChallengeCategory;
  readonly play: boolean;
}

// Spec 3 Training service interface › List catalog, Lesson progress; #143
export interface LessonEntry {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly section: LessonSection;
  readonly steps: number | null;
  readonly access: LessonAccess;
  readonly status: LessonStatus;
}

// Spec 3 Lessons › Access, Check protection; Amendment 1 A2, Amendment 4 §5; #149
export type LessonAccess =
  | { readonly kind: 'available' }
  | { readonly kind: 'after-check'; readonly attempt: InstructionWithheld }
  | { readonly kind: 'needs-connection'; readonly game: GameId; readonly offlineGame: GameId | null };

export type HeldLessonAccess = Exclude<LessonAccess, { readonly kind: 'available' }>;

const HELD_MESSAGE: Record<HeldLessonAccess['kind'], string> = { 'after-check': 'opens after the Check attempt ends', 'needs-connection': 'needs a connection' };

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

type AuthoredLesson = Lesson & { readonly content: LessonContent };

type LessonAdapters = Pick<TrainingAdapters, 'store' | 'access' | 'newId' | 'owner' | 'device' | 'clock'>;

export class LessonService {
  constructor(
    private readonly adapters: LessonAdapters,
    private readonly lessons: readonly Lesson[],
    private readonly withheld: () => Promise<InstructionWithheld | null>,
    private readonly recorded: () => void,
  ) {}

  // Spec 3 Lessons › Access
  async list(): Promise<readonly LessonEntry[]> {
    const games = [...new Set(this.lessons.flatMap((lesson) => (lesson.game ? [lesson.game] : [])))];
    const [history, withheld, answers] = await Promise.all([
      this.history(),
      this.withheld(),
      Promise.all(games.map(async (game) => [game, await this.gameAccess(game)] as const)),
    ]);
    const access = new Map(answers);
    return this.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      summary: lesson.summary,
      section: lesson.section,
      steps: lesson.content ? stepCount(lesson.content) : null,
      access: accessOf(lesson, withheld, lesson.game && (access.get(lesson.game) ?? null)),
      status: lesson.content ? lessonProgress(history, progressKey(lesson.id, lesson.content)).status : { kind: 'not-started' as const },
    }));
  }

  // Spec 3 S3-14 SUUN4, S3-12 JsXMJ
  about(id: string): Pick<Lesson, 'id' | 'title' | 'section'> | null {
    const lesson = this.lessons.find((candidate) => candidate.id === id);
    return lesson ? { id: lesson.id, title: lesson.title, section: lesson.section } : null;
  }

  // Spec 3 Lessons › Access, Check protection; #149
  async access(id: string): Promise<LessonAccess> {
    const lesson = this.lessons.find((candidate) => candidate.id === id);
    if (!lesson) throw new Error(`lesson ${id} is not in this version`);
    const [withheld, game] = await Promise.all([this.withheld(), lesson.game && this.gameAccess(lesson.game)]);
    return accessOf(lesson, withheld, game);
  }

  async open(id: string): Promise<LessonView> {
    const lesson = await this.accessible(id);
    const progress = await this.progressOf(lesson);
    const resume = progress.bookmark !== null && progress.bookmark > 1 ? progress.bookmark : null;
    return viewOf(lesson, progress, resume ?? 1, resume === null ? null : { kind: 'resume-or-restart', step: resume });
  }

  async stepForward(id: string, from: number): Promise<LessonView> {
    const lesson = await this.accessible(id);
    return this.record(lesson, { kind: 'bookmark', step: Math.min(from + 1, stepCount(lesson.content)) });
  }

  async stepBack(id: string, from: number): Promise<LessonView> {
    return this.record(await this.accessible(id), { kind: 'bookmark', step: Math.max(from - 1, 1) });
  }

  async restart(id: string): Promise<LessonView> {
    const lesson = await this.accessible(id);
    const progress = await this.progressOf(lesson);
    if ((progress.bookmark ?? 1) === 1 && progress.changed === null) return viewOf(lesson, progress, 1, null);
    return this.record(lesson, { kind: 'restarted' });
  }

  async complete(id: string): Promise<void> {
    await this.record(await this.accessible(id), { kind: 'completed' });
  }

  // Spec 3 Amendment 4 §5
  private gameAccess(game: GameId): Promise<GameAccess> {
    return this.adapters.access.gameAccess({ game }).catch((): GameAccess => ({ status: 'needs-connection', offlineGame: null }));
  }

  private authored(id: string): AuthoredLesson {
    const lesson = this.lessons.find((candidate) => candidate.id === id);
    if (!lesson?.content) throw new Error(`lesson ${id} is not available in this version`);
    return lesson as AuthoredLesson;
  }

  // Spec 3 Lessons › Access (bookmark kept), Check protection
  private async accessible(id: string): Promise<AuthoredLesson> {
    const lesson = this.authored(id);
    const access = await this.access(id);
    if (access.kind !== 'available') throw new Error(`lesson ${id} ${HELD_MESSAGE[access.kind]}`);
    return lesson;
  }

  private async progressOf(lesson: AuthoredLesson): Promise<LessonProgress> {
    return lessonProgress(await this.history(), progressKey(lesson.id, lesson.content));
  }

  // Spec 3 Amendment 1 C10; #147
  private async history(): Promise<LessonHistory> {
    const { store } = this.adapters;
    const [sync, local] = await Promise.all([store.readLessonSync(), store.readLessonEvents()]);
    return { ...sync, local };
  }

  private async record(lesson: AuthoredLesson, event: LessonProgressChange): Promise<LessonView> {
    const { version, materialVersion } = lesson.content;
    await this.adapters.store.recordLessonEvent({
      recordVersion: LESSON_PROGRESS_RECORD_VERSION,
      eventId: this.adapters.newId(),
      owner: this.adapters.owner,
      installation: this.adapters.device,
      lesson: { id: lesson.id, version, materialVersion },
      event,
      recordedAt: this.adapters.clock.now(),
    });
    this.recorded();
    const progress = await this.progressOf(lesson);
    return viewOf(lesson, progress, progress.bookmark ?? 1, null);
  }
}

const AVAILABLE: LessonAccess = { kind: 'available' };

// Spec 3 Lessons › Access, Check protection; Amendment 1 A2, Amendment 4 §5
function accessOf({ id, game }: Lesson, withheld: InstructionWithheld | null, playable: GameAccess | null): LessonAccess {
  if (game && playable?.status === 'needs-connection') return { kind: 'needs-connection', game, offlineGame: playable.offlineGame };
  if (withheld && (CHECK_WITHHELD_LESSONS.anyCheck.includes(id) || (withheld.play && CHECK_WITHHELD_LESSONS.playCheck.includes(id)))) return { kind: 'after-check', attempt: withheld };
  return AVAILABLE;
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
