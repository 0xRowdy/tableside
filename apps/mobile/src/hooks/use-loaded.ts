import { useEffect, useState } from 'react';

const sameArguments = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

function useLoadedOn<A extends readonly unknown[], T>(deps: readonly unknown[], load: (...args: A) => Promise<T>, args: A): T | undefined {
  const [loaded, setLoaded] = useState<{ readonly deps: readonly unknown[]; readonly value: T } | null>(null);
  useEffect(() => {
    let current = true;
    void load(...args).then((value) => {
      if (current) setLoaded({ deps, value });
    });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return loaded && sameArguments(loaded.deps, deps) ? loaded.value : undefined;
}

export function useLoaded<A extends readonly unknown[], T>(load: (...args: A) => Promise<T>, ...args: A): T | undefined {
  return useLoadedOn(args, load, args);
}

export function useReloaded<A extends readonly unknown[], T>(key: unknown, load: (...args: A) => Promise<T>, ...args: A): T | undefined {
  return useLoadedOn([key, ...args], load, args);
}
