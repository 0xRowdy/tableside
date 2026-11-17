// Spec 3 Lessons › Entry points, Structure (Handoff); #145

import type { LessonHandoff, LessonSection } from '@tableside/definitions';
import type { Href } from 'expo-router';

// Spec 3 Lessons › Entry points (by identity, for spec 4's builder help too)
export const lessonHref = (lesson: string): Href => ({ pathname: '/more/settings/learning/lessons/[lesson]', params: { lesson } });

export const lessonsHref = (section?: LessonSection): Href => ({ pathname: '/more/settings/learning/lessons', params: section ? { section } : {} });

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
