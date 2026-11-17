import { useEffect, useRef } from 'react';

export function usePolling(poll: () => unknown, milliseconds: number, active: boolean): void {
  const latest = useRef(poll);
  useEffect(() => {
    latest.current = poll;
  });
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => latest.current(), milliseconds);
    return () => clearInterval(timer);
  }, [active, milliseconds]);
}
