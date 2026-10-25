import { beforeEach, describe, expect, it } from 'vitest';
import { loadSavedViews, SAVED_VIEWS_KEY } from '../features/challans/ChallanReviewPanel';

/**
 * Legacy saved views had no owner. They must never be assigned to whichever
 * account opens the shared terminal next; the upgrade path discards them.
 */
beforeEach(() => {
  window.localStorage.clear();
});

describe('saved-view legacy migration', () => {
  it('discards unowned v1 views instead of assigning them to the next account', () => {
    window.localStorage.setItem(
      SAVED_VIEWS_KEY,
      JSON.stringify([
        {
          name: 'Previous account search',
          filters: { search: 'previous-query' },
          sortField: 'issuedAt',
          sortDirection: 'desc',
        },
      ]),
    );

    expect(loadSavedViews('new-supervisor', 'Supervisor')).toEqual([]);
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('Previous account search');
    expect(raw).not.toContain('previous-query');
    expect(JSON.parse(raw ?? '{}')).toStrictEqual({ schemaVersion: 2, accounts: {} });
  });

  it('does not leak a legacy view into a different account envelope', () => {
    window.localStorage.setItem(
      SAVED_VIEWS_KEY,
      JSON.stringify([
        {
          name: 'Prior user',
          filters: {},
          sortField: 'issuedAt',
          sortDirection: 'desc',
        },
      ]),
    );

    expect(loadSavedViews('different-supervisor', 'Supervisor')).toEqual([]);
    expect(window.localStorage.getItem(SAVED_VIEWS_KEY)).not.toContain(
      'different-supervisor:Supervisor',
    );
  });
});
