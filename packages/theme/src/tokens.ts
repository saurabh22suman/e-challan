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
  severity: {
    minor: '#AB6600',
    major: '#C24218',
    critical: '#96131B',
  },
} as const;

export type ThemeTokens = typeof tokens;
