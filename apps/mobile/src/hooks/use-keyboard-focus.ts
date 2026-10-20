import { useState } from 'react';
import type { NativeSyntheticEvent, TargetedEvent } from 'react-native';

type FocusHandler = ((event: NativeSyntheticEvent<TargetedEvent>) => void) | null | undefined;

/**
 * Tracks keyboard/switch focus so a control can draw a visible focus ring.
 * Pass the control's own handlers, if any, to keep them working.
 */
export function useKeyboardFocus(handlers: { onFocus?: FocusHandler; onBlur?: FocusHandler } = {}) {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    focusProps: {
      onFocus: (event: NativeSyntheticEvent<TargetedEvent>) => {
        setFocused(true);
        handlers.onFocus?.(event);
      },
      onBlur: (event: NativeSyntheticEvent<TargetedEvent>) => {
        setFocused(false);
        handlers.onBlur?.(event);
      },
    },
  };
}
