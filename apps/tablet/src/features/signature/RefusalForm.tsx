import { useCallback, useEffect, useRef, useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  REFUSAL_REASON_MAX_LENGTH,
  REFUSAL_WITNESS_NAME_MAX_LENGTH,
  REFUSAL_WITNESS_STAFF_ID_MAX_LENGTH,
  RefusalSchema,
  type Refusal,
} from '@echallan/contracts';
import { ActionButton, ErrorSummary, Notice, SPACING, tokens } from '@echallan/theme';

/**
 * Plain-language task wording for the refusal form (UX-06/UXA-25). A limit
 * breach maps to a length correction; blank fields keep the entry prompt.
 */
function refusalErrorMessage(field: string, value: string, fallback: string): string {
  const trimmed = value.trim();
  switch (field) {
    case 'reason':
      if (trimmed === '') return 'Enter why the driver refused to sign.';
      if (value.length > REFUSAL_REASON_MAX_LENGTH) {
        return `Shorten the reason to ${REFUSAL_REASON_MAX_LENGTH} characters or fewer.`;
      }
      return fallback;
    case 'witnessName':
      if (trimmed === '') return "Enter the witnessing supervisor's name.";
      if (value.length > REFUSAL_WITNESS_NAME_MAX_LENGTH) {
        return `Shorten the name to ${REFUSAL_WITNESS_NAME_MAX_LENGTH} characters or fewer.`;
      }
      return fallback;
    case 'witnessStaffId':
      if (trimmed === '') return "Enter the witnessing supervisor's staff ID.";
      if (value.length > REFUSAL_WITNESS_STAFF_ID_MAX_LENGTH) {
        return `Shorten the staff ID to ${REFUSAL_WITNESS_STAFF_ID_MAX_LENGTH} characters or fewer.`;
      }
      return fallback;
    default:
      return fallback;
  }
}

const REFUSAL_FIELD_IDS: Record<string, string> = {
  reason: 'refusal-reason',
  witnessName: 'refusal-witness-name',
  witnessStaffId: 'refusal-witness-staff-id',
};

const REFUSAL_FIELD_ORDER = ['reason', 'witnessName', 'witnessStaffId'] as const;

/**
 * I-03 driver-refusal form.
 *
 * Captures the reason for refusal plus a witnessing supervisor's name and
 * staff id (PRD E2.14 and E-03 owner approval 2026-10-15). Validation lives
 * in the shared {@link RefusalSchema}; local errors remain visible after a
 * failed parse.
 *
 * CR-03 fix: the form reports the confirmed refusal through `onChange` and
 * reserves `onInvalidate` for invalidation (clear, redraw, summary
 * replacement). A change to `summaryRevision` invalidates a previously
 * confirmed refusal so the marshal must re-record against the new
 * driver summary.
 */

export interface RefusalFormProps {
  summaryRevision: string;
  onChange?(refusal: Refusal | null): void;
  onInvalidate?(): void;
}

export default function RefusalForm({ summaryRevision, onChange, onInvalidate }: RefusalFormProps) {
  const [reason, setReason] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [witnessStaffId, setWitnessStaffId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorNonce, setErrorNonce] = useState(0);
  const [confirmed, setConfirmed] = useState<Refusal | null>(null);
  const lastRevisionRef = useRef<string>(summaryRevision);

  useEffect(() => {
    if (summaryRevision !== lastRevisionRef.current) {
      lastRevisionRef.current = summaryRevision;
      if (confirmed !== null) {
        setConfirmed(null);
        onChange?.(null);
        onInvalidate?.();
      }
    }
  }, [summaryRevision, confirmed, onChange, onInvalidate]);

  const handleSubmit = useCallback(() => {
    const parsed = RefusalSchema.safeParse({
      reason,
      witnessName,
      witnessStaffId,
    });
    if (!parsed.success) {
      const rawValues: Record<string, string> = { reason, witnessName, witnessStaffId };
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'reason';
        if (map[field] === undefined) {
          map[field] = refusalErrorMessage(field, rawValues[field] ?? '', issue.message);
        }
      }
      setErrors(map);
      setErrorNonce((previous) => previous + 1);
      return;
    }
    setErrors({});
    setConfirmed(parsed.data);
    // CR-03 fix: onChange reports the confirmed refusal to the parent.
    // onInvalidate is reserved for invalidation (clear, redraw, summary
    // replacement) and is never called from a successful confirmation
    // path. The previous implementation fired both, which immediately
    // cleared the just-confirmed acknowledgement in EntryFlow.
    onChange?.(parsed.data);
  }, [onChange, reason, witnessName, witnessStaffId]);

  const refusalErrorItems = REFUSAL_FIELD_ORDER.filter((field) => errors[field] !== undefined).map(
    (field) => ({ id: REFUSAL_FIELD_IDS[field] ?? field, message: errors[field] ?? '' }),
  );

  const focusRefusalField = useCallback((item: { id: string }) => {
    const element = document.getElementById(item.id);
    if (element instanceof HTMLElement) {
      element.focus();
      element.scrollIntoView?.({ block: 'center' });
    }
  }, []);

  // A failed confirm focuses the linked refusal summary.
  useEffect(() => {
    if (errorNonce === 0) return;
    const summary = document.querySelector<HTMLElement>('[data-testid="error-summary"]');
    summary?.focus();
  }, [errorNonce]);

  return (
    <Stack spacing={SPACING.lg} data-testid="refusal-form">
      <Typography variant="body2" sx={{ color: tokens.muted }}>
        Record why the driver refused and the witnessing supervisor&apos;s details. A supervisor
        must witness the refusal. All fields are required before it is recorded.
      </Typography>
      {refusalErrorItems.length > 0 && (
        <div data-testid="refusal-errors">
          <ErrorSummary key={errorNonce} items={refusalErrorItems} onNavigate={focusRefusalField} />
        </div>
      )}
      <TextField
        id="refusal-reason"
        label="Reason for refusal"
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          setConfirmed(null);
          onChange?.(null);
        }}
        fullWidth
        multiline
        minRows={3}
        required
        error={errors.reason !== undefined}
        helperText={errors.reason}
      />
      <Typography variant="caption" sx={{ color: tokens.muted, marginTop: `-${SPACING.sm}` }}>
        {reason.length}/{REFUSAL_REASON_MAX_LENGTH}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={SPACING.md}>
        <TextField
          id="refusal-witness-name"
          label="Witnessing supervisor name"
          value={witnessName}
          onChange={(event) => {
            setWitnessName(event.target.value);
            setConfirmed(null);
            onChange?.(null);
          }}
          fullWidth
          required
          error={errors.witnessName !== undefined}
          helperText={errors.witnessName}
        />
        <TextField
          id="refusal-witness-staff-id"
          label="Witnessing supervisor staff ID"
          value={witnessStaffId}
          onChange={(event) => {
            setWitnessStaffId(event.target.value);
            setConfirmed(null);
            onChange?.(null);
          }}
          fullWidth
          required
          error={errors.witnessStaffId !== undefined}
          helperText={errors.witnessStaffId}
        />
      </Stack>
      <Stack direction="row" spacing={SPACING.md}>
        <ActionButton
          tone="primary"
          onClick={handleSubmit}
          data-testid="refusal-confirm"
          disabled={confirmed !== null && confirmed.reason === reason}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Confirm refusal
        </ActionButton>
      </Stack>
      {confirmed !== null && (
        <Notice severity="success" role="status">
          Refusal recorded with witness {confirmed.witnessName} ({confirmed.witnessStaffId}).
          Recorded on this device; no challan has been submitted.
        </Notice>
      )}
      <div data-testid="refusal-record" style={{ display: 'none' }}>
        {JSON.stringify(confirmed, null, 2)}
      </div>
    </Stack>
  );
}
