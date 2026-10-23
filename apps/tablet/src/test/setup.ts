import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

/**
 * Jest-dom matchers, plus the fake-timer bridge the controlled-clock tablet tests
 * need.
 *
 * React Testing Library decides whether fake timers are installed by looking for
 * a global `jest` and, only then, for a `clock` marker on `setTimeout`. Vitest
 * installs exactly that marker through sinon but never defines `jest`, so RTL's
 * async wrapper ends every `findBy*` and every `user-event` call with a
 * `setTimeout(0)` that nothing ever fires: the await never resolves and the test
 * deadlocks until it times out.
 *
 * The bridge supplies only the timer controls RTL looks for, and each one defers
 * to Vitest's own fake-timer API. With real timers installed nothing here is
 * called, because RTL's own `clock` check fails first — so this changes no
 * behaviour outside a controlled-clock test and weakens no assertion.
 */

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.sessionStorage.clear();
});
interface FakeTimerCapableGlobal {
  jest?: {
    advanceTimersByTime: (milliseconds: number) => void;
    advanceTimersToNextTimer: () => void;
    runAllTimers: () => void;
  };
}

/** True only while Vitest's fake timers are actually installed. */
function fakeTimersInstalled(): boolean {
  const marker = globalThis.setTimeout as unknown as { clock?: unknown };
  return Object.prototype.hasOwnProperty.call(marker, 'clock');
}

const testGlobal = globalThis as unknown as FakeTimerCapableGlobal;

testGlobal.jest ??= {
  advanceTimersByTime: (milliseconds: number) => {
    if (fakeTimersInstalled()) vi.advanceTimersByTime(milliseconds);
  },
  advanceTimersToNextTimer: () => {
    if (fakeTimersInstalled()) vi.advanceTimersToNextTimer();
  },
  runAllTimers: () => {
    if (fakeTimersInstalled()) vi.runAllTimers();
  },
};
