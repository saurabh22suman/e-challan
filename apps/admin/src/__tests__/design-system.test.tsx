import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '@mui/material/Button';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ActionButton,
  Notice,
  StatusBadge,
  ToastProvider,
  ToneDialogTitle,
  challanStatusKind,
  statusLabel,
  statusTone,
  tokens,
  toneStyles,
  useToast,
} from '@echallan/theme';
import type { ChallanStatus, StatusKind, Tone } from '@echallan/theme';

/**
 * Design-system contract for docs/design.md §3.3 and §4: tone contrast, status
 * mapping, tone-aware badges/notices, transient toasts and consequence-aware
 * dialog headers. Component behaviour only; screen migration is separate.
 */

const TONES: Tone[] = ['neutral', 'info', 'success', 'warning', 'danger', 'cancelled'];

const ALL_STATUS_KINDS: StatusKind[] = [
  'active',
  'deactivated',
  'issued',
  'under_review',
  'resolved',
  'cancelled',
  'online',
  'offline',
  'draft',
  'sending',
  'send_failed',
];

const STATUS_CASES: Array<{ kind: StatusKind; tone: Tone; label: string }> = [
  { kind: 'active', tone: 'success', label: 'Active' },
  { kind: 'deactivated', tone: 'neutral', label: 'Deactivated' },
  { kind: 'issued', tone: 'info', label: 'Issued' },
  { kind: 'under_review', tone: 'warning', label: 'Under Review' },
  { kind: 'resolved', tone: 'success', label: 'Resolved' },
  { kind: 'cancelled', tone: 'cancelled', label: 'Cancelled' },
  { kind: 'online', tone: 'success', label: 'Online' },
  { kind: 'offline', tone: 'warning', label: 'Offline' },
  { kind: 'draft', tone: 'info', label: 'Draft' },
  { kind: 'sending', tone: 'info', label: 'Sending' },
  { kind: 'send_failed', tone: 'danger', label: 'Send failed' },
];

const CHALLAN_CASES: Array<{
  status: ChallanStatus;
  kind: StatusKind;
  tone: Tone;
  label: string;
}> = [
  { status: 'Issued', kind: 'issued', tone: 'info', label: 'Issued' },
  { status: 'Under Review', kind: 'under_review', tone: 'warning', label: 'Under Review' },
  { status: 'Resolved', kind: 'resolved', tone: 'success', label: 'Resolved' },
  { status: 'Cancelled', kind: 'cancelled', tone: 'cancelled', label: 'Cancelled' },
];

const BADGE_CASES: Array<{ status: StatusKind; label: string; tone: Tone }> = [
  { status: 'active', label: 'Active', tone: 'success' },
  { status: 'deactivated', label: 'Deactivated', tone: 'neutral' },
  { status: 'issued', label: 'Issued', tone: 'info' },
  { status: 'under_review', label: 'Under Review', tone: 'warning' },
  { status: 'resolved', label: 'Resolved', tone: 'success' },
  { status: 'cancelled', label: 'Cancelled', tone: 'cancelled' },
];

function channel(hex: string, offset: number): number {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function ToastHarness() {
  const { showToast } = useToast();
  return (
    <>
      <Button
        onClick={() =>
          showToast({
            tone: 'success',
            title: 'User reactivated',
            description: 'Farah Ansari can sign in again.',
          })
        }
      >
        Show success toast
      </Button>
      <Button onClick={() => showToast({ tone: 'danger', title: 'Export failed' })}>
        Show danger toast
      </Button>
    </>
  );
}

afterEach(() => {
  cleanup();
});

describe('semantic tone tokens', () => {
  it.each(TONES)('%s text meets AA contrast on its tinted background', (tone) => {
    const style = toneStyles[tone];
    expect(contrastRatio(style.fg, style.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('status mapping', () => {
  it('assigns a tone and label to every StatusKind', () => {
    expect(STATUS_CASES.map(({ kind }) => kind).sort()).toStrictEqual([...ALL_STATUS_KINDS].sort());

    for (const { kind, tone, label } of STATUS_CASES) {
      expect(statusTone(kind)).toBe(tone);
      expect(statusLabel(kind)).toBe(label);
    }
  });

  it('maps every challan status string to its semantic kind', () => {
    for (const { status, kind, tone, label } of CHALLAN_CASES) {
      const resolvedKind = challanStatusKind(status);
      expect(resolvedKind).toBe(kind);
      expect(statusTone(resolvedKind)).toBe(tone);
      expect(statusLabel(resolvedKind)).toBe(label);
    }
  });
});

describe('StatusBadge', () => {
  it('renders the labelled, toned admin and challan states', () => {
    render(
      <>
        {BADGE_CASES.map(({ status }) => (
          <StatusBadge key={status} status={status} />
        ))}
      </>,
    );

    for (const { label, tone } of BADGE_CASES) {
      const badge = screen.getByRole('status', { name: label });
      expect(badge).toHaveAttribute('data-tone', tone);
      expect(within(badge).getByText(label)).toBeInTheDocument();
    }
  });
});

describe('Notice', () => {
  it('applies the requested tone and maps legacy severity to a tone', () => {
    render(
      <>
        <Notice tone="cancelled" role="status">
          Challan cancelled by an administrator.
        </Notice>
        <Notice severity="error" role="alert">
          Could not load the account.
        </Notice>
      </>,
    );

    const cancelled = screen.getByRole('status');
    expect(cancelled).toHaveAttribute('data-tone', 'cancelled');
    expect(cancelled).toHaveStyle({
      backgroundColor: toneStyles.cancelled.bg,
      color: toneStyles.cancelled.fg,
    });

    const error = screen.getByRole('alert');
    expect(error).toHaveAttribute('data-tone', 'danger');
    expect(error).toHaveStyle({
      backgroundColor: toneStyles.danger.bg,
      color: toneStyles.danger.fg,
    });
  });
});

describe('ActionButton', () => {
  it('maps semantic tones to the approved MUI emphasis and colour', () => {
    const { rerender } = render(<ActionButton tone="primary">Primary</ActionButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('MuiButton-contained');

    rerender(<ActionButton tone="secondary">Secondary</ActionButton>);
    expect(button).toHaveClass('MuiButton-outlined');

    rerender(<ActionButton tone="ghost">Ghost</ActionButton>);
    expect(button).toHaveClass('MuiButton-text');

    rerender(<ActionButton tone="danger">Danger</ActionButton>);
    expect(button).toHaveClass('MuiButton-outlined', 'MuiButton-colorError');

    rerender(<ActionButton tone="danger-solid">Confirm</ActionButton>);
    expect(button).toHaveClass('MuiButton-contained', 'MuiButton-colorError');

    rerender(<ActionButton tone="commit">Commit</ActionButton>);
    expect(button).toHaveClass('MuiButton-contained', 'MuiButton-colorSuccess');
  });

  it('disables the action and exposes the loading label', () => {
    render(
      <ActionButton loading loadingLabel="Saving…">
        Save
      </ActionButton>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });
});

describe('ToastProvider', () => {
  it('shows a toast and dismisses it from the dismiss control', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Show success toast' }));

    const toast = await screen.findByRole('status');
    expect(within(toast).getByText('User reactivated')).toBeInTheDocument();
    expect(within(toast).getByText('Farah Ansari can sign in again.')).toBeInTheDocument();
    expect(toast).toHaveAttribute('data-tone', 'success');

    await user.click(within(toast).getByRole('button', { name: 'Dismiss notification' }));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('uses the alert role for a danger toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Show danger toast' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Export failed')).toBeInTheDocument();
    expect(alert).toHaveAttribute('data-tone', 'danger');
  });
});

describe('ToneDialogTitle', () => {
  it('renders the default, warning and danger headers with passed-through props', () => {
    render(
      <>
        <ToneDialogTitle component="h2" id="default-dialog-title">
          Cancel challan
        </ToneDialogTitle>
        <ToneDialogTitle component="h2" tone="warning">
          Review required
        </ToneDialogTitle>
        <ToneDialogTitle component="h2" tone="danger">
          Deactivate user
        </ToneDialogTitle>
      </>,
    );

    const defaultTitle = screen.getByRole('heading', { name: 'Cancel challan' });
    const warningTitle = screen.getByRole('heading', { name: 'Review required' });
    const dangerTitle = screen.getByRole('heading', { name: 'Deactivate user' });

    expect(defaultTitle).toHaveAttribute('id', 'default-dialog-title');
    expect(defaultTitle).toHaveAttribute('data-tone', 'default');
    expect(defaultTitle).toHaveStyle({
      backgroundColor: tokens.blue,
      color: tokens.surface,
    });
    expect(warningTitle).toHaveAttribute('data-tone', 'warning');
    expect(warningTitle).toHaveStyle({
      backgroundColor: toneStyles.warning.fg,
      color: tokens.surface,
    });
    expect(dangerTitle).toHaveAttribute('data-tone', 'danger');
    expect(dangerTitle).toHaveStyle({
      backgroundColor: toneStyles.danger.fg,
      color: tokens.surface,
    });
  });
});
