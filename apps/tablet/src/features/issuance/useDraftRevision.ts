import { useEffect, useRef, useState } from 'react';
import { deriveSummaryRevision, type ChallanPreviewResponse } from '@echallan/contracts';

/**
 * R2 canonical draft revision + R3 changed re-preview acknowledgement.
 *
 * The hook computes a stable summary revision from the draft's
 * summary-binding fields, the accepted preview and the session-bound
 * location. Async responses (validation, preview) capture the revision
 * that was current when the request was sent; on resolution the hook
 * compares the captured revision to the current canonical one before
 * applying the result, so a stale answer for an edited draft cannot
 * advance summary state.
 *
 * The hook also tracks the last preview accepted by the UI; a new preview
 * response with a different occurrence number, recommended action or
 * duplicate set/count invalidates the acknowledgement (R3 unchanged-draft
 * but server preview changed). Same-shape re-previews from a code path
 * that already advances state are passed through unchanged.
 */

export interface UseDraftRevisionArgs {
  draft: {
    vehicleRegistration: string;
    gatePassNumber: string;
    driverName: string;
    departmentId: string;
    contractorId: string;
    vehicleTypeId: string;
    violationTypeIds: readonly string[];
    remarks: string;
    registry: { gatePassRecordId: string; driverId: string; vehicleId: string } | null;
  };
  preview: ChallanPreviewResponse | null;
  locationId: string;
}

export interface DraftRevisionApi {
  revision: string;
  bindRevision(revision: string): { stale: boolean };
  isPreviewChanged(candidate: ChallanPreviewResponse): boolean;
}

export function useDraftRevision({
  draft,
  preview,
  locationId,
}: UseDraftRevisionArgs): DraftRevisionApi {
  const [revision, setRevision] = useState(() =>
    deriveSummaryRevision({ draft, preview, locationId }),
  );
  const lastPreviewRef = useRef<ChallanPreviewResponse | null>(preview);
  const [lastPreviewSnapshot, setLastPreviewSnapshot] = useState<ChallanPreviewResponse | null>(
    preview,
  );

  useEffect(() => {
    const next = deriveSummaryRevision({ draft, preview, locationId });
    setRevision((previous) => (previous === next ? previous : next));
  }, [draft, preview, locationId]);

  const bindRevision = (sentRevision: string) => ({ stale: sentRevision !== revision });

  const isPreviewChanged = (candidate: ChallanPreviewResponse): boolean => {
    const previous = lastPreviewSnapshot;
    if (previous === null) {
      lastPreviewRef.current = candidate;
      setLastPreviewSnapshot(candidate);
      return true;
    }
    const changed = !samePreviewInformation(previous, candidate);
    if (changed) {
      lastPreviewRef.current = candidate;
      setLastPreviewSnapshot(candidate);
    }
    return changed;
  };

  return { revision, bindRevision, isPreviewChanged };
}

function samePreviewInformation(a: ChallanPreviewResponse, b: ChallanPreviewResponse): boolean {
  if (a.severity !== b.severity) return false;
  if (a.occurrenceNumber !== b.occurrenceNumber) return false;
  if (a.recommendedAction !== b.recommendedAction) return false;
  if (a.duplicateWarning.required !== b.duplicateWarning.required) return false;
  if (a.duplicateWarning.matchedCount !== b.duplicateWarning.matchedCount) return false;
  return true;
}
