import type { ReactNode } from 'react';
import Button from '@mui/material/Button';
import type { ButtonProps } from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

/**
 * Shared action button.
 *
 * Screens choose a semantic tone and density, never a raw MUI variant/colour
 * combination. The global MuiButton theme owns heights, radius, padding and
 * focus; this wrapper owns emphasis and loading state.
 *
 * Tones:
 *  - primary: the one main action in a view (blue, contained)
 *  - secondary: supporting actions (outlined)
 *  - ghost: table/row/close/retry actions (text)
 *  - danger: destructive trigger (outlined red)
 *  - danger-solid: final destructive confirmation (contained red)
 *  - commit: the challan commit action only (contained green)
 */

export type ActionTone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid' | 'commit';

export type ActionSize = 'sm' | 'md' | 'lg';

export interface ActionButtonProps extends Omit<ButtonProps, 'variant' | 'color' | 'size'> {
  tone?: ActionTone;
  size?: ActionSize;
  loading?: boolean;
  loadingLabel?: ReactNode;
}

const TONE_PROPS: Record<ActionTone, Pick<ButtonProps, 'variant' | 'color'>> = {
  primary: { variant: 'contained' },
  secondary: { variant: 'outlined' },
  ghost: { variant: 'text' },
  danger: { variant: 'outlined', color: 'error' },
  'danger-solid': { variant: 'contained', color: 'error' },
  commit: { variant: 'contained', color: 'success' },
};

const SIZE_PROPS: Record<ActionSize, 'small' | 'medium' | 'large'> = {
  sm: 'small',
  md: 'medium',
  lg: 'large',
};

/** Solid actions are one size larger on the tablet; admin heights stay uniform. */
function defaultSize(tone: ActionTone): ActionSize {
  return tone === 'primary' || tone === 'danger-solid' || tone === 'commit' ? 'lg' : 'md';
}

export function ActionButton({
  tone = 'primary',
  size,
  loading = false,
  loadingLabel,
  children,
  disabled,
  ...props
}: ActionButtonProps) {
  return (
    <Button
      {...props}
      {...TONE_PROPS[tone]}
      size={SIZE_PROPS[size ?? defaultSize(tone)]}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <CircularProgress size={18} sx={{ color: 'inherit', mr: 1 }} aria-hidden />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
