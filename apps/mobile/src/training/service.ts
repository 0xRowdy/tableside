// Spec 3 Modules › Training service; Training service interface; #158

import { CHALLENGE_CONTENT } from '@tableside/definitions';
import { CHALLENGE_VARIANTS, type ChallengeAttemptRecord, type ChallengeCategory, type ChallengeVariant } from '@tableside/engine';

import type { TrainingAdapters } from './adapters';
import type { ChallengeAllowance } from './allowance';
import { ChallengeController, type AttemptSnapshot, type LearnerCommand, type StartProblem } from './controller';

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

const isCatalogCategory = (value: unknown): value is CatalogCategory => SUGGESTED_ORDER.includes(value as CatalogCategory);

export class TrainingService {
  private readonly challenges: ChallengeController;
  private diagnostics: readonly SetupDiagnostic[] | null = null;
  private current: TrainingSnapshot = { status: 'loading' };
  private readonly listeners = new Set<() => void>();

  constructor(private readonly adapters: TrainingAdapters) {
    this.challenges = new ChallengeController(adapters);
    this.challenges.subscribe(() => this.refresh());
  }

  snapshot = (): TrainingSnapshot => this.current;

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
      return isCatalogCategory(value.category) && CHALLENGE_VARIANTS.includes(value.variant as ChallengeVariant) ? { category: value.category, variant: value.variant as ChallengeVariant } : null;
    } catch {
      return null;
    }
  }

  private refresh(): void {
    const attempt = this.challenges.snapshot();
    if (attempt.status === 'none') {
      const problem = this.diagnostics ? 'invalid-setup' : attempt.problem;
      this.current = { status: 'none', problem, diagnostics: this.diagnostics ?? [], busy: attempt.busy };
    } else {
      this.current = attempt;
    }
    for (const listener of this.listeners) listener();
  }
}
