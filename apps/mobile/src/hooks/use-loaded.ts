import { useEffect, useState } from 'react';

const sameArguments = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

export function useLoaded<A extends readonly unknown[], T>(load: (...args: A) => Promise<T>, ...args: A): T | undefined {
  const [loaded, setLoaded] = useState<{ readonly args: A; readonly value: T } | null>(null);
  useEffect(() => {
    let current = true;
    void load(...args).then((value) => {
      if (current) setLoaded({ args, value });
    });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, args);
  return loaded && sameArguments(loaded.args, args) ? loaded.value : undefined;
}
