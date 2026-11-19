// docs/decisions/text-size-type-floor.md; DESIGN.md Typography
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { useLoaded } from '@/hooks/use-loaded';

import { createTextSizeStorage } from './device-storage';
import { TextSizeSetting, type TextSizeState, type TextSizeStorage } from './text-size';
import { fonts, SERIF_ROLES, textScale, typeLeading, typeRamp, type TextStep, type TypeRole } from './tokens';

export interface TypeStyle {
  readonly fontSize: number;
  readonly lineHeight: number;
}

export type TypeScale = Readonly<Record<TypeRole, TypeStyle>>;

const scales = new Map<TextStep, TypeScale>();

export function typeScale(step: TextStep): TypeScale {
  let scale = scales.get(step);
  if (!scale) {
    const sizes = typeRamp[step];
    scale = Object.fromEntries(
      (Object.keys(sizes) as TypeRole[]).map((role) => [role, { fontSize: sizes[role], lineHeight: Math.round(sizes[role] * typeLeading[role]) }]),
    ) as TypeScale;
    scales.set(step, scale);
  }
  return scale;
}

// docs/decisions/text-size-type-floor.md rule 4
export function maxScale(role: TypeRole): number {
  if (role === 'tab') return 1;
  return SERIF_ROLES.has(role) ? textScale.display : textScale.body;
}

export const roleFont = (role: TypeRole): string => (SERIF_ROLES.has(role) ? fonts.display : fonts.ui);

const StepContext = createContext<TextStep>('standard');
const SettingContext = createContext<TextSizeSetting | null>(null);

export function TextSizeProvider({ children, storage }: { children: ReactNode; storage?: TextSizeStorage }) {
  const [setting] = useState(() => new TextSizeSetting(storage ?? createTextSizeStorage()));
  useLoaded((stored) => stored.load(), setting);
  const { step } = useSyncExternalStore(setting.subscribe, setting.snapshot);
  return (
    <SettingContext.Provider value={setting}>
      <StepContext.Provider value={step}>{children}</StepContext.Provider>
    </SettingContext.Provider>
  );
}

export const useTextStep = (): TextStep => useContext(StepContext);

export function useTextSize(): TextSizeState & { choose: (step: TextStep) => Promise<void> } {
  const setting = useContext(SettingContext);
  if (!setting) throw new Error('useTextSize needs a TextSizeProvider');
  const state = useSyncExternalStore(setting.subscribe, setting.snapshot);
  return { ...state, choose: setting.choose.bind(setting) };
}

type Styles = Parameters<typeof StyleSheet.create>[0];

export function makeStyles<T extends Styles>(build: (type: TypeScale) => T): () => Readonly<T> {
  const sheets = new Map<TextStep, Readonly<T>>();
  return function useStyles(): Readonly<T> {
    const step = useTextStep();
    let sheet = sheets.get(step);
    if (!sheet) {
      sheet = StyleSheet.create(build(typeScale(step)));
      sheets.set(step, sheet);
    }
    return sheet;
  };
}

export const useType = (role: TypeRole): TypeStyle => typeScale(useTextStep())[role];
