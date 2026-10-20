// iOS: UILargeContentViewerInteraction. At accessibility text sizes, touching
// and holding an item shows its title and symbol enlarged in the system HUD;
// lifting the finger selects the item the finger is on.
import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';

import type { LargeContentContainerProps, LargeContentItemProps } from './types';

type NativeItemProps = Omit<LargeContentItemProps, 'onSelect'> & { onSelect?: () => void };

export const LargeContentContainer: ComponentType<LargeContentContainerProps> = requireNativeView('LargeContentContainer');

const NativeItem: ComponentType<NativeItemProps> = requireNativeView('LargeContentItem');

export function LargeContentItem(props: LargeContentItemProps) {
  return <NativeItem {...props} />;
}
