import { useEffect, useRef, type RefObject } from 'react';
import { AccessibilityInfo, type HostInstance } from 'react-native';

export function useMoveFocus(target: RefObject<HostInstance | null>, request: unknown): void {
  const last = useRef<unknown>(null);
  useEffect(() => {
    if (request === null || request === undefined || request === false || Object.is(request, last.current)) return;
    last.current = request;
    if (target.current) AccessibilityInfo.sendAccessibilityEvent(target.current, 'focus');
  }, [request, target]);
}

export function useAnnouncement(message: string): void {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
}
