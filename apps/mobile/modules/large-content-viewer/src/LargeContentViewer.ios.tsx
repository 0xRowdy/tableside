// docs/development.md Accessibility notes for the shell
import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';

import type { LargeContentContainerProps, LargeContentItemProps } from './types';

type NativeItemProps = Omit<LargeContentItemProps, 'onSelect'> & { onSelect?: () => void };

export const LargeContentContainer: ComponentType<LargeContentContainerProps> = requireNativeView('LargeContentContainer');

const NativeItem: ComponentType<NativeItemProps> = requireNativeView('LargeContentItem');

export function LargeContentItem(props: LargeContentItemProps) {
  return <NativeItem {...props} />;
}
