/**
 * @echallan/theme — shared MUI tokens and design-system primitives for the
 * tablet and admin apps.
 *
 * No MUI barrel is re-exported from here: consumers import exact component
 * paths from MUI and the shared surface from this package.
 */
export { FONT_MONO, FONT_SANS } from './fonts.js';
export { AppThemeProvider } from './AppThemeProvider.js';
export type { AppThemeProviderProps } from './AppThemeProvider.js';
export { createAppTheme, identifierStyle } from './createTheme.js';
export type { AppSurface, AppTheme, CreateAppThemeOptions } from './createTheme.js';
export { SPACING, SPACING_BASE, SPACING_PX, TOUCH_TARGET_MIN } from './touchTargets.js';
export {
  CARD_INSET,
  LIST_CARD_BREAKPOINT,
  NAV_RAIL_BREAKPOINT,
  PAGE_GUTTER,
  RADIUS,
} from './layout.js';
export type { RadiusToken } from './layout.js';
export type { Spacing, TouchTargetMin } from './touchTargets.js';
export { tokens } from './tokens.js';
export type { ThemeTokens } from './tokens.js';
export { challanStatusKind, statusLabel, statusTone, toneStyles } from './status.js';
export type { ChallanStatus, StatusKind, Tone, ToneStyle } from './status.js';
export { capturePwaInstallPrompt, isMobileOrTabletDevice, PwaInstallPrompt } from './pwaInstall.js';
export {
  DetailGrid,
  DetailItem,
  EmptyState,
  ErrorSummary,
  FormSection,
  MetricCard,
  Notice,
  PageHeader,
  RecordCard,
  SectionHeader,
  SeverityChip,
  StatusBadge,
} from './primitives.js';
export type {
  ErrorSummaryItem,
  ErrorSummaryProps,
  FormSectionProps,
  NoticeProps,
  DetailGridProps,
  DetailItemProps,
  EmptyStateProps,
  MetricCardProps,
  PageHeaderProps,
  RecordCardField,
  RecordCardProps,
  SectionHeaderProps,
  SeverityChipProps,
  StatusBadgeProps,
} from './primitives.js';
export { ActionButton } from './button.js';
export type { ActionButtonProps, ActionSize, ActionTone } from './button.js';
export { ToneDialogTitle } from './dialog.js';
export type { ToneDialogTone, ToneDialogTitleProps } from './dialog.js';
export { ToastProvider, useToast } from './toast.js';
export type { ToastAction, ToastContextValue, ToastOptions, ToastProviderProps } from './toast.js';
