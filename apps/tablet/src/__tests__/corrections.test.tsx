import { renderHook, act, waitFor } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLookupController } from '../features/issuance/useLookupController';
import { useCatalogues } from '../features/issuance/useCatalogues';
import { useDraftRevision, type UseDraftRevisionArgs } from '../features/issuance/useDraftRevision';
import { applyServerErrors } from '../features/issuance/serverErrors';
import { deriveSummaryRevision } from '@echallan/contracts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ID = (suffix: string): string => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;

describe('R1 lookup invalidation', () => {
  it('does not start a fetch for fewer than three characters', () => {
    const fetchMock = vi.fn();
    const { result } = renderHook(() =>
      useLookupController({
        debounceMs: 0,
        fetchPath: (field, q) => `/api/registry/lookup?field=${field}&q=${q}`,
        fetcher: fetchMock as unknown as typeof fetch,
      }),
    );
    act(() => result.current.start('registration', 'GJ'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.lookup.kind).toBe('idle');
  });

  it('aborts the previous request when a new query is started', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((resolve) => {
        const timer = setTimeout(() => {
          resolve(new Response('{"matches":[]}', { status: 200 }));
        }, 100);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          // Swallow the abort; the controller's generation check discards this.
          resolve(new Response('{"matches":[]}', { status: 200 }));
        });
      });
    });
    const { result } = renderHook(() =>
      useLookupController({
        debounceMs: 0,
        fetchPath: (field, q) => `/api/registry/lookup?field=${field}&q=${q}`,
        fetcher: fetchMock as unknown as typeof fetch,
      }),
    );
    act(() => result.current.start('registration', 'GJ05JP6207'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    const firstController = result.current.inflightController();
    expect(firstController).not.toBeNull();
    expect(firstController?.signal.aborted).toBe(false);
    act(() => result.current.start('registration', 'GJ05JP6208'));
    expect(firstController?.signal.aborted).toBe(true);
  });

  it('cancels the in-flight request when reset() is called', async () => {
    let aborted = false;
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              aborted = true;
              reject(new DOMException('aborted', 'AbortError'));
            });
          }
        }),
    );
    const { result } = renderHook(() =>
      useLookupController({
        debounceMs: 50,
        fetchPath: (field, q) => `/api/registry/lookup?field=${field}&q=${q}`,
        fetcher: fetchMock as unknown as never,
      }),
    );
    act(() => result.current.start('registration', 'GJ05JP6207'));
    // Wait long enough for the timer to fire and fetch to start.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(result.current.inflightController()).not.toBeNull();
    act(() => result.current.reset());
    await waitFor(() => expect(aborted).toBe(true));
    expect(result.current.lookup.kind).toBe('idle');
  });

  it('discards a late response for a query that has been superseded', async () => {
    let resolveFirst: (value: Response) => void = () => undefined;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).includes('q=GJ05JP6207')
        ? firstResponse
        : Promise.resolve(new Response('{"matches":[]}', { status: 200 })),
    );
    const { result } = renderHook(() =>
      useLookupController({
        debounceMs: 0,
        fetchPath: (field, q) => `/api/registry/lookup?field=${field}&q=${q}`,
        fetcher: fetchMock as unknown as never,
      }),
    );
    act(() => result.current.start('registration', 'GJ05JP6207'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    act(() => result.current.start('registration', 'GJ05JP6208'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
    // Resolve the FIRST request (stale) — must be ignored.
    await act(async () => {
      resolveFirst(new Response('{"matches":[]}', { status: 200 }));
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(result.current.lookup.kind).toBe('empty');
  });
});

describe('R2 canonical draft revision', () => {
  const baseDraft: UseDraftRevisionArgs['draft'] = {
    vehicleRegistration: 'GJ05JP6207',
    gatePassNumber: 'DEMO-GP-0010',
    driverName: 'Kavita Joshi',
    departmentId: ID('4'),
    contractorId: ID('7'),
    vehicleTypeId: ID('8'),
    violationTypeIds: [ID('10')],
    remarks: 'Routine check',
    registry: {
      gatePassRecordId: ID('13'),
      driverId: ID('14'),
      vehicleId: ID('15'),
    },
  };

  it('produces a stable revision for the same draft', () => {
    const a = deriveSummaryRevision({ draft: baseDraft, preview: null, locationId: 'loc-1' });
    const b = deriveSummaryRevision({ draft: baseDraft, preview: null, locationId: 'loc-1' });
    expect(a).toBe(b);
  });

  it('changes the revision when any summary-binding field changes', () => {
    const previous = deriveSummaryRevision({
      draft: baseDraft,
      preview: null,
      locationId: 'loc-1',
    });
    const changed = deriveSummaryRevision({
      draft: { ...baseDraft, remarks: 'Different remarks' },
      preview: null,
      locationId: 'loc-1',
    });
    expect(changed).not.toBe(previous);
  });

  it('changes the revision when the preview changes', () => {
    const previous = deriveSummaryRevision({
      draft: baseDraft,
      preview: {
        severity: 'Minor',
        occurrenceNumber: 1,
        recommendedAction: 'warning_issued',
        duplicateWarning: { required: false, matchedCount: 0 },
      },
      locationId: 'loc-1',
    });
    const next = deriveSummaryRevision({
      draft: baseDraft,
      preview: {
        severity: 'Minor',
        occurrenceNumber: 2,
        recommendedAction: 'warning_issued',
        duplicateWarning: { required: false, matchedCount: 0 },
      },
      locationId: 'loc-1',
    });
    expect(next).not.toBe(previous);
  });

  it('detects a stale request that was sent before a draft edit', () => {
    const { result, rerender } = renderHook(
      (props: UseDraftRevisionArgs) => useDraftRevision(props),
      { initialProps: { draft: baseDraft, preview: null, locationId: 'loc-1' } },
    );
    const sent = result.current.revision;
    rerender({ draft: { ...baseDraft, remarks: 'Changed' }, preview: null, locationId: 'loc-1' });
    expect(result.current.bindRevision(sent).stale).toBe(true);
    expect(result.current.bindRevision(result.current.revision).stale).toBe(false);
  });
});

describe('R3 re-preview acknowledgement invalidation', () => {
  const baseDraft: UseDraftRevisionArgs['draft'] = {
    vehicleRegistration: 'GJ05JP6207',
    gatePassNumber: 'DEMO-GP-0010',
    driverName: 'Kavita Joshi',
    departmentId: ID('4'),
    contractorId: ID('7'),
    vehicleTypeId: ID('8'),
    violationTypeIds: [ID('10')],
    remarks: 'Routine check',
    registry: null,
  };

  const previewOne = {
    severity: 'Minor' as const,
    occurrenceNumber: 1,
    recommendedAction: 'warning_issued' as const,
    duplicateWarning: { required: false as const, matchedCount: 0 },
    windowDays: 90 as const,
    windowMinutes: 15 as const,
  };

  it('flags a re-preview with new occurrence as changed', () => {
    const { result } = renderHook((props: UseDraftRevisionArgs) => useDraftRevision(props), {
      initialProps: {
        draft: baseDraft,
        preview: previewOne,
        locationId: 'loc-1',
      },
    });
    expect(
      result.current.isPreviewChanged({
        ...previewOne,
        occurrenceNumber: 2,
      }),
    ).toBe(true);
  });

  it('flags a re-preview with new duplicate count as changed', () => {
    const { result } = renderHook((props: UseDraftRevisionArgs) => useDraftRevision(props), {
      initialProps: {
        draft: baseDraft,
        preview: previewOne,
        locationId: 'loc-1',
      },
    });
    expect(
      result.current.isPreviewChanged({
        ...previewOne,
        duplicateWarning: { required: true, matchedCount: 1 },
      }),
    ).toBe(true);
  });
});

describe('R4 theme spacing and severity chip', () => {
  it('exposes the new spacing tokens as CSS pixel strings', async () => {
    const theme = await import('@echallan/theme');
    expect(theme.SPACING.xl).toBe('24px');
    expect(theme.SPACING.lg).toBe('16px');
    expect(theme.SPACING.md).toBe('12px');
    expect(theme.TOUCH_TARGET_MIN.tabletCheckBoxRow).toBe(56);
  });
});

describe('R5 server error mapping and catalogue contracts', () => {
  it('maps Other-field server codes to the form field id', () => {
    const display = applyServerErrors({
      error: 'invalid_draft',
      message: 'Other context error',
      fields: [
        { field: 'department', code: 'other_remarks_required', message: 'Remarks required' },
        { field: 'vehicleType', code: 'other_remarks_required', message: 'Remarks required' },
        { field: 'contractor', code: 'unknown_master', message: 'Unknown contractor' },
        { field: 'violationType', code: 'not_distinct', message: 'Distinct violations required' },
      ],
    });
    expect(display.fieldErrors.departmentId).toBe('Remarks required');
    expect(display.fieldErrors.vehicleTypeId).toBe('Remarks required');
    expect(display.fieldErrors.contractorId).toBe('Unknown contractor');
    expect(display.fieldErrors.violationTypeIds).toBe('Distinct violations required');
    expect(display.fallback).toBeNull();
  });

  it('emits a fallback message for unmapped fields', () => {
    const display = applyServerErrors({
      error: 'invalid_draft',
      message: 'General validation error',
      fields: [{ field: 'post-shift', code: 'required', message: 'Required' }],
    });
    expect(display.fallback).toBe('General validation error');
  });

  it('falls back when the body is not a recognised error envelope', () => {
    const display = applyServerErrors({ unexpected: 'shape' });
    expect(display.fallback).toMatch(/try again/i);
    expect(Object.keys(display.fieldErrors)).toHaveLength(0);
  });
});

describe('R5 catalogue contracts', () => {
  it('rejects a malformed catalogue (wrong kind)', async () => {
    const { result } = renderHook(() =>
      useCatalogues({
        fetcher: (async () =>
          new Response(
            JSON.stringify({
              kind: 'departments',
              masters: [{ id: ID('1'), kind: 'violation-types', label: 'X', isActive: true }],
            }),
            { status: 200 },
          )) as unknown as typeof fetch,
      }),
    );
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
  });
});
