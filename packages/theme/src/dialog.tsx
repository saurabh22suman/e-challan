import DialogTitle from '@mui/material/DialogTitle';
import type { DialogTitleProps } from '@mui/material/DialogTitle';
import { toneStyles } from './status.js';
import { tokens } from './tokens.js';

/**
 * Dialog header chosen by the consequence of the action, not by the current
 * status of the object. Default keeps the existing blue header; warning and
 * danger use a solid dark tone with white text so a destructive confirmation is
 * unmistakable before the user reaches its confirm button.
 */

export type ToneDialogTone = 'default' | 'warning' | 'danger';

export interface ToneDialogTitleProps extends DialogTitleProps {
  tone?: ToneDialogTone;
}

const TONE_BACKGROUND: Record<ToneDialogTone, string> = {
  default: tokens.blue,
  warning: toneStyles.warning.fg,
  danger: toneStyles.danger.fg,
};

export function ToneDialogTitle({ tone = 'default', sx, ...props }: ToneDialogTitleProps) {
  const base = {
    backgroundColor: TONE_BACKGROUND[tone],
    color: tokens.surface,
    fontWeight: 600,
  };
  const mergedSx = sx === undefined ? base : Array.isArray(sx) ? [base, ...sx] : [base, sx];

  return <DialogTitle {...props} data-tone={tone} sx={mergedSx} />;
}
