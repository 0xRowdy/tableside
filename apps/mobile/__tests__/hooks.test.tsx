import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, type HostInstance } from 'react-native';

import { useAnnouncement, useMoveFocus } from '@/hooks/use-accessibility';

import { useFollow } from '@/hooks/use-follow';
import { useLoaded } from '@/hooks/use-loaded';
import { usePolling } from '@/hooks/use-polling';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

describe('useLoaded', () => {
  it('is undefined until the load resolves, then holds its value', async () => {
    const answer = deferred<string>();
    const { result } = await renderHook(() => useLoaded(() => answer.promise));
    expect(result.current).toBeUndefined();
    await act(async () => answer.resolve('loaded'));
    expect(result.current).toBe('loaded');
  });

  it('loads again when an argument changes, and never shows a result for the old arguments', async () => {
    const answers = { a: deferred<string>(), b: deferred<string>() };
    const load = jest.fn((key: 'a' | 'b') => answers[key].promise);
    const { result, rerender } = await renderHook(({ key }: { key: 'a' | 'b' }) => useLoaded(load, key), { initialProps: { key: 'a' } });
    await rerender({ key: 'b' });
    expect(load.mock.calls).toEqual([['a'], ['b']]);
    await act(async () => answers.a.resolve('for a'));
    expect(result.current).toBeUndefined();
    await act(async () => answers.b.resolve('for b'));
    expect(result.current).toBe('for b');
  });

  it('does not load again when the arguments are unchanged', async () => {
    const load = jest.fn(async (n: number) => n);
    const { rerender } = await renderHook(({ n }: { n: number }) => useLoaded(load, n), { initialProps: { n: 1 } });
    await rerender({ n: 1 });
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('useFollow', () => {
  it('follows with its arguments while mounted and stops on unmount', async () => {
    const log: string[] = [];
    const follow = (source: string) => {
      log.push(`follow ${source}`);
      return () => log.push(`stop ${source}`);
    };
    const { rerender, unmount } = await renderHook(({ source }: { source: string }) => useFollow(follow, source), { initialProps: { source: 'a' } });
    await rerender({ source: 'a' });
    expect(log).toEqual(['follow a']);
    await rerender({ source: 'b' });
    expect(log).toEqual(['follow a', 'stop a', 'follow b']);
    await unmount();
    expect(log).toEqual(['follow a', 'stop a', 'follow b', 'stop b']);
  });
});

describe('usePolling', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('polls on the interval only while active, with the latest poll, and stops on unmount', async () => {
    const calls: string[] = [];
    const { rerender, unmount } = await renderHook(({ active, name }: { active: boolean; name: string }) => usePolling(() => calls.push(name), 1000, active), {
      initialProps: { active: false, name: 'first' },
    });
    await act(async () => jest.advanceTimersByTime(3000));
    expect(calls).toEqual([]);
    await rerender({ active: true, name: 'first' });
    await act(async () => jest.advanceTimersByTime(2000));
    expect(calls).toEqual(['first', 'first']);
    await rerender({ active: true, name: 'second' });
    await act(async () => jest.advanceTimersByTime(1000));
    expect(calls).toEqual(['first', 'first', 'second']);
    await rerender({ active: false, name: 'second' });
    await act(async () => jest.advanceTimersByTime(3000));
    expect(calls).toHaveLength(3);
    await rerender({ active: true, name: 'second' });
    await unmount();
    await act(async () => jest.advanceTimersByTime(3000));
    expect(calls).toHaveLength(3);
  });
});

describe('useMoveFocus', () => {
  it('moves focus to the target each time the request takes a new value', async () => {
    const focused: unknown[] = [];
    const spy = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation((host, event) => void focused.push([host, event]));
    const target = { current: 'heading' as unknown as HostInstance };
    const { rerender } = await renderHook(({ request }: { request: string | null }) => useMoveFocus(target, request), { initialProps: { request: null } });
    expect(focused).toEqual([]);
    await rerender({ request: 'a' });
    await rerender({ request: 'a' });
    expect(focused).toEqual([['heading', 'focus']]);
    await rerender({ request: null });
    await rerender({ request: 'a' });
    expect(focused).toHaveLength(1);
    await rerender({ request: 'b' });
    expect(focused).toEqual([
      ['heading', 'focus'],
      ['heading', 'focus'],
    ]);
    spy.mockRestore();
  });

  it('moves focus on mount when asked, and skips a target that is not rendered', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => undefined);
    await renderHook(() => useMoveFocus({ current: null }, true));
    expect(spy).not.toHaveBeenCalled();
    await renderHook(() => useMoveFocus({ current: 'heading' as unknown as HostInstance }, true));
    expect(spy).toHaveBeenCalledWith('heading', 'focus');
    spy.mockRestore();
  });
});

describe('useAnnouncement', () => {
  it('announces the message when it first shows and whenever it changes', async () => {
    const spoken: string[] = [];
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((message) => void spoken.push(message));
    const { rerender } = await renderHook(({ message }: { message: string }) => useAnnouncement(message), { initialProps: { message: 'Session result' } });
    await rerender({ message: 'Session result' });
    expect(spoken).toEqual(['Session result']);
    await rerender({ message: 'Another result' });
    expect(spoken).toEqual(['Session result', 'Another result']);
    spy.mockRestore();
  });
});
