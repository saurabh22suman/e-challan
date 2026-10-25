import { createTheme } from '@mui/material/styles';
import { FONT_MONO, FONT_SANS } from './fonts.js';
import { CARD_INSET, RADIUS } from './layout.js';
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
      h1: {
        fontSize: tablet ? 28 : 30,
        lineHeight: 1.18,
        fontWeight: 600,
        letterSpacing: '-0.03em',
      },
      h2: {
        fontSize: tablet ? 20 : 20,
        lineHeight: 1.3,
        fontWeight: 600,
        letterSpacing: '-0.012em',
      },
      h3: { fontSize: tablet ? 16 : 15, lineHeight: 1.35, fontWeight: 600 },
      body1: { fontSize: tablet ? 17 : 15, lineHeight: tablet ? 1.5 : 1.47 },
      body2: { fontSize: tablet ? 15 : 14, lineHeight: 1.45 },
      caption: { fontSize: tablet ? 14 : 12.5, lineHeight: 1.43 },
      overline: { fontSize: 11.5, lineHeight: 1.4, fontWeight: 600, letterSpacing: '0.12em' },
      button: {
        fontSize: tablet ? 16 : 14,
        fontWeight: 600,
        textTransform: 'none',
        letterSpacing: 0,
      },
    },

    shape: { borderRadius: 10 },

    components: {
      // Navy chrome anchors the workspace; content headings use quieter surfaces.
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
            minHeight: tablet ? 68 : 64,
            gap: SPACING.md,
            paddingLeft: CARD_INSET,
            paddingRight: CARD_INSET,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },

      // Quiet headings keep content and consequence-aware actions in focus.
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: RADIUS.card,
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
            borderBottom: 'none',
            padding: `20px ${CARD_INSET}`,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.012em',
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: CARD_INSET,
            backgroundColor: tokens.surface,
            '@media (max-width:599.95px)': { padding: SPACING.lg },
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: `${SPACING.lg} ${CARD_INSET}`,
            gap: SPACING.sm,
            '@media (max-width:599.95px)': { padding: `${SPACING.md} ${SPACING.lg}` },
            borderTop: `1px solid ${tokens.lineSoft}`,
            backgroundColor: tokens.surface,
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
            borderRadius: RADIUS.control,
            paddingLeft: tablet ? SPACING.xl : '18px',
            paddingRight: tablet ? SPACING.xl : '18px',
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
            fontSize: tablet ? 17 : 14,
          },
          text: {
            paddingLeft: SPACING.md,
            paddingRight: SPACING.md,
          },
        },
      },

      MuiTabs: {
        defaultProps: { variant: 'scrollable', scrollButtons: 'auto' },
        styleOverrides: {
          root: { borderBottom: `1px solid ${line}`, minHeight: 48 },
          vertical: { borderBottom: 'none', borderRight: `1px solid ${lineSoft}`, minWidth: 208 },
          indicator: { height: 3, borderRadius: '3px 3px 0 0' },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontSize: 14,
            fontWeight: 500,
            minHeight: 44,
            paddingInline: 16,
            alignItems: 'flex-start',
            textAlign: 'left',
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
            minWidth: TOUCH_TARGET_MIN.desktopAction,
            minHeight: TOUCH_TARGET_MIN.desktopAction,
            borderRadius: RADIUS.control,
          },
        },
      },

      // Flat content surfaces with clear typographic section headings.
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${line}`,
            borderRadius: RADIUS.card,
            overflow: 'hidden',
          },
        },
      },
      MuiCardHeader: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.surface,
            color: tokens.ink,
            borderBottom: `1px solid ${lineSoft}`,
            padding: `18px ${CARD_INSET}`,
            borderRadius: '11px 11px 0 0',
            '@media (max-width:599.95px)': { padding: `${SPACING.md} ${SPACING.lg}` },
          },
          title: { color: tokens.ink, fontWeight: 600, fontSize: 20, letterSpacing: '-0.012em' },
          subheader: { color: secondary, marginTop: 4 },
          action: { alignSelf: 'center', margin: 0 },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: CARD_INSET,
            '&:last-child': { paddingBottom: CARD_INSET },
            '@media (max-width:599.95px)': {
              padding: SPACING.lg,
              '&:last-child': { paddingBottom: SPACING.lg },
            },
          },
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
            borderRadius: RADIUS.control,
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
            borderRadius: RADIUS.control,
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
            // Keep the input element itself at the shared control height on
            // tablet: the release gate and the visual grid both measure it.
            // Desk controls stay at 44px; multiline inputs keep natural height.
            height: tablet ? TOUCH_TARGET_MIN.tabletInput : TOUCH_TARGET_MIN.desktopInput,
            boxSizing: 'border-box',
            padding: tablet ? '15.5px 12px' : '10px 12px',
            '&.MuiInputBase-inputMultiline': {
              height: 'auto',
              minHeight: tablet ? TOUCH_TARGET_MIN.tabletInput : TOUCH_TARGET_MIN.desktopInput,
              padding: tablet ? '14px 12px' : '10px 12px',
            },
          },
          sizeSmall: {
            minHeight: tablet ? TOUCH_TARGET_MIN.tabletInput : TOUCH_TARGET_MIN.desktopInput,
            '& .MuiOutlinedInput-input': {
              height: tablet ? TOUCH_TARGET_MIN.tabletInput : TOUCH_TARGET_MIN.desktopInput,
              padding: tablet ? '15.5px 12px' : '10px 12px',
            },
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
            borderRadius: RADIUS.control,
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
          root: { fontWeight: 600, borderRadius: RADIUS.chip, height: 28 },
          label: { fontSize: tablet ? 15 : 13 },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: {
            paddingBlock: 11,
            paddingInline: tablet ? 16 : 14,
            fontSize: tablet ? 15 : 13.5,
            borderColor: tokens.lineSoft,
          },
          head: {
            backgroundColor: tokens.canvas,
            color: tokens.muted,
            fontWeight: 600,
            fontSize: tablet ? 13 : 12,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          },
        },
      },

      MuiTableSortLabel: {
        styleOverrides: {
          root: {
            color: 'inherit',
            '&.Mui-active': { color: 'inherit' },
            '&:hover': { color: 'inherit' },
            '&:focus-visible': { outline: `3px solid ${tokens.blue}`, outlineOffset: 2 },
          },
        },
      },

      MuiToggleButton: {
        styleOverrides: {
          root: {
            minHeight: TOUCH_TARGET_MIN.desktopAction,
            borderRadius: RADIUS.control,
            textTransform: 'none',
            fontWeight: 600,
            color: tokens.muted,
            borderColor: line,
            '&.Mui-selected': {
              color: tokens.blue,
              backgroundColor: tokens.tint,
              borderColor: tokens.blue,
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: RADIUS.control, border: `1px solid ${line}`, marginTop: 4 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { minHeight: tablet ? 48 : 38, fontSize: tablet ? 16 : 14 },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: { backgroundColor: 'rgba(68, 82, 104, 0.12)', borderRadius: '4px' },
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
