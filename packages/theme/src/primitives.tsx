import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import { FONT_MONO } from './fonts.js';
import { statusLabel, statusTone, toneStyles } from './status.js';
import type { StatusKind, Tone } from './status.js';
import { CARD_INSET, RADIUS } from './layout.js';
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

/** A titled form section with a quiet heading and a distinct field area. */
export function FormSection({ title, titleId, meta, children }: FormSectionProps) {
  return (
    <Card>
      <Box
        component="header"
        sx={{
          backgroundColor: tokens.surface,
          color: tokens.ink,
          borderBottom: `1px solid ${tokens.lineSoft}`,
          padding: { xs: `${SPACING.lg} ${SPACING.lg}`, sm: `${SPACING.lg} ${CARD_INSET}` },
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
          sx={{ color: tokens.ink, fontWeight: 600, outline: 'none' }}
        >
          {title}
        </Typography>
        {meta !== undefined && <Box sx={{ marginLeft: 'auto' }}>{meta}</Box>}
      </Box>
      <CardContent sx={{ padding: { xs: SPACING.lg, sm: CARD_INSET } }}>{children}</CardContent>
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
        borderRadius: RADIUS.control,
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
        borderRadius: RADIUS.control,
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

export interface PageHeaderProps {
  /** Small context label above the page title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned page actions. */
  actions?: ReactNode;
  /** Optional scope/meta line under the title. */
  meta?: ReactNode;
  /** Page destinations use h2 under the workspace h1; standalone pages use h1. */
  titleComponent?: 'h1' | 'h2';
  titleId?: string;
}

/**
 * The one page-heading pattern. It replaces repeated prose headers and gives
 * every destination the same title/action/scope alignment.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  titleComponent = 'h1',
  titleId,
}: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={SPACING.lg}
      sx={{
        alignItems: { md: 'flex-start' },
        justifyContent: 'space-between',
        gap: SPACING.lg,
        paddingBottom: SPACING.lg,
        borderBottom: `1px solid ${tokens.lineSoft}`,
      }}
    >
      <Stack spacing={SPACING.xs} sx={{ minWidth: 0 }}>
        {eyebrow !== undefined && (
          <Typography
            variant="overline"
            sx={{ color: tokens.muted, fontWeight: 600, letterSpacing: '0.12em' }}
          >
            {eyebrow}
          </Typography>
        )}
        <Typography
          component={titleComponent}
          variant="h1"
          {...(titleId === undefined ? {} : { id: titleId })}
          sx={{ margin: 0, color: tokens.ink }}
        >
          {title}
        </Typography>
        {meta !== undefined && (
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            {meta}
          </Typography>
        )}
        {description !== undefined && (
          <Typography variant="body2" sx={{ color: tokens.muted, maxWidth: '70ch' }}>
            {description}
          </Typography>
        )}
      </Stack>
      {actions !== undefined && (
        <Stack direction="row" spacing={SPACING.md} sx={{ flexWrap: 'wrap', rowGap: SPACING.sm }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  level?: 2 | 3;
}

/** A quieter section heading inside a page or card. */
export function SectionHeader({ title, description, actions, level = 2 }: SectionHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={SPACING.md}
      sx={{
        alignItems: { sm: 'flex-start' },
        justifyContent: 'space-between',
        gap: SPACING.md,
      }}
    >
      <Stack spacing={SPACING.xs} sx={{ minWidth: 0 }}>
        <Typography
          component={level === 2 ? 'h2' : 'h3'}
          variant={level === 2 ? 'h2' : 'h3'}
          sx={{ margin: 0 }}
        >
          {title}
        </Typography>
        {description !== undefined && (
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            {description}
          </Typography>
        )}
      </Stack>
      {actions !== undefined && (
        <Stack direction="row" spacing={SPACING.sm} sx={{ flexWrap: 'wrap', rowGap: SPACING.sm }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

export interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  badge?: ReactNode;
  tone?: Tone;
  loading?: boolean;
  testId?: string;
}

/** KPI tile with an honest unknown state: a skeleton, never a made-up zero. */
export function MetricCard({
  label,
  value,
  hint,
  badge,
  tone = 'neutral',
  loading = false,
  testId,
}: MetricCardProps) {
  const palette = toneStyles[tone];
  return (
    <Card
      data-testid={testId}
      aria-busy={loading}
      sx={{ minWidth: 0, flex: '1 1 150px', backgroundColor: tokens.surface }}
    >
      <CardContent sx={{ padding: SPACING.lg, '&:last-child': { paddingBottom: SPACING.lg } }}>
        <Stack spacing={SPACING.sm}>
          {badge !== undefined ? (
            <Box>{badge}</Box>
          ) : (
            <Stack direction="row" spacing={SPACING.sm} sx={{ alignItems: 'center' }}>
              <Box
                aria-hidden="true"
                sx={{ width: 7, height: 7, borderRadius: RADIUS.pill, backgroundColor: palette.fg }}
              />
              <Typography variant="caption" sx={{ color: tokens.muted, fontWeight: 600 }}>
                {label}
              </Typography>
            </Stack>
          )}
          {loading ? (
            <Skeleton variant="text" width={64} height={38} aria-hidden="true" />
          ) : (
            <Typography
              component="p"
              sx={{
                margin: 0,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 30,
                lineHeight: 1.05,
                fontWeight: 600,
                letterSpacing: '-0.03em',
                color: tokens.ink,
              }}
            >
              {value}
            </Typography>
          )}
          {hint !== undefined && (
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              {hint}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export interface DetailGridProps {
  children: ReactNode;
  /** Number of columns at wide widths; defaults to two. */
  columns?: 2 | 3;
  /** Keep two compact columns on phones for record context; defaults to one. */
  mobileColumns?: 1 | 2;
}

/** Stable label/value grid. Content width never determines alignment. */
export function DetailGrid({ children, columns = 2, mobileColumns = 1 }: DetailGridProps) {
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: mobileColumns === 2 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: columns === 3 ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
        },
        columnGap: SPACING.xl,
        rowGap: SPACING.lg,
        margin: 0,
      }}
    >
      {children}
    </Box>
  );
}

export interface DetailItemProps {
  label: ReactNode;
  value?: ReactNode;
  children?: ReactNode;
  mono?: boolean;
  /** Span all columns for prose such as remarks. */
  wide?: boolean;
}

export function DetailItem({
  label,
  value,
  children,
  mono = false,
  wide = false,
}: DetailItemProps) {
  const content = value ?? children ?? '—';
  return (
    <Box sx={{ minWidth: 0, gridColumn: wide ? '1 / -1' : undefined }}>
      <Typography component="dt" variant="caption" sx={{ color: tokens.muted, fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body1"
        sx={{
          margin: 0,
          marginTop: SPACING.xs,
          overflowWrap: 'anywhere',
          ...(mono ? { fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' } : {}),
        }}
      >
        {content}
      </Typography>
    </Box>
  );
}

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

/** Neutral empty/search/loading-failure recovery state. */
export function EmptyState({ title, description, action, compact = false }: EmptyStateProps) {
  return (
    <Box
      role="status"
      sx={{
        border: `1px dashed ${tokens.line}`,
        borderRadius: RADIUS.card,
        backgroundColor: tokens.surface,
        padding: compact ? SPACING.lg : SPACING.xxl,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.sm,
        alignItems: 'flex-start',
        maxWidth: 720,
      }}
    >
      <Typography component="h3" variant="h3">
        {title}
      </Typography>
      {description !== undefined && (
        <Typography variant="body2" sx={{ color: tokens.muted }}>
          {description}
        </Typography>
      )}
      {action !== undefined && <Box sx={{ marginTop: SPACING.sm }}>{action}</Box>}
    </Box>
  );
}

export interface RecordCardField {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
}

export interface RecordCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  fields?: RecordCardField[];
  actions?: ReactNode;
  testId?: string;
}

/** Shared compact record row for admin queues below the table breakpoint. */
export function RecordCard({
  title,
  subtitle,
  badge,
  fields = [],
  actions,
  testId,
}: RecordCardProps) {
  return (
    <Card component="article" data-testid={testId} sx={{ borderRadius: RADIUS.card }}>
      <CardContent sx={{ padding: SPACING.lg, '&:last-child': { paddingBottom: SPACING.lg } }}>
        <Stack spacing={SPACING.md}>
          <Stack direction="row" spacing={SPACING.md} sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h3" variant="h3" sx={{ overflowWrap: 'anywhere' }}>
                {title}
              </Typography>
              {subtitle !== undefined && (
                <Typography variant="body2" sx={{ color: tokens.muted, marginTop: SPACING.xs }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            {badge}
          </Stack>
          {fields.length > 0 && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: SPACING.md,
              }}
            >
              {fields.map((field) => (
                <Box key={String(field.label)} sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: tokens.muted }}>
                    {field.label}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      overflowWrap: 'anywhere',
                      ...(field.mono
                        ? { fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' }
                        : {}),
                    }}
                  >
                    {field.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          {actions !== undefined && (
            <Stack
              direction="row"
              spacing={SPACING.sm}
              sx={{ flexWrap: 'wrap', rowGap: SPACING.sm }}
            >
              {actions}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
