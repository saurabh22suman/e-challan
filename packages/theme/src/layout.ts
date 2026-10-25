/**
 * Shared geometry for the professional operations UI.
 *
 * Keep these values in CSS pixel strings: MUI's `sx` multiplies bare numbers by
 * the theme spacing unit (8px) or shape radius (10px), which caused the drift
 * this redesign removes.
 */
export const RADIUS = {
  control: '10px',
  card: '12px',
  panel: '14px',
  chip: '7px',
  pill: '999px',
} as const;

export const PAGE_GUTTER = {
  compact: '16px',
  regular: '24px',
} as const;

/** Card, header, content and dialog body share this inset. */
export const CARD_INSET = '24px';

/** One breakpoint for every admin table-to-card list transition. */
export const LIST_CARD_BREAKPOINT = 1199.95;

/** Above this width the dashboard uses the vertical operations rail. */
export const NAV_RAIL_BREAKPOINT = 1399.95;

export type RadiusToken = typeof RADIUS;
