import { isOtherLabel, type OtherField } from '@echallan/contracts';

/**
 * Pure pre-issuance rules (I-05/ENT-04).
 *
 * These are the only places the counting and Other derivations happen; the API
 * service feeds them real database counts, and the acceptance pins them directly.
 */

/** Current occurrence = prior matching count plus one. */
export function occurrenceFromPriorCount(priorCount: number): number {
  if (!Number.isInteger(priorCount) || priorCount < 0) {
    throw new Error(`occurrenceFromPriorCount requires a non-negative integer, got ${priorCount}`);
  }
  return priorCount + 1;
}

/** A duplicate warning is required exactly when at least one match exists. */
export function duplicateWarningFromCount(matchedCount: number): {
  required: boolean;
  matchedCount: number;
} {
  if (!Number.isInteger(matchedCount) || matchedCount < 0) {
    throw new Error(
      `duplicateWarningFromCount requires a non-negative integer, got ${matchedCount}`,
    );
  }
  return { required: matchedCount > 0, matchedCount };
}

/**
 * The controlled fields whose selected master is the explicit Other option.
 * Order is stable so the response is deterministic.
 */
export function otherFieldsFromSelections(
  selections: ReadonlyArray<{ field: OtherField; label: string }>,
): OtherField[] {
  const order: OtherField[] = ['department', 'vehicleType', 'contractor', 'violationType'];
  const found = new Set(
    selections
      .filter((selection) => isOtherLabel(selection.label))
      .map((selection) => selection.field),
  );
  return order.filter((field) => found.has(field));
}
