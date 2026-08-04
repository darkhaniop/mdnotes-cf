import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDebouncedValue', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 200));
    expect(result.current).toBe('a');
  });

  it('delays updates until the timer elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'b' });
    expect(result.current).toBe('a');
    act(() => void vi.advanceTimersByTime(199));
    expect(result.current).toBe('a');
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe('b');
  });

  it('collapses a burst of changes into one update', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' },
    });
    for (const value of ['b', 'c', 'd']) {
      rerender({ value });
      act(() => void vi.advanceTimersByTime(50));
    }
    expect(result.current).toBe('a');
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current).toBe('d');
  });
});
