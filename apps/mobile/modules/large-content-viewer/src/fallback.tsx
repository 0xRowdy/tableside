// Platforms without a Large Content Viewer render plain views. Android's
// equivalent is drawn by the tab bar itself.
import { View } from 'react-native';

import type { LargeContentContainerProps, LargeContentItemProps } from './types';

export function LargeContentContainer(props: LargeContentContainerProps) {
  return <View {...props} />;
}

export function LargeContentItem({ title: _title, systemImage: _systemImage, onSelect: _onSelect, ...props }: LargeContentItemProps) {
  return <View {...props} />;
}
