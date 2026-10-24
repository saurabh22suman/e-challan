/**
 * Colour tokens for the pilot UI revision (owner decision B-09, 2026-10-17).
 *
 * The palette keeps the concept mockup's trust-blue family but is tuned for the
 * field: a deeper navy chrome, a stronger primary blue, higher-contrast text and
 * a cooler light canvas. The green `commit` token is reserved for the button
 * that commits a challan; nothing else in the product may be filled green.
 *
 * Contrast targets (checked in tests and by hand): body text on surface >= 7:1,
 * white on navy >= 7:1, white on blue >= 4.5:1, UI borders >= 3:1.
 */
export const tokens = {
  /** App chrome: app bar, headers. Contrast with white >= 12:1. */
  navy: '#0B2E5C',
  /** Primary actions. Contrast with white text >= 7.6:1. */
  blue: '#0A4FAF',
  /** Reserved for the challan commit action only (kept at the accepted value). */
  green: '#157A3E',
  /** Soft primary tint for hover/selected surfaces. */
  tint: '#E8F0FC',
  /** Tinted success surface for confirmation notices. */
  successTint: '#E7F4EC',
  /** Tinted warning surface for occurrence/duplicate notices. */
  warningTint: '#FCF1E1',
  /** Tinted error surface for validation failures. */
  errorTint: '#FCEBEC',
  surface: '#FFFFFF',
  canvas: '#F2F5FA',
  line: '#C9D4E2',
  /** Interactive field boundary; >= 3:1 against white and canvas. */
  fieldLine: '#7E8EA6',
  lineSoft: '#E3EAF3',
  ink: '#0E1D33',
  muted: '#445268',
  /** Dark neutral media well (camera preview); not a text surface. */
  mediaSurface: '#0B1220',
  /** Translucent chrome/text values used on the navy app bar. */
  onNavy: {
    strong: 'rgba(255,255,255,0.85)',
    muted: 'rgba(255,255,255,0.65)',
    subtitle: 'rgba(255,255,255,0.78)',
    border: 'rgba(255,255,255,0.55)',
    hover: 'rgba(255,255,255,0.08)',
  },
  /** Candidate-value surface inside the registry dropdown. */
  hover: '#EDF3FC',
  metric: {
    total: '#0B57C4',
    pending: '#E07B24',
    resolved: '#157A3E',
    period: '#5B3FD1',
  },
  /**
   * Semantic status tones (docs/design.md §3.3). `fg` is the accessible
   * text/icon colour on `bg`; `border` is the visible tinted outline. These are
   * tint/outline surfaces only — solid green stays reserved for the challan
   * commit action, and severity keeps its separate solid chips.
   */
  tone: {
    neutral: { bg: '#F2F5FA', fg: '#445268', border: '#C9D4E2' },
    info: { bg: '#E8F0FC', fg: '#08408D', border: '#9CBEF0' },
    success: { bg: '#E7F4EC', fg: '#0F5D2F', border: '#9BCDAE' },
    warning: { bg: '#FCF1E1', fg: '#7A4A00', border: '#E3C08A' },
    danger: { bg: '#FCEBEC', fg: '#7E1017', border: '#E7A6AA' },
    cancelled: { bg: '#FBEFF3', fg: '#7A1F3A', border: '#D8A7B8' },
  },
  severity: {
    minor: '#AB6600',
    major: '#C24218',
    critical: '#96131B',
  },
} as const;

export type ThemeTokens = typeof tokens;
