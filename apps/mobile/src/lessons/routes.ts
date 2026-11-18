// Spec 3 Lessons › Entry points, Structure (Handoff); #145

import type { LessonHandoff } from '@tableside/definitions';
import type { StrategyDefinition } from '@tableside/engine';
import type { Href } from 'expo-router';

// Spec 3 Lessons › Entry points
export const lessonHref = (lesson: string, section?: string): Href => ({
  pathname: '/more/settings/learning/lessons/[lesson]',
  params: section ? { lesson, section } : { lesson },
});

export const lessonsHref = (section?: string): Href => ({ pathname: '/more/settings/learning/lessons', params: section ? { section } : {} });

// Spec 3 S3-14 SUUN4, S3-11 LDmev; #149
export const attemptHref: Href = { pathname: '/counting', params: { attempt: '1' } };
export const returnsToAttempt = (params: { readonly attempt?: string }): boolean => params.attempt === '1';

// Spec 3 Lessons › Structure (Handoff)
export function handoffHref(handoff: LessonHandoff): Href {
  switch (handoff.kind) {
    case 'learn-challenge':
      return { pathname: '/counting', params: { category: handoff.category, variant: 'learn' } };
    case 'free-play':
      return { pathname: '/play', params: { game: handoff.game, practice: 'free-play' } };
    case 'guided-practice':
      return { pathname: '/play', params: { game: handoff.game, practice: 'guided', ...(handoff.strategy ? { strategy: handoff.strategy } : {}) } };
  }
}

export interface PracticePrefill {
  readonly guided: boolean;
  readonly strategy: string | null;
}

export function practicePrefill(params: { readonly practice?: string; readonly strategy?: string }): PracticePrefill | null {
  if (params.practice !== 'guided' && params.practice !== 'free-play') return null;
  return { guided: params.practice === 'guided', strategy: params.practice === 'guided' ? (params.strategy ?? null) : null };
}

export const prefilledStrategy = (builtIns: readonly StrategyDefinition[], prefill: PracticePrefill | null): StrategyDefinition =>
  builtIns.find((option) => option.id === prefill?.strategy) ?? (builtIns[0] as StrategyDefinition);
