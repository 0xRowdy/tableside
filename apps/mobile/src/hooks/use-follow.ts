import { useEffect } from 'react';

export function useFollow<A extends readonly unknown[]>(follow: (...args: A) => () => void, ...args: A): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => follow(...args), args);
}
