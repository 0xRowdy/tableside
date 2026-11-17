import type { ViewProps } from 'react-native';

export type LargeContentContainerProps = ViewProps;

export interface LargeContentItemProps extends ViewProps {
  title: string;
  systemImage?: string;
  onSelect?: () => void;
}
