import type { ViewProps } from 'react-native';

export type LargeContentContainerProps = ViewProps;

export interface LargeContentItemProps extends ViewProps {
  /** Shown enlarged by the Large Content Viewer. */
  title: string;
  /** SF Symbol shown with the title. */
  systemImage?: string;
  /** Called when the finger lifts on this item while the viewer is showing it. */
  onSelect?: () => void;
}
