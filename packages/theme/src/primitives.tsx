import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import { statusLabel, statusTone, toneStyles } from './status.js';
import type { StatusKind, Tone } from './status.js';
import { SPACING } from './touchTargets.js';
import { tokens } from './tokens.js';

/**
 * Shared primitives used by the pre-issuance and issuance journeys.
 *
 * Exact-path MUI imports only; the theme owns every visual token. Nothing here
 * invents a feature — these are labelled building blocks for real screens.
 *
 * Severity is rendered as a solid fill chip with its label; status is always
 * an outlined chip. Solid green is reserved for the challan commit action;
 * severity never uses the green token.
 */

export interface FormSectionProps {
  title: string;
  /** Optional id for accessibility/tests (the blue header gets a header role). */
  titleId?: string;
  /** Optional right-aligned header content (step number, context chip). */
  meta?: ReactNode;
  children: ReactNode;
}

/** A titled form section: flat bordered card with the blue header bar. */
export function FormSection({ title, titleId, meta, children }: FormSectionProps) {
  return (
    <Card>
      <Box
        component="header"
        sx={{
          backgroundColor: tokens.blue,
          color: tokens.surface,
          padding: `${SPACING.md} ${SPACING.lg}`,
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
        }}
      >
        <Typography
          component="h2"
          variant="h2"
          tabIndex={-1}
          {...(titleId === undefined ? {} : { id: titleId })}
          sx={{ color: tokens.surface, fontWeight: 600, outline: 'none' }}
        >
          {title}
        </Typography>
        {meta !== undefined && <Box sx={{ marginLeft: 'auto' }}>{meta}</Box>}
      </Box>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export interface NoticeProps {
  /**
   * Legacy visual severity. Kept for existing screens; `error` maps to the
   * danger tone. Prefer `tone` in new code.
   */
  severity?: 'info' | 'success' | 'warning' | 'error';
  /** Semantic tone; takes precedence over `severity` when both are supplied. */
  tone?: Tone;
  /** Persistent notices use `status`; actionable warnings use `alert`. */
  role?: 'status' | 'alert';
  children: ReactNode;
}

const SEVERITY_TONE: Record<'info' | 'success' | 'warning' | 'error', Tone> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

/** MUI Alert still needs a known severity for its icon. */
const TONE_SEVERITY: Record<Tone, 'info' | 'success' | 'warning' | 'error'> = {
  neutral: 'info',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  cancelled: 'info',
};

/** A persistent notice on a tinted surface. Never a transient toast (REP-05). */
export function Notice({ severity = 'info', tone, role, children }: NoticeProps) {
  const resolvedTone = tone ?? SEVERITY_TONE[severity];
  const style = toneStyles[resolvedTone];
  return (
    <Alert
      severity={TONE_SEVERITY[resolvedTone]}
      role={role}
      variant="outlined"
      data-tone={resolvedTone}
      sx={{
        backgroundColor: style.bg,
        color: style.fg,
        borderColor: style.border,
        borderRadius: 2,
        fontWeight: 500,
        '& .MuiAlert-icon': { color: style.fg },
      }}
    >
      {children}
    </Alert>
  );
}

export interface SeverityChipProps {
  severity: 'Minor' | 'Major' | 'Critical';
  /** Optional localised label; defaults to `Severity: <severity>`. */
  label?: string;
}

/**
 * Severity is rendered as a solid fill chip with its word — solid labelled
 * severity, outlined labelled status, never a green fill.
 */
export function SeverityChip({ severity, label }: SeverityChipProps) {
  const colour =
    severity === 'Critical'
      ? tokens.severity.critical
      : severity === 'Major'
        ? tokens.severity.major
        : tokens.severity.minor;
  return (
    <Chip
      label={label ?? `Severity: ${severity}`}
      role="status"
      sx={{
        backgroundColor: colour,
        color: tokens.surface,
        fontWeight: 700,
      }}
    />
  );
}

interface StatusBadgeBaseProps {
  /** Explicit tone; defaults to the status mapping, then neutral. */
  tone?: Tone;
  size?: 'small' | 'medium';
}

/**
 * A label and tone are both accepted so callers can render either a known
 * application status or an explicitly toned label.
 */
export type StatusBadgeProps = StatusBadgeBaseProps &
  ({ label: string; status?: StatusKind } | { label?: string; status: StatusKind });

/**
 * Status badge: tinted outline with a small tone dot and a visible label.
 * Distinct by design from the solid `SeverityChip`.
 */
export function StatusBadge({ tone, size = 'small', label, status }: StatusBadgeProps) {
  const resolvedTone = tone ?? (status === undefined ? 'neutral' : statusTone(status));
  const resolvedLabel = label ?? (status === undefined ? '' : statusLabel(status));
  const style = toneStyles[resolvedTone];
  return (
    <Chip
      variant="outlined"
      size={size}
      label={resolvedLabel}
      role="status"
      aria-label={resolvedLabel}
      data-tone={resolvedTone}
      icon={
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: style.fg,
          }}
        />
      }
      sx={{
        backgroundColor: style.bg,
        color: style.fg,
        borderColor: style.border,
        fontWeight: 600,
        '& .MuiChip-icon': { marginLeft: '8px', marginRight: '-2px' },
      }}
    />
  );
}

export interface ErrorSummaryItem {
  /** DOM id of the control the message belongs to. */
  id: string;
  message: string;
}

export interface ErrorSummaryProps {
  /** Plain heading, e.g. “Fix these details”. */
  title?: string;
  items: ErrorSummaryItem[];
  /** Focus/scroll the matching control; the summary is presentational. */
  onNavigate?(item: ErrorSummaryItem): void;
}

/**
 * Linked validation summary for long forms (UXA-04): every actionable error in
 * one place, each item linking to its field. Inline field errors remain the
 * primary description; this is the recovery path. The consumer focuses the
 * summary when a validation action fails (it must not steal focus merely by
 * appearing, e.g. after a field blur).
 */
export function ErrorSummary({
  title = 'Fix these details',
  items,
  onNavigate,
}: ErrorSummaryProps) {
  if (items.length === 0) return null;
  return (
    <Box
      role="alert"
      tabIndex={-1}
      data-testid="error-summary"
      sx={{
        border: `2px solid ${tokens.severity.critical}`,
        borderRadius: 2,
        backgroundColor: tokens.errorTint,
        padding: SPACING.lg,
        outline: 'none',
      }}
    >
      <Typography component="h2" variant="h3" sx={{ marginBottom: SPACING.sm }}>
        {title}
      </Typography>
      <Stack component="ul" spacing={SPACING.sm} sx={{ margin: 0, paddingLeft: SPACING.xl }}>
        {items.map((item) => (
          <li key={`${item.id}:${item.message}`}>
            <Link
              href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault();
                onNavigate?.(item);
              }}
              sx={{ color: tokens.severity.critical, fontWeight: 600, fontSize: 17 }}
            >
              {item.message}
            </Link>
          </li>
        ))}
      </Stack>
    </Box>
  );
}
