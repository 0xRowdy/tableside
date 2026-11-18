// Spec 3 Information hiding (end to end), Testing Decisions › Seam 3, Amendment 1 C5; #132
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { FEEDBACK_TOKENS, palette } from '@/theme/tokens';

interface HostNode {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: readonly (HostNode | string)[] | null;
}

type Rendered = HostNode | readonly HostNode[] | null;

export interface PresentedElement {
  readonly role?: string;
  readonly label?: string;
  readonly hint?: string;
  readonly value?: string;
  readonly state?: string;
  readonly live?: string;
  readonly text?: string;
  readonly masked?: string;
}

export interface PresentedScreen {
  readonly elements: readonly PresentedElement[];
  readonly colors: readonly string[];
  readonly announcements: readonly string[];
  readonly focusMoves: readonly string[];
}

export interface AccessibilityEvents {
  readonly announcements: string[];
  readonly focusMoves: string[];
  clear(): void;
}

const labelOf = (target: unknown) => {
  const props = (target as { props?: { accessibilityLabel?: unknown; testID?: unknown } } | null)?.props;
  return String(props?.accessibilityLabel ?? props?.testID ?? 'unlabelled');
};

export function watchAccessibilityEvents(): AccessibilityEvents {
  const announcements: string[] = [];
  const focusMoves: string[] = [];
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((message: string) => void announcements.push(message));
  jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation((target: unknown, type: string) => void focusMoves.push(`${type}: ${labelOf(target)}`));
  return {
    announcements,
    focusMoves,
    clear() {
      announcements.length = 0;
      focusMoves.length = 0;
    },
  };
}

const COLOR_PROPS = ['color', 'stroke', 'fill', 'tintColor'];

function colorsOf(props: Record<string, unknown>): string[] {
  const style = (StyleSheet.flatten(props.style as never) ?? {}) as Record<string, unknown>;
  const fromStyle = Object.entries(style).filter(([key, value]) => /color$/i.test(key) && typeof value === 'string');
  const fromProps = COLOR_PROPS.map((key) => [key, props[key]] as const).filter(([, value]) => typeof value === 'string' && value.startsWith('#'));
  return [...fromStyle, ...fromProps].map(([, value]) => (value as string).toUpperCase());
}

const text = (value: unknown) => (value === undefined || value === null || value === false ? undefined : typeof value === 'string' ? value : JSON.stringify(value));

export function presentedScreen(rendered: Rendered, events: AccessibilityEvents, options: { readonly mask?: readonly string[] } = {}): PresentedScreen {
  const elements: PresentedElement[] = [];
  const colors: string[] = [];
  const visit = (node: HostNode | string) => {
    if (typeof node === 'string') return;
    const { props } = node;
    if (typeof props.testID === 'string' && options.mask?.includes(props.testID)) return void elements.push({ masked: props.testID });
    colors.push(...colorsOf(props));
    const strings = (node.children ?? []).filter((child): child is string => typeof child === 'string');
    const element = Object.fromEntries(
      Object.entries({
        role: text(props.accessibilityRole ?? props.role),
        label: text(props.accessibilityLabel ?? props['aria-label']),
        hint: text(props.accessibilityHint),
        value: text(props.accessibilityValue),
        state: text(props.accessibilityState),
        live: text(props.accessibilityLiveRegion ?? props['aria-live']),
        text: strings.length > 0 ? strings.join('') : undefined,
      }).filter(([, value]) => value !== undefined),
    ) as PresentedElement;
    if (Object.keys(element).length > 0) elements.push(element);
    for (const child of node.children ?? []) visit(child);
  };
  for (const node of Array.isArray(rendered) ? rendered : rendered ? [rendered as HostNode] : []) visit(node);
  return { elements, colors, announcements: [...events.announcements], focusMoves: [...events.focusMoves] };
}

const FEEDBACK_HEX = new Set(FEEDBACK_TOKENS.map((token) => palette[token].toUpperCase()));

export const feedbackColorsIn = (screen: PresentedScreen) => screen.colors.filter((color) => FEEDBACK_HEX.has(color));

export function expectNoFeedbackColors(screen: PresentedScreen): void {
  expect(feedbackColorsIn(screen)).toEqual([]);
}

export function expectIndistinguishable(a: PresentedScreen, b: PresentedScreen): void {
  expect(a).toEqual(b);
}

export function expectNotPresented(screen: PresentedScreen, phrases: readonly string[]): void {
  const said = [...screen.elements.flatMap((element) => Object.values(element) as string[]), ...screen.announcements, ...screen.focusMoves];
  expect(phrases.filter((phrase) => said.some((line) => line.includes(phrase)))).toEqual([]);
}
