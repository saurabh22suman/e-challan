import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MASTER_KINDS, type MasterKind } from '@echallan/contracts';
import { selectMasters, useCatalogues } from '../features/issuance/useCatalogues';

/**
 * CHAR-01 planner acceptance (revision 2): catalogue failure classification.
 *
 * A rejected transport is a network failure; an HTTP 500/503 response proves the
 * server answered and must be reported as a service error; 401/403 and malformed
 * successful bodies stay distinct. A retry must recover the real catalogue and
 * never fabricate master choices.
 *
 * Read-only planner input prepared before the correction. Do not weaken.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ID = (suffix: string): string => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

function catalogueFor(kind: MasterKind) {
  const base = { id: ID('1'), kind, label: `${kind} entry`, isActive: true };
  if (kind === 'violation-types') {
    return { kind, masters: [{ ...base, severity: 'Minor', defaultAction: null }] };
  }
  if (kind === 'gates') {
    return { kind, masters: [{ ...base, locationId: ID('2') }] };
  }
  return { kind, masters: [base] };
}

function kindFromPath(path: string): MasterKind {
  const segment = path.split('/masters/')[1]?.split('?')[0] ?? '';
  if ((MASTER_KINDS as readonly string[]).includes(segment)) return segment as MasterKind;
  throw new Error(`unexpected catalogue path: ${path}`);
}

function errorState(state: ReturnType<typeof useCatalogues>['state']) {
  if (state.kind !== 'error') throw new Error(`expected an error state, received ${state.kind}`);
  return state;
}

describe('CHAR-01 catalogue failure classification', () => {
  it('classifies a rejected transport as a network failure with no fabricated masters', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const { result } = renderHook(() => useCatalogues({ fetcher }));

    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    const state = errorState(result.current.state);
    expect(state.reason as string).toBe('network');
    expect(state.message).toMatch(/couldn't load/i);
    expect(selectMasters(state, 'departments')).toEqual([]);
    expect(selectMasters(state, 'violation-types')).toEqual([]);
  });

  it('classifies HTTP 500 as a service error, not a lost connection', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: 'internal_error' }, 500));
    const { result } = renderHook(() => useCatalogues({ fetcher }));

    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    const state = errorState(result.current.state);
    expect(state.reason as string).toBe('service_error');
    expect(state.message).toContain('HTTP 500');
    expect(state.message).toMatch(/couldn't load/i);
    expect(selectMasters(state, 'vehicle-types')).toEqual([]);
  });

  it('classifies HTTP 503 as a service error carrying the returned status', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: 'unavailable' }, 503));
    const { result } = renderHook(() => useCatalogues({ fetcher }));

    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    const state = errorState(result.current.state);
    expect(state.reason as string).toBe('service_error');
    expect(state.message).toContain('HTTP 503');
  });

  it.each([401, 403])('classifies HTTP %i as a session refusal', async (status) => {
    const fetcher = vi.fn(async () => jsonResponse({ error: 'unauthenticated' }, status));
    const { result } = renderHook(() => useCatalogues({ fetcher }));

    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    const state = errorState(result.current.state);
    expect(state.reason as string).toBe('unauthenticated');
    expect(state.message).toMatch(/sign in again/i);
  });

  it('classifies a malformed successful response as a contract error', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        kind: 'departments',
        masters: [{ id: ID('9'), kind: 'violation-types', label: 'Mismatched', isActive: true }],
      }),
    );
    const { result } = renderHook(() => useCatalogues({ fetcher }));

    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    const state = errorState(result.current.state);
    expect(state.reason as string).toBe('invalid_contract');
    expect(state.message).toMatch(/did not match the expected contract/i);
    expect(selectMasters(state, 'departments')).toEqual([]);
  });

  it('recovers the real catalogue after a transient HTTP 500 on retry', async () => {
    let failing = true;
    const fetcher = vi.fn(async (path: string) =>
      failing
        ? jsonResponse({ error: 'internal_error' }, 500)
        : jsonResponse(catalogueFor(kindFromPath(path))),
    );
    const { result } = renderHook(() => useCatalogues({ fetcher }));

    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    expect(errorState(result.current.state).reason as string).toBe('service_error');
    expect(selectMasters(result.current.state, 'departments')).toEqual([]);

    failing = false;
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.state.kind).toBe('ready');
    const records = selectMasters(result.current.state, 'departments');
    expect(records).toHaveLength(1);
    expect(records[0]?.label).toBe('departments entry');
  });

  it('recovers the real catalogue after a transient transport rejection on retry', async () => {
    let failing = true;
    const fetcher = vi.fn(async (path: string) => {
      if (failing) throw new TypeError('Failed to fetch');
      return jsonResponse(catalogueFor(kindFromPath(path)));
    });
    const { result } = renderHook(() => useCatalogues({ fetcher }));

    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    expect(errorState(result.current.state).reason as string).toBe('network');

    failing = false;
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.state.kind).toBe('ready');
    expect(selectMasters(result.current.state, 'departments')).toHaveLength(1);
  });
});
