import { createTheme } from '@mui/material/styles';
import { FONT_MONO, FONT_SANS } from './fonts.js';
import { SPACING, TOUCH_TARGET_MIN } from './touchTargets.js';
import { tokens } from './tokens.js';

/** Which product surface the theme is being built for. */
export type AppSurface = 'tablet' | 'admin';

export interface CreateAppThemeOptions {
  /**
   * The marshal tablet is used outdoors with gloved hands; the admin dashboard
   * is used at a desk. Typography and control sizing follow the surface.
   * Defaults to `tablet`, the harsher of the two conditions.
   */
  surface?: AppSurface;
  /** Stronger borders/text and a white canvas for outdoor use. */
  highContrast?: boolean;
}

/**
 * Mono is for identifiers only — challan numbers, vehicle registrations, gate
 * pass numbers, licence numbers — so a marshal reading a registration back to a
 * driver never has to distinguish 0/O or 1/I/l.
 */
export const identifierStyle = {
  fontFamily: FONT_MONO,
  fontWeight: 500,
  letterSpacing: '0.01em',
} as const;

/**
 * Shared theme for the tablet and admin apps (owner restyle B-09, 2026-10-17).
 *
 * Field-grade rules kept from the previous revision and the constitution:
 *  - statically labelled inputs, >=56px tablet controls, 12px adjacent gaps;
 *  - flat surfaces: borders and spacing carry the hierarchy, not shadows;
 *  - solid green is reserved for committing a challan; severity is a labelled
 *    solid chip; status is always labelled and outlined.
 *
 * The restyle deepens the navy chrome, raises text contrast, moves notices to
 * tinted surfaces and rounds the card system for a calmer field scan.
 */
export function createAppTheme(options: CreateAppThemeOptions = {}) {
  const surface = options.surface ?? 'tablet';
  const tablet = surface === 'tablet';
  const highContrast = options.highContrast === true;
  const line = highContrast ? '#5B6B82' : tokens.line;
  const lineSoft = highContrast ? '#8E9CAE' : tokens.lineSoft;
  const fieldLine = highContrast ? '#4E5D75' : tokens.fieldLine;
  const secondary = highContrast ? '#26364A' : tokens.muted;

  return createTheme({
    palette: {
      mode: 'light',
      primary: { main: tokens.blue, contrastText: tokens.surface },
      secondary: { main: tokens.navy },
      // Reserved for the commit action only.
      success: { main: tokens.green },
      warning: { main: tokens.metric.pending },
      error: { main: tokens.severity.critical },
      info: { main: tokens.blue },
      background: { default: highContrast ? tokens.surface : tokens.canvas, paper: tokens.surface },
      divider: lineSoft,
      text: { primary: highContrast ? '#000000' : tokens.ink, secondary },
    },

    typography: {
      fontFamily: FONT_SANS,
      h1: { fontSize: tablet ? 22 : 19, lineHeight: 1.25, fontWeight: 600 },
      h2: { fontSize: tablet ? 18 : 16, lineHeight: 1.3, fontWeight: 600 },
      h3: { fontSize: tablet ? 16 : 15, lineHeight: 1.3, fontWeight: 600 },
      body1: { fontSize: tablet ? 17 : 15, lineHeight: tablet ? 1.5 : 1.47 },
      body2: { fontSize: tablet ? 15 : 14, lineHeight: 1.45 },
      caption: { fontSize: tablet ? 14 : 12.5, lineHeight: 1.43 },
      button: { fontSize: tablet ? 17 : 15, fontWeight: 600, textTransform: 'none' },
    },

    shape: { borderRadius: 10 },

    components: {
      // Deep navy chrome with a blue baseline: the strongest scan anchor on the
      // screen and the highest-contrast surface for white heading text.
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: tokens.navy,
            borderBottom: `3px solid ${tokens.blue}`,
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: tablet ? 72 : 64,
            gap: SPACING.md,
            paddingLeft: SPACING.xl,
            paddingRight: SPACING.lg,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },

      // Dialogs use the same blue header language as cards and form sections,
      // instead of MUI's generic white title bar. The title/action padding and
      // surface border are consistent for every modal in both apps.
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${line}`,
            backgroundImage: 'none',
            overflow: 'hidden',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.blue,
            color: tokens.surface,
            padding: `${SPACING.md} ${SPACING.lg}`,
            fontSize: tablet ? 18 : 16,
            fontWeight: 600,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: SPACING.lg,
            backgroundColor: tokens.surface,
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: `${SPACING.md} ${SPACING.lg}`,
            borderTop: `1px solid ${tokens.lineSoft}`,
          },
        },
      },

      MuiButtonBase: {
        styleOverrides: {
          root: {
            '&:focus-visible, &.Mui-focusVisible': {
              outline: `3px solid ${tokens.blue}`,
              outlineOffset: 2,
              boxShadow: '0 0 0 6px rgba(255,255,255,0.95)',
            },
          },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: tablet
              ? TOUCH_TARGET_MIN.tabletSecondaryAction
              : TOUCH_TARGET_MIN.desktopAction,
            minWidth: tablet ? TOUCH_TARGET_MIN.interactive : undefined,
            borderRadius: 10,
            paddingLeft: SPACING.xl,
            paddingRight: SPACING.xl,
            '&:focus-visible, &.Mui-focusVisible': {
              outline: `3px solid ${tokens.blue}`,
              outlineOffset: 2,
              boxShadow: '0 0 0 6px rgba(255,255,255,0.95)',
            },
          },
          sizeSmall: {
            minHeight: tablet
              ? TOUCH_TARGET_MIN.tabletSecondaryAction
              : TOUCH_TARGET_MIN.desktopAction,
            paddingLeft: SPACING.md,
            paddingRight: SPACING.md,
            fontSize: tablet ? 16 : 14,
          },
          sizeLarge: {
            minHeight: tablet
              ? TOUCH_TARGET_MIN.tabletPrimaryAction
              : TOUCH_TARGET_MIN.desktopAction,
            paddingLeft: SPACING.xxl,
            paddingRight: SPACING.xxl,
            fontSize: tablet ? 18 : 15,
          },
          text: {
            paddingLeft: SPACING.md,
            paddingRight: SPACING.md,
          },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            '&:focus-visible, &.Mui-focusVisible': {
              outline: `3px solid ${tokens.blue}`,
              outlineOffset: -3,
              backgroundColor: tokens.tint,
            },
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            minWidth: TOUCH_TARGET_MIN.interactive,
            minHeight: TOUCH_TARGET_MIN.interactive,
            borderRadius: 10,
          },
        },
      },

      // Card system: flat bordered surfaces; the blue header bar carries the
      // section identity.
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${line}`,
            borderRadius: 12,
            overflow: 'hidden',
          },
        },
      },
      MuiCardHeader: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.blue,
            color: tokens.surface,
            padding: `${SPACING.md} ${SPACING.lg}`,
            borderRadius: '11px 11px 0 0',
          },
          title: { color: tokens.surface, fontWeight: 600, fontSize: tablet ? 18 : 16 },
          subheader: { color: tokens.surface },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: SPACING.lg },
        },
      },

      // Native selects: explicit IBM Plex Sans and a fixed border-box height so
      // the control matches the 56px text fields exactly (padding from the
      // OutlinedInput slot composes inside the height).
      MuiNativeSelect: {
        styleOverrides: {
          select: {
            height: tablet ? TOUCH_TARGET_MIN.tabletInput : TOUCH_TARGET_MIN.desktopInput,
            boxSizing: 'border-box',
            fontFamily: FONT_SANS,
            fontSize: tablet ? 17 : 15,
            color: tokens.ink,
          },
          icon: { color: tokens.muted },
        },
      },

      // Large labelled checkbox rows for a gloved hand.
      MuiFormControlLabel: {
        styleOverrides: {
          root: {
            marginLeft: 0,
            marginRight: 0,
            minHeight: tablet ? TOUCH_TARGET_MIN.tabletCheckBoxRow : undefined,
            marginTop: tablet ? SPACING.sm : undefined,
            marginBottom: tablet ? SPACING.sm : undefined,
            gap: SPACING.md,
            borderRadius: 10,
            paddingLeft: SPACING.sm,
            paddingRight: SPACING.sm,
            '&:hover': { backgroundColor: tokens.hover },
          },
          label: { fontSize: tablet ? 17 : 15 },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            padding: tablet ? SPACING.md : SPACING.sm,
            minWidth: tablet ? TOUCH_TARGET_MIN.tabletCheckBoxRow : undefined,
            minHeight: tablet ? TOUCH_TARGET_MIN.tabletCheckBoxRow : undefined,
            color: tokens.muted,
            '&.Mui-checked': { color: tokens.blue },
          },
        },
      },

      MuiOutlinedInput: {
        // The label sits above the field, so the fieldset must not cut a notch
        // for it.
        defaultProps: { notched: false },
        styleOverrides: {
          root: {
            minHeight: tablet ? TOUCH_TARGET_MIN.tabletInput : TOUCH_TARGET_MIN.desktopInput,
            backgroundColor: tokens.surface,
            borderRadius: 10,
            '& fieldset': { borderColor: fieldLine, borderWidth: highContrast ? 2 : 1 },
            '&:hover fieldset': { borderColor: tokens.muted },
            '&.Mui-focused fieldset': { borderColor: tokens.blue, borderWidth: 2 },
            // InputBase sets `outline: 0`, so the global focus ring needs a more
            // specific rule; the focus indicator is a release gate, not decoration.
            '& .MuiOutlinedInput-input:focus': {
              outline: `3px solid ${tokens.blue}`,
              outlineOffset: 2,
            },
          },
          input: {
            fontSize: tablet ? 17 : 15,
            // Keep the input element itself >= 56px tall on tablet: the root
            // minHeight alone is not enough because the release gate measures
            // the input element (UI-01 touch target).
            padding: '16.5px 12px',
          },
        },
      },

      // Static labels above the field, always visible. Floating labels animate
      // into the border and vanish under glare.
      MuiInputLabel: {
        defaultProps: { shrink: true },
        styleOverrides: {
          root: {
            position: 'static',
            transform: 'none',
            fontSize: tablet ? 15 : 13,
            fontWeight: 600,
            color: tokens.ink,
            marginBottom: 6,
          },
        },
      },

      MuiFormHelperText: {
        styleOverrides: {
          root: {
            fontSize: tablet ? 15 : 13,
            marginLeft: 0,
            marginTop: 6,
          },
        },
      },

      // Persistent notices on a tinted surface with an outline; the green fill
      // stays reserved for the challan commit action.
      MuiAlert: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            borderRadius: 10,
            alignItems: 'center',
            padding: `${SPACING.md} ${SPACING.lg}`,
            borderWidth: 1,
          },
          message: { padding: 0, fontSize: tablet ? 16 : 14 },
          icon: { marginRight: SPACING.md, paddingTop: 0 },
        },
      },

      MuiChip: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 8 },
          label: { fontSize: tablet ? 15 : 13 },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: { paddingBlock: 10, borderColor: tokens.lineSoft },
          head: { backgroundColor: tokens.navy, color: tokens.surface, fontWeight: 600 },
        },
      },

      MuiTableSortLabel: {
        styleOverrides: {
          root: {
            color: 'inherit',
            '&.Mui-active': { color: 'inherit' },
            '&:hover': { color: 'inherit' },
            '&:focus-visible': { outline: `3px solid ${tokens.surface}`, outlineOffset: 2 },
          },
        },
      },

      MuiDivider: {
        styleOverrides: { root: { borderColor: lineSoft } },
      },

      MuiCssBaseline: {
        styleOverrides: {
          ':focus-visible': { outline: `3px solid ${tokens.blue}`, outlineOffset: 2 },
          '@media (prefers-reduced-motion: reduce)': {
            '*': {
              animationDuration: '0.01ms !important',
              transitionDuration: '0.01ms !important',
            },
          },
        },
      },
    },
  });
}

export type AppTheme = ReturnType<typeof createAppTheme>;
