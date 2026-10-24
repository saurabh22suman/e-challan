import { useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  RESOLUTION_ACTION_LABELS,
  type ChallanDetailResponse,
  type ResolutionActionCode,
  type Role,
} from '@echallan/contracts';
import {
  challanStatusKind,
  ErrorSummary,
  Notice,
  SeverityChip,
  SPACING,
  StatusBadge,
  ToneDialogTitle,
  tokens,
  useToast,
} from '@echallan/theme';
import { getChallan, OperationsApiError, transitionChallan } from '../../api/operations';
import ChallanEvidencePanel from './ChallanEvidencePanel';

/**
 * Detail dialog for the review workspace.
 *
 * The dialog never offers a transition the D3 rules do not allow: Issued can be
 * started, Under Review can be resolved with an action + mandatory remarks, and
 * only an Admin sees reopening for a Resolved record. Admin cancellation is
 * available from every non-cancelled status and is terminal.
 */

const ACTION_CODES = Object.keys(RESOLUTION_ACTION_LABELS) as ResolutionActionCode[];

interface ChallanDetailDialogProps {
  token: string;
  challanId: string | null;
  role: Role;
  onClose: () => void;
  onChanged: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
}

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" sx={{ color: tokens.muted }}>
        {label}
      </Typography>
      <Typography variant="body1">{value}</Typography>
    </Stack>
  );
}

export default function ChallanDetailDialog({
  token,
  challanId,
  role,
  onClose,
  onChanged,
  onPrevious,
  onNext,
  previousDisabled = true,
  nextDisabled = true,
}: ChallanDetailDialogProps) {
  const [detail, setDetail] = useState<ChallanDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [action, setAction] = useState<ResolutionActionCode | ''>('');
  const [remarks, setRemarks] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ action?: string; remarks?: string }>({});
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorNonce, setErrorNonce] = useState(0);
  const { showToast } = useToast();

  const open = challanId !== null;

  useEffect(() => {
    if (challanId === null) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActionError(null);
    setAction('');
    setRemarks('');
    setFieldErrors({});
    setReason('');
    setReasonError(null);
    setCancelReason('');
    setCancelError(null);
    getChallan(token, challanId)
      .then((resolved) => {
        if (!cancelled) setDetail(resolved);
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setError(
          failure instanceof OperationsApiError
            ? failure.message
            : 'The challan could not be loaded.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [challanId, token]);

  const history = useMemo(() => detail?.actions ?? [], [detail]);

  async function submitReview(transition: Parameters<typeof transitionChallan>[2]): Promise<void> {
    if (challanId === null) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await transitionChallan(token, challanId, transition);
      setDetail(updated);
      onChanged();
      if (transition.to === 'Resolved') {
        showToast({
          tone: 'success',
          title: 'Challan resolved',
          description: 'The action taken and remarks were recorded.',
        });
      } else if (transition.to === 'Cancelled') {
        showToast({
          tone: 'success',
          title: 'Challan cancelled',
          description: 'The cancellation reason was recorded and the record is retained.',
        });
      } else if ('reason' in transition && transition.reason !== undefined) {
        showToast({
          tone: 'success',
          title: 'Challan reopened',
          description: 'The reopening reason was recorded. The challan is under review again.',
        });
      } else {
        showToast({
          tone: 'success',
          title: 'Review started',
          description: 'The challan is now under review.',
        });
      }
    } catch (failure) {
      setActionError(
        failure instanceof OperationsApiError ? failure.message : 'The review could not be saved.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resolve(event: React.FormEvent): void {
    event.preventDefault();
    const errors: typeof fieldErrors = {};
    if (action === '') errors.action = 'Select an action.';
    if (remarks.trim() === '') errors.remarks = 'Enter the remarks for the action taken.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || action === '') {
      if (Object.keys(errors).length > 0) setErrorNonce((previous) => previous + 1);
      return;
    }
    void submitReview({ to: 'Resolved', action, remarks: remarks.trim() });
  }

  function cancel(event: React.FormEvent): void {
    event.preventDefault();
    if (cancelReason.trim() === '') {
      setCancelError('Enter the reason for cancelling this challan.');
      setErrorNonce((previous) => previous + 1);
      return;
    }
    setCancelError(null);
    void submitReview({ to: 'Cancelled', reason: cancelReason.trim() });
  }

  function reopen(event: React.FormEvent): void {
    event.preventDefault();
    if (reason.trim() === '') {
      setReasonError('Enter a reason for reopening.');
      setErrorNonce((previous) => previous + 1);
      return;
    }
    setReasonError(null);
    void submitReview({ to: 'Under Review', reason: reason.trim() });
  }

  useEffect(() => {
    if (errorNonce === 0) return;
    document.querySelector<HTMLElement>('[data-testid="error-summary"]')?.focus();
  }, [errorNonce]);

  function focusField(id: string): void {
    const element = document.getElementById(id);
    if (element instanceof HTMLElement) {
      element.focus();
      element.scrollIntoView?.({ block: 'center' });
    }
  }

  const errorItems = [
    ...(fieldErrors.action === undefined ? [] : [{ id: 'review-action', message: 'Action taken' }]),
    ...(fieldErrors.remarks === undefined ? [] : [{ id: 'review-remarks', message: 'Remarks' }]),
    ...(reasonError === null ? [] : [{ id: 'reopen-reason', message: 'Reopening reason' }]),
    ...(cancelError === null ? [] : [{ id: 'cancel-reason', message: 'Cancellation reason' }]),
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="challan-detail-title"
    >
      <ToneDialogTitle id="challan-detail-title" component="h2">
        Challan details
      </ToneDialogTitle>
      <DialogContent dividers>
        {loading && <CircularProgress aria-label="Loading challan" />}
        {error !== null && (
          <Notice severity="error" role="status">
            {error}
          </Notice>
        )}
        {detail !== null && (
          <Stack spacing={SPACING.lg}>
            <Stack direction="row" spacing={SPACING.sm} sx={{ alignItems: 'center' }}>
              <StatusBadge status={challanStatusKind(detail.status)} />
              <SeverityChip severity={detail.severity} />
              <Typography variant="body2" sx={{ color: tokens.muted }}>
                {detail.challanNumber}
              </Typography>
            </Stack>

            <Stack
              direction="row"
              spacing={SPACING.xl}
              sx={{ flexWrap: 'wrap', rowGap: SPACING.md }}
            >
              <Field label="Driver" value={detail.driverName} />
              <Field label="Vehicle" value={detail.vehicleRegistrationNumber} />
              <Field label="Gate pass" value={detail.gatePassNumber} />
              <Field label="Location" value={detail.locationLabel} />
              <Field label="Gate" value={detail.gateLabel} />
              <Field label="Department" value={detail.departmentLabel} />
              <Field label="Contractor" value={detail.contractorLabel ?? 'Not recorded'} />
              <Field label="Vehicle type" value={detail.vehicleTypeLabel} />
              <Field label="Issued" value={formatInstant(detail.issuedAt)} />
              <Field
                label="Issued by"
                value={`${detail.issuedBy.displayName} (${detail.issuedBy.username})`}
              />
              <Field label="Occurrence" value={String(detail.occurrenceNumber)} />
              <Field
                label="Recommended action"
                value={RESOLUTION_ACTION_LABELS[detail.recommendedAction]}
              />
            </Stack>

            <Divider />
            <Stack spacing={SPACING.sm}>
              <Typography component="h3" variant="h3">
                Violations
              </Typography>
              <Stack
                component="ul"
                spacing={SPACING.xs}
                sx={{ margin: 0, paddingLeft: SPACING.lg }}
              >
                {detail.violations.map((violation) => (
                  <li key={`${violation.label}:${violation.severity}`}>
                    <Typography variant="body1">
                      {violation.label} ({violation.severity})
                    </Typography>
                  </li>
                ))}
              </Stack>
            </Stack>

            <Stack spacing={SPACING.sm}>
              <Typography component="h3" variant="h3">
                Issued remarks
              </Typography>
              <Typography variant="body1">{detail.remarks ?? 'No issued remarks.'}</Typography>
            </Stack>

            {detail.cancellationReason !== null && (
              <Stack spacing={SPACING.sm}>
                <Typography component="h3" variant="h3">
                  Cancellation
                </Typography>
                <Typography variant="body1">{detail.cancellationReason}</Typography>
              </Stack>
            )}

            <ChallanEvidencePanel token={token} challanId={detail.id} />

            <Stack spacing={SPACING.sm}>
              <Typography component="h3" variant="h3">
                Tracking history
              </Typography>
              <Stack
                component="ol"
                spacing={SPACING.md}
                sx={{ margin: 0, paddingLeft: SPACING.lg }}
              >
                <li>
                  <Stack
                    direction="row"
                    spacing={SPACING.sm}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <StatusBadge status="issued" />
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      — {formatInstant(detail.issuedAt)}
                    </Typography>
                  </Stack>
                  <Typography variant="body2">
                    Issued by {detail.issuedBy.displayName} ({detail.issuedBy.username})
                  </Typography>
                </li>
                {history.map((entry) => (
                  <li key={entry.id}>
                    <Stack
                      direction="row"
                      spacing={SPACING.sm}
                      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <StatusBadge status={challanStatusKind(entry.toStatus)} />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        — {formatInstant(entry.createdAt)}
                      </Typography>
                    </Stack>
                    {entry.action !== null && (
                      <Typography variant="body2">
                        Action: {RESOLUTION_ACTION_LABELS[entry.action]}
                      </Typography>
                    )}
                    {entry.remarks !== null && (
                      <Typography variant="body2">Remarks: {entry.remarks}</Typography>
                    )}
                    {entry.reason !== null && (
                      <Typography variant="body2">Reason: {entry.reason}</Typography>
                    )}
                    <Typography variant="caption" sx={{ color: tokens.muted }}>
                      Performed by {entry.performerDisplayName} ({entry.performerUsername})
                    </Typography>
                  </li>
                ))}
              </Stack>
              {history.length === 0 && (
                <Typography variant="body2" sx={{ color: tokens.muted }}>
                  No review actions recorded yet.
                </Typography>
              )}
            </Stack>

            {actionError !== null && (
              <Notice severity="error" role="alert">
                {actionError}
              </Notice>
            )}

            <ErrorSummary
              key={errorNonce}
              items={errorItems}
              onNavigate={(item) => focusField(item.id)}
            />

            {detail.status === 'Issued' && (
              <Button
                variant="contained"
                disabled={submitting}
                onClick={() => void submitReview({ to: 'Under Review' })}
                sx={{ alignSelf: 'flex-start' }}
              >
                Start review
              </Button>
            )}

            {detail.status === 'Under Review' && (
              <Stack component="form" spacing={SPACING.md} onSubmit={resolve} noValidate>
                <Typography component="h3" variant="h3">
                  Record resolution
                </Typography>
                <FormControl fullWidth error={fieldErrors.action !== undefined}>
                  <InputLabel id="action-taken-label">Action taken</InputLabel>
                  <Select
                    labelId="action-taken-label"
                    label="Action taken"
                    value={action}
                    onChange={(event) => setAction(event.target.value as ResolutionActionCode | '')}
                  >
                    <MenuItem value="">Choose an action</MenuItem>
                    {ACTION_CODES.map((code) => (
                      <MenuItem key={code} value={code}>
                        {RESOLUTION_ACTION_LABELS[code]}
                      </MenuItem>
                    ))}
                  </Select>
                  {fieldErrors.action !== undefined && (
                    <Typography variant="caption" sx={{ color: tokens.severity.critical, mt: 0.5 }}>
                      {fieldErrors.action}
                    </Typography>
                  )}
                </FormControl>
                <TextField
                  id="review-remarks"
                  label="Remarks"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                  required
                  error={fieldErrors.remarks !== undefined}
                  helperText={fieldErrors.remarks}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Resolve challan
                </Button>
              </Stack>
            )}

            {detail.status === 'Resolved' && role === 'Admin' && (
              <Stack component="form" spacing={SPACING.md} onSubmit={reopen} noValidate>
                <Typography component="h3" variant="h3">
                  Reopen challan
                </Typography>
                <TextField
                  id="reopen-reason"
                  label="Reopening reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                  required
                  error={reasonError !== null}
                  helperText={reasonError ?? undefined}
                />
                <Button
                  type="submit"
                  variant="outlined"
                  disabled={submitting}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Reopen challan
                </Button>
              </Stack>
            )}

            {detail.status === 'Resolved' && role !== 'Admin' && (
              <Typography variant="body2" sx={{ color: tokens.muted }}>
                Only an Admin can reopen a resolved challan.
              </Typography>
            )}

            {role === 'Admin' && detail.status !== 'Cancelled' && (
              <Stack component="form" spacing={SPACING.md} onSubmit={cancel} noValidate>
                <Divider />
                <Typography component="h3" variant="h3">
                  Cancel challan
                </Typography>
                <Typography variant="body2" sx={{ color: tokens.muted }}>
                  Cancellation is terminal and audited. The issued record and its history are
                  retained; its number is never reused.
                </Typography>
                <TextField
                  id="cancel-reason"
                  label="Cancellation reason"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                  required
                  error={cancelError !== null}
                  helperText={cancelError ?? undefined}
                />
                <Button
                  type="submit"
                  color="error"
                  variant="contained"
                  disabled={submitting || cancelReason.trim() === ''}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Cancel challan
                </Button>
              </Stack>
            )}

            {detail.status === 'Cancelled' && (
              <Typography variant="body2" sx={{ color: tokens.muted }}>
                Cancelled is terminal. This record cannot be reopened or resolved.
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={SPACING.sm}>
          <Button onClick={onPrevious} disabled={previousDisabled}>
            Previous
          </Button>
          <Button onClick={onNext} disabled={nextDisabled}>
            Next
          </Button>
        </Stack>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
