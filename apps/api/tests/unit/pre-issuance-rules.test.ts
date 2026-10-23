import { describe, expect, it } from 'vitest';
import { recommendedActionForOccurrence } from '@echallan/contracts';
import {
  duplicateWarningFromCount,
  occurrenceFromPriorCount,
  otherFieldsFromSelections,
} from '../../src/preIssuance/rules.js';

/**
 * Planner-owned pre-issuance acceptance (REP-02, ENT-04, pure rules layer).
 *
 * Missing modules/exports are **surface-absence RED** at preparation and are
 * labelled as such. Do not replace, skip or weaken these assertions.
 */

describe('REP-02: occurrence and recommendation mapping', () => {
  it.each([
    [0, 1, 'warning_issued'],
    [1, 2, 'safety_counselling_completed'],
    [2, 3, 'referred_to_department_contractor'],
    [9, 10, 'referred_to_department_contractor'],
  ])('prior count %i yields occurrence %i and %s', (prior, occurrence, action) => {
    const derived = occurrenceFromPriorCount(prior);
    expect(derived).toBe(occurrence);
    expect(recommendedActionForOccurrence(derived)).toBe(action);
  });

  it('rejects an impossible prior count', () => {
    expect(() => occurrenceFromPriorCount(-1)).toThrow();
    expect(() => occurrenceFromPriorCount(1.5)).toThrow();
  });
});

describe('REP-03: duplicate warning derivation', () => {
  it('requires a warning exactly when at least one match exists', () => {
    expect(duplicateWarningFromCount(0)).toEqual({ required: false, matchedCount: 0 });
    expect(duplicateWarningFromCount(1)).toEqual({ required: true, matchedCount: 1 });
    expect(duplicateWarningFromCount(3)).toEqual({ required: true, matchedCount: 3 });
  });

  it('rejects a negative or fractional count', () => {
    expect(() => duplicateWarningFromCount(-1)).toThrow();
    expect(() => duplicateWarningFromCount(0.5)).toThrow();
  });
});

describe('ENT-04: Other-field detection over selected masters', () => {
  it('returns exactly the fields whose selected label is Other', () => {
    expect(
      otherFieldsFromSelections([
        { field: 'department', label: 'Other' },
        { field: 'vehicleType', label: 'Car' },
        { field: 'contractor', label: ' Other ' },
        { field: 'violationType', label: 'No helmet' },
      ]),
    ).toEqual(['department', 'contractor']);
  });

  it('returns an empty list when no Other option is selected', () => {
    expect(
      otherFieldsFromSelections([
        { field: 'department', label: 'Logistics' },
        { field: 'violationType', label: 'No helmet' },
      ]),
    ).toEqual([]);
  });
});
