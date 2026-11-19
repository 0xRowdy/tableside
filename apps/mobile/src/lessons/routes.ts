// Spec 3 Lessons › Entry points, Structure (Handoff); #145; docs/decisions/lessons-entry-points.md

import type { LessonHandoff } from '@tableside/definitions';
import type { GameId, StrategyDefinition } from '@tableside/engine';
import { router, type Href } from 'expo-router';

import { findGame } from '@/games';

// docs/decisions/lessons-entry-points.md (back labels); S3-11 klT0u, f6mxz
export const LESSON_ORIGINS = ['counting', 'home', 'table', 'setup'] as const;
export type LessonOrigin = (typeof LESSON_ORIGINS)[number];

export interface LessonsPlace {
  readonly section?: string;
  readonly from?: LessonOrigin;
  readonly all?: boolean;
}

const placeParams = ({ section, from, all }: LessonsPlace) => ({
  ...(section ? { section } : {}),
  ...(from && from !== 'counting' ? { from } : {}),
  ...(section && all ? { all: '1' } : {}),
});

export const lessonsHref = (place: LessonsPlace = {}): Href => ({ pathname: '/counting/lessons', params: placeParams(place) });

export const lessonHref = (lesson: string, place: LessonsPlace & { readonly catalog?: boolean } = {}): Href => ({
  pathname: '/counting/lessons/[lesson]',
  params: { lesson, ...placeParams(place), ...(place.catalog ? { catalog: '1' } : {}) },
});

export interface LessonParams {
  readonly section?: string;
  readonly from?: string;
  readonly all?: string;
  readonly catalog?: string;
}

export const placeOf = (params: LessonParams): LessonsPlace => ({ section: params.section, from: originOf(params.from), all: params.all === '1' });

export const originOf = (from: string | undefined): LessonOrigin => LESSON_ORIGINS.find((origin) => origin === from) ?? 'counting';

const gameOf = (section: string | undefined): GameId | null => findGame(section ?? '')?.id ?? null;

export interface LessonsBack {
  readonly label: string;
  readonly onPress: () => void;
}

// docs/decisions/lessons-entry-points.md (leaving lessons)
function leaveTo(href: Href | null): () => void {
  return () => {
    router.dismissTo('/counting');
    if (href) router.navigate(href);
  };
}

export function lessonsBack(params: LessonParams): LessonsBack {
  const origin = originOf(params.from);
  const game = gameOf(params.section);
  const title = game ? findGame(game)!.title : null;
  switch (origin) {
    case 'home':
      return { label: 'Home', onPress: leaveTo('/') };
    case 'table':
      return { label: title ? `${title} table` : 'Play', onPress: leaveTo('/play') };
    case 'setup':
      return { label: title ? `${title} setup` : 'Play', onPress: leaveTo('/play') };
    case 'counting':
      return { label: 'Counting', onPress: leaveTo(null) };
  }
}

// docs/decisions/lessons-entry-points.md (old links)
const OLD_LESSONS = /\/more\/settings\/learning\/lessons(?=[/?#]|$)/;
export const withCurrentLessonPaths = (path: string): string => path.replace(OLD_LESSONS, '/counting/lessons');

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
      return {
        pathname: '/play',
        params: { game: handoff.game, practice: 'guided', ...(handoff.strategy ? { strategy: handoff.strategy } : {}), ...(handoff.betSchedule ? { schedule: 'on' } : {}) },
      };
  }
}

export interface PracticePrefill {
  readonly guided: boolean;
  readonly strategy: string | null;
  readonly betSchedule: boolean;
}

export function practicePrefill(params: { readonly practice?: string; readonly strategy?: string; readonly schedule?: string }): PracticePrefill | null {
  if (params.practice !== 'guided' && params.practice !== 'free-play') return null;
  const guided = params.practice === 'guided';
  return { guided, strategy: guided ? (params.strategy ?? null) : null, betSchedule: guided && params.schedule === 'on' };
}

export const prefilledStrategy = (builtIns: readonly StrategyDefinition[], prefill: PracticePrefill | null): StrategyDefinition =>
  builtIns.find((option) => option.id === prefill?.strategy) ?? (builtIns[0] as StrategyDefinition);
