import { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import type { SnackbarCloseReason } from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import { toneStyles } from './status.js';
import type { Tone } from './status.js';
import { SPACING, TOUCH_TARGET_MIN } from './touchTargets.js';

/**
 * Shared transient feedback. One toast is visible; a newer completed action
 * replaces it so feedback for the latest action is never stuck behind an older
 * toast. Field validation stays inline — a toast is only for completed actions.
 */

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  tone: Tone;
  title: string;
  description?: string;
  action?: ToastAction;
  /**
   * Override the tone default. `0` keeps the toast visible until dismissed;
   * otherwise the value is milliseconds.
   */
  duration?: number;
}

export interface ToastProviderProps {
  children: ReactNode;
}

export interface ToastContextValue {
  showToast(options: ToastOptions): void;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** success/info 5s, warning 8s, danger 10s; neutral/cancelled follow info. */
const DEFAULT_DURATION: Record<Tone, number> = {
  neutral: 5000,
  info: 5000,
  success: 5000,
  warning: 8000,
  danger: 10000,
  cancelled: 5000,
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const baseId = useId();

  const dismiss = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    const item: ToastItem = { ...options, id: nextId.current };
    // Replace rather than queue: rapid actions must show the latest result
    // immediately, not wait behind an older success toast.
    setQueue([item]);
  }, []);

  const api = useMemo(() => ({ showToast }), [showToast]);
  const current = queue[0];

  const handleClose = useCallback(
    (event: unknown, reason: SnackbarCloseReason) => {
      // Ignore click-away: only an explicit control, Escape or the timer closes.
      void event;
      if (reason !== 'clickaway') dismiss();
    },
    [dismiss],
  );

  const duration = current === undefined ? 0 : (current.duration ?? DEFAULT_DURATION[current.tone]);
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current !== undefined && (
        // MUI Snackbar owns the auto-hide timer and pauses it on hover/focus,
        // clearing it when the current toast unmounts.
        <Snackbar
          key={current.id}
          open
          autoHideDuration={duration > 0 ? duration : null}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Box
            role={current.tone === 'danger' ? 'alert' : 'status'}
            aria-labelledby={titleId}
            aria-atomic="true"
            data-tone={current.tone}
            {...(current.description === undefined ? {} : { 'aria-describedby': descriptionId })}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: SPACING.md,
              width: '100%',
              maxWidth: 520,
              backgroundColor: toneStyles[current.tone].bg,
              color: toneStyles[current.tone].fg,
              border: `1px solid ${toneStyles[current.tone].border}`,
              borderRadius: '12px',
              padding: SPACING.md,
              boxShadow: 4,
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 10,
                height: 10,
                marginTop: '6px',
                flex: '0 0 auto',
                borderRadius: '50%',
                backgroundColor: toneStyles[current.tone].fg,
              }}
            />
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
              <Typography
                id={titleId}
                component="p"
                variant="body1"
                sx={{ fontWeight: 700, lineHeight: 1.35 }}
              >
                {current.title}
              </Typography>
              {current.description !== undefined && (
                <Typography
                  id={descriptionId}
                  component="p"
                  variant="body2"
                  sx={{ marginTop: '2px' }}
                >
                  {current.description}
                </Typography>
              )}
            </Box>
            {current.action !== undefined && (
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  current.action?.onClick();
                  dismiss();
                }}
                sx={{
                  color: 'inherit',
                  fontWeight: 700,
                  flex: '0 0 auto',
                  minHeight: TOUCH_TARGET_MIN.interactive,
                }}
              >
                {current.action.label}
              </Button>
            )}
            <Button
              size="small"
              variant="text"
              aria-label="Dismiss notification"
              onClick={dismiss}
              sx={{
                color: 'inherit',
                minWidth: TOUCH_TARGET_MIN.interactive,
                minHeight: TOUCH_TARGET_MIN.interactive,
                padding: 0,
                fontSize: 20,
                lineHeight: 1,
                flex: '0 0 auto',
              }}
            >
              ×
            </Button>
          </Box>
        </Snackbar>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used inside a ToastProvider.');
  }
  return context;
}
