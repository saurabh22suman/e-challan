/**
 * 8px base spacing. Permitted steps only (docs/eChallan_DESIGN.md section 7);
 * do not introduce values outside this scale.
 *
 * Values are CSS pixel strings so they render identically when consumed by
 * the MUI `sx` prop, by `<Stack spacing>` and by raw `style` objects. MUI's
 * `sx` interprets bare numbers as theme spacing multipliers; using bare pixel
 * numbers there causes 24 to become 24*8=192px and the entry form to balloon.
 * Strings are unambiguous and approved by the design document.
 */
export const SPACING_BASE = 8;

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  xxxl: '48px',
} as const;

/** Numeric CSS pixel counterpart, retained for test assertions and formatters. */
export const SPACING_PX: Record<keyof typeof SPACING, number> = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export type Spacing = typeof SPACING;

/**
 * Minimum interactive sizes in CSS pixels.
 *
 * `interactive` is the floor every touch-critical control must meet: WCAG 2.5.5
 * asks for 44px, and the marshal tablet is operated outdoors, possibly by a
 * gloved hand, on a device that may be held rather than rested. The remaining
 * values are the tablet column from docs/eChallan_DESIGN.md section 5; the
 * desk dashboard uses the 44px `desktopAction`/`desktopInput` touch-safe floor.
 */
export const TOUCH_TARGET_MIN = {
  interactive: 48,
  tabletPrimaryAction: 64,
  tabletSecondaryAction: 56,
  tabletInput: 56,
  tabletDropdownRow: 56,
  tabletBottomNavItem: 64,
  tabletIconButton: 56,
  tabletCheckBoxRow: 56,
  adjacentGap: 12,
  desktopAction: 44,
  desktopInput: 44,
} as const;

export type TouchTargetMin = typeof TOUCH_TARGET_MIN;
