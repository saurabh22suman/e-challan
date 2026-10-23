/**
 * @echallan/theme — shared MUI tokens for the tablet and admin apps.
 *
 * Foundation subset only. The full design system is F-04. No MUI barrel is
 * re-exported from here: consumers import exact component paths from MUI and
 * the shared surface from this package.
 */
export { FONT_MONO, FONT_SANS } from './fonts.js';
export { AppThemeProvider } from './AppThemeProvider.js';
export type { AppThemeProviderProps } from './AppThemeProvider.js';
export { createAppTheme, identifierStyle } from './createTheme.js';
export type { AppSurface, AppTheme, CreateAppThemeOptions } from './createTheme.js';
export { SPACING, SPACING_BASE, SPACING_PX, TOUCH_TARGET_MIN } from './touchTargets.js';
export type { Spacing, TouchTargetMin } from './touchTargets.js';
export { tokens } from './tokens.js';
export type { ThemeTokens } from './tokens.js';
export { ErrorSummary, FormSection, Notice, SeverityChip, StatusChip } from './primitives.js';
export type {
  ErrorSummaryItem,
  ErrorSummaryProps,
  FormSectionProps,
  NoticeProps,
  SeverityChipProps,
  StatusChipProps,
} from './primitives.js';
