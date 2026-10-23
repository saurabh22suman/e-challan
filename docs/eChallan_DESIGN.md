# Safety Violation e-Challan — Design Guidelines

**Applies to:** `apps/tablet` and `apps/admin`
**Framework:** MUI v9, shared theme in `packages/theme`
**Source of truth for visual style:** the concept mockup in the Reliance DMD Security proposal deck. Colours below are sampled from it.

---

## 1. Design position

The mockup already establishes the visual language: Reliance navy chrome, a blue-headed content card, a green commit action, and a persistent bottom navigation bar. This document formalises it and resolves the places where it meets field conditions.

Those conditions are not negotiable. The tablet is used outdoors, in direct sunlight, possibly by a gloved hand, while a driver waits and may be arguing. Where the mockup and the gate disagree, the gate wins, and Section 4 says exactly where that happens.

The dashboard is used at a desk. Density is the point there, and the mockup's table treatment carries straight across.

## 2. Colour

Sampled from the mockup.

| Token | Hex | Use |
|---|---|---|
| `navy` | `#003A80` | App bar, bottom navigation, table header row |
| `blue` | `#0B57C4` | Card header bars, chart bars, links, focus ring |
| `green` | `#157A3E` | Primary commit action only. Deepened from the deck's `#1B9A4E` — see Section 8 |
| `tint` | `#EFF4FD` | Stat card fill, subtle surface |
| `surface` | `#FFFFFF` | Cards, input fills |
| `canvas` | `#F7F9FC` | Application background behind cards |
| `line` | `#D4DCE6` | Borders and dividers |
| `ink` | `#12243D` | Primary text |
| `muted` | `#4C5A6C` | Labels, secondary text |

### Metric accents

The mockup gives each stat card its own accent. Keep this — four tiles in four colours works here because each colour is bound to a meaning that recurs elsewhere in the product.

| Metric | Hex |
|---|---|
| Total / informational | `#0B57C4` |
| Pending | `#E07B24` |
| Resolved | `#157A3E` |
| Period total | `#5B3FD1` |

### Severity

The mockup has no severity treatment because the concept deck predates it. Added here, using industrial safety signage:

| Severity | Hex | Treatment |
|---|---|---|
| Minor | `#AB6600` | Solid fill chip, white text |
| Major | `#C24218` | Solid fill chip, white text |
| Critical | `#96131B` | Solid fill chip, white text |

### The green collision, resolved

Green is both the primary action colour and the Resolved status colour. That ambiguity is tolerable only if the treatments never overlap:

- **Solid green fill** means one thing and one thing only: the button that commits a challan. Nothing else in the product is filled green.
- **Status** always renders as an outlined chip with its label. Resolved is a green outline, never a green fill.
- **Severity** always renders as a solid fill in its own hue, never green.

So fill versus outline separates action from status, and hue separates severity from everything else. Hold this rule strictly — it is doing real work at a glance in a table.

Severity and status never rely on colour alone. Every chip carries its word. Roughly one in twelve Indian men has a red-green colour vision deficiency, and this product's users are overwhelmingly male.

## 3. Typography

**IBM Plex Sans** for the interface. It matches the humanist character of the mockup, holds up at small sizes, and was drawn for technical documentation — it stays legible in poor viewing conditions where a geometric sans falls apart.

**IBM Plex Mono** for identifiers only: challan numbers, vehicle registrations, gate pass numbers, licence numbers.

This is functional, not stylistic. A marshal reading a registration back to a driver, or an admin matching a challan number to a paper file, cannot afford to confuse `0`/`O` or `1`/`I`/`l`. Mono disambiguates them and aligns columns down the dashboard table. Restrict it strictly to identifiers — mono for general labels is a stylistic tic, not a decision.

| Role | Tablet | Dashboard | Weight |
|---|---|---|---|
| App bar title | 18 / 24 | 18 / 24 | 600 |
| Card header bar | 17 / 22 | 15 / 20 | 600 |
| Section heading | 20 / 26 | 18 / 24 | 600 |
| Body | 17 / 26 | 15 / 22 | 400 |
| Field label | 15 / 20 | 13 / 18 | 500 |
| Identifier (mono) | 18 / 24 | 14 / 20 | 500 |
| Stat number | 34 / 38 | 30 / 34 | 700 |
| Helper and caption | 14 / 20 | 12 / 18 | 400 |

Sentence case throughout, following the mockup. Load only IBM Plex Sans 400/500/600 and Plex Mono 500, self-hosted — the tablet may sit on a restricted network, and a webfont that fails to load silently degrades legibility exactly where it matters most.

## 4. Where the mockup needs adjusting

Three places, each with the reasoning.

### 4.1 The dashboard panel comes off the entry screen

The mockup shows the challan form on the left and a live dashboard on the right. It reads well in a pitch. In the field it costs about 38% of the screen to information the marshal does not need while a driver is standing in front of him — he is not going to act on "This Month: 156" mid-challan.

It is also already redundant. The mockup's own bottom navigation has Dashboard and e-Challan as separate destinations, so the side panel duplicates a tab that exists.

**Entry screen uses the full width.** That reclaimed space is what makes Section 5's touch targets fit without scrolling. The dashboard keeps its layout exactly as drawn — it just lives on its own tab.

Keep the two-panel view for the demo if it presents better. It is a five-minute layout change, and the deck's framing is worth preserving in front of management.

### 4.2 Controls get bigger

The mockup's fields and buttons are sized for a mouse. Section 5 replaces those dimensions. Everything else about the field treatment — the leading icon, the label above, the light fill, the thin border — carries over unchanged.

### 4.3 Labels stay above the field, always visible

The mockup already does this, and it should be stated explicitly because MUI's default is the opposite. Floating labels animate into the border and vanish under glare, and they are hidden entirely once the on-screen keyboard covers half the screen. Static labels above the field, with the leading icon the mockup uses.

## 5. Touch targets

MUI's defaults are sized for a calm desk.

| Element | Tablet minimum |
|---|---|
| Primary action button | 64px height, full width |
| Secondary button | 56px |
| Form input | 56px |
| Dropdown option row | 56px |
| Bottom navigation item | 64px |
| Icon button | 56 × 56px |
| Gap between adjacent targets | 12px |

WCAG 2.5.5 asks for 44px. Gloved hands on a device that may be held rather than rested need more, and a mis-tap here writes a wrong entry onto a disciplinary record.

**Destructive actions never sit beside routine ones.** Delete photo is not adjacent to Generate challan. Signature Clear is not adjacent to Confirm.

## 6. Layout and placement

### 6.1 Chrome — as drawn

```
┌──────────────────────────────────────────────────────────┐
│ ☰   ◉ Reliance      Reliance DMD Security –      ⬡ DMD   │  navy #003A80
│                  Create New Safety Violation      SECURITY│  56px
├──────────────────────────────────────────────────────────┤
```

App bar: menu at far left, Reliance mark beside it, two-line centred title, DMD Security badge at far right. The title's second line names the current screen.

```
├──────────────────────────────────────────────────────────┤
│  ⊞ Dashboard   ▤ e-Challan   ☰ Challan List   ◔ Reports  │  navy #003A80
└──────────────────────────────────────────────────────────┘  64px
```

Bottom navigation: five destinations, icon above label, active item marked by a lighter navy fill behind it — as the mockup shows for e-Challan. Fixed to the viewport bottom, never scrolls.

### 6.2 Challan entry — full width

```
┌──────────────────────────────────────────────────────────┐
│ ▤  New safety violation e-Challan                        │  blue #0B57C4 header
├──────────────────────────────────────────────────────────┤  bar, white text
│                                                          │
│  ▤ Challan no.              ▦ Date & time                │  paired fields,
│  ┌────────────────────┐     ┌────────────────────┐       │  label + leading
│  │ DMD/2025/08/0001   │     │ 09/08/2025 10:30   │       │  icon above
│  └────────────────────┘     └────────────────────┘       │  56px inputs
│                                                          │
│  ⛃ Vehicle no.              ☺ Driver name                │
│  ┌────────────────────┐     ┌────────────────────┐       │
│  │ MH12AB1234         │     │ Ramesh Kumar       │       │  mono for plate
│  └────────────────────┘     └────────────────────┘       │
│                                                          │
│  ⊞ Department               ⚠ Violation type             │
│  ┌────────────────────┐     ┌────────────────────┐       │
│  │ Logistics        ▾ │     │ No seat belt     ▾ │       │  dropdown only
│  └────────────────────┘     └────────────────────┘       │
│                                                          │
│  ⌨ Remarks                                               │
│  ┌────────────────────────────────────────────────┐      │  full width
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  ⊙ Photo capture            ✎ Digital signature          │
│  ┌────────────────────┐     ┌────────────────────┐       │
│  │        ⊙           │     │                    │       │  dashed border
│  │  Tap to capture    │     │            Clear   │       │  on empty state
│  └────────────────────┘     └────────────────────┘       │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │        ✓  Generate challan                     │      │  green, 64px
│  └────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────┘
```

Two-column field grid exactly as the mockup pairs them. Remarks spans full width. Photo capture and signature sit side by side. The green commit button is full width at the bottom of the card.

Fields keep the mockup's leading outline icon beside each label. The icon is a scanning aid for a marshal who has used this a hundred times and is looking for the shape of the field, not reading it.

A repeat-offender notice, when triggered, appears as a full-width amber banner directly above the commit button — the last thing seen before committing, not a toast that can be missed.

### 6.3 Dashboard tab

```
┌──────────────────────────────────────────────────────────┐
│ ◉  e-Challan dashboard (today)                           │  blue header bar
├──────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │ Total challans   │  │ Pending          │              │  tint #EFF4FD
│  │ 24            ▤  │  │ 07            ⧗  │              │  accent label,
│  │ Today            │  │ Pending          │              │  big number,
│  └──────────────────┘  └──────────────────┘              │  icon right
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │ Resolved      ✓  │  │ This month    ▥  │              │
│  │ 16               │  │ 156              │              │
│  └──────────────────┘  └──────────────────┘              │
├──────────────────────────────────────────────────────────┤
│  Violation type summary (this month)                     │
│  50 ┤ ▮                                                  │  bars #0B57C4
│  40 ┤ ▮  ▮                                               │
│  30 ┤ ▮  ▮  ▮                                            │
│  20 ┤ ▮  ▮  ▮  ▮  ▮                                      │
│   0 └─────────────────────────────────────               │
└──────────────────────────────────────────────────────────┘
```

Stat cards 2×2, exactly as drawn: coloured metric label, large number, small qualifier beneath, tinted circular icon at the right. Chart beneath in a card of its own.

### 6.4 Challan list

```
┌────────────────┬──────────┬────────────┬───────────┬──────────┬──────────┐
│ Challan no.    │ Date     │ Vehicle    │ Driver    │ Violation│ Status   │  navy row
├────────────────┼──────────┼────────────┼───────────┼──────────┼──────────┤  white bold
│ DMD/2025/08/001│ 09/08/25 │ MH12AB1234 │ R. Kumar  │ ▮ Minor  │ ▯Resolved│
│ DMD/2025/08/002│ 09/08/25 │ MH14CD5678 │ A. Singh  │ ▮ Major  │ ▯Pending │
└────────────────┴──────────┴────────────┴───────────┴──────────┴──────────┘
```

Navy header row with white bold labels, as the mockup shows. Plain white rows, no zebra striping — the header carries enough weight to anchor the columns. Identifiers in mono so the columns align. Severity fills, status outlines.

Rows at 44px on the dashboard rather than MUI's 52px default; more rows visible without reaching for a scrollbar.

## 7. Spacing and shape

8px base. Permitted steps: 4, 8, 12, 16, 24, 32, 48.

Tablet: 20px card padding, 20px between field rows, 16px column gutter. Dashboard: 16px and 12px. Do not mix the two rhythms on one surface.

Radius: 6px on inputs, buttons and chips; 10px on cards and stat tiles, matching the mockup's softer card corners. Two values applied by role. One radius on everything flattens the distinction between a control and a container.

Cards are defined by a 1px `line` border with at most a very soft shadow. Shadow alone disappears entirely in glare, so the border is the load-bearing element.

## 8. Contrast and outdoor legibility

Target **7:1 for body text**, not the usual 4.5:1. Direct sunlight roughly halves perceived contrast, and AA is not enough at a gate at 2pm.

- Secondary text is `muted` on white, never lighter.
- Placeholder text is never a substitute for a label — in glare it reads as filled content.
- Disabled fields stay readable. A completed field being shown to a driver has to be legible.
Measured contrast against white text, since several of these were wrong when taken straight from the mockup:

| Surface | Ratio | Verdict |
|---|---|---|
| `navy #003A80` | 10.96 | Passes AAA |
| `critical #96131B` | 8.73 | Passes AAA |
| `blue #0B57C4` | 6.61 | Passes AA. Fine for short card-header labels at 17px; never set paragraph text on it |
| `green #157A3E` | 5.41 | Passes AA |
| `major #C24218` | 5.14 | Passes AA |
| `minor #AB6600` | 4.53 | Passes AA, marginally |

**The deck's green needed changing.** `#1B9A4E` sampled from the mockup gives only **3.63:1** against white — it fails AA for normal text, on the single most important control in the product. Deepened to `#157A3E` (5.41:1), which is close enough to read as the same green beside the deck but is actually legible. Going to `#126633` would reach 7:1, but it reads visibly darker than the concept and the loss of brand fidelity is not worth the last point and a half.

`muted` was likewise deepened from `#5A6B80` (5.46:1) to `#4C5A6C` (7.03:1) so that secondary text actually meets the 7:1 target this section sets.

## 9. Motion

Almost none. Motion is permitted only where it shows what changed in response to an action: a photo thumbnail appearing after capture, a confirmation state on commit, a panel opening. 150–200ms.

No entrance animations on load. No shimmer skeletons — a plain "Loading" line is honest and cheaper. Respect `prefers-reduced-motion` and drop to instant.

## 10. MUI theme

Verified against MUI 9.4.0 with `tsc --strict`.

```ts
// packages/theme/src/index.ts
import { createTheme, PaletteColorOptions } from '@mui/material/styles';

// Severity is not a MUI palette colour, so it must be declared before
// <Chip color="critical" /> will typecheck.
declare module '@mui/material/styles' {
  interface Palette { minor: Palette['primary']; major: Palette['primary']; critical: Palette['primary']; }
  interface PaletteOptions { minor?: PaletteColorOptions; major?: PaletteColorOptions; critical?: PaletteColorOptions; }
}
declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides { minor: true; major: true; critical: true; }
}

export const tokens = {
  navy:    '#003A80',
  blue:    '#0B57C4',
  green:   '#157A3E',
  tint:    '#EFF4FD',
  surface: '#FFFFFF',
  canvas:  '#F7F9FC',
  line:    '#D4DCE6',
  ink:     '#12243D',
  muted:   '#4C5A6C',
  metric:   { total: '#0B57C4', pending: '#E07B24', resolved: '#157A3E', period: '#5B3FD1' },
  severity: { minor: '#AB6600', major: '#C24218', critical: '#96131B' },
};

export const createAppTheme = (surface: 'tablet' | 'admin') => {
  const tablet = surface === 'tablet';

  return createTheme({
    palette: {
      mode: 'light',
      primary:    { main: tokens.navy },
      secondary:  { main: tokens.blue },
      success:    { main: tokens.green },
      warning:    { main: tokens.metric.pending },
      error:      { main: tokens.severity.critical },
      minor:      { main: tokens.severity.minor,    contrastText: '#FFFFFF' },
      major:      { main: tokens.severity.major,    contrastText: '#FFFFFF' },
      critical:   { main: tokens.severity.critical, contrastText: '#FFFFFF' },
      background: { default: tokens.canvas, paper: tokens.surface },
      divider:    tokens.line,
      text:       { primary: tokens.ink, secondary: tokens.muted },
    },

    typography: {
      fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      h1:    { fontSize: tablet ? 20 : 18, lineHeight: 1.3, fontWeight: 600 },
      h2:    { fontSize: tablet ? 17 : 15, lineHeight: 1.29, fontWeight: 600 },
      body1: { fontSize: tablet ? 17 : 15, lineHeight: tablet ? 1.53 : 1.47 },
      caption: { fontSize: tablet ? 14 : 12, lineHeight: 1.43 },
      button: { fontSize: tablet ? 17 : 15, fontWeight: 600, textTransform: 'none' },
    },

    shape: { borderRadius: 6 },

    components: {
      MuiButton: {
        defaultProps: { disableElevation: true, variant: 'contained' },
        styleOverrides: {
          root: { minHeight: tablet ? 64 : 40, paddingInline: tablet ? 24 : 16 },
        },
        // Solid green is reserved for the commit action. See Section 2.
        // Colour-specific slots such as `containedSuccess` are not valid
        // styleOverrides keys — MUI expects a variants entry.
        variants: [
          { props: { variant: 'contained', color: 'success' },
            style: { backgroundColor: tokens.green } },
        ],
      },

      MuiOutlinedInput: {
        // Required: the label sits above the field, so the fieldset must not
        // cut a notch for it. Without this you get an empty gap in the border.
        defaultProps: { notched: false },
        styleOverrides: {
          root: {
            minHeight: tablet ? 56 : 40,
            backgroundColor: tokens.surface,
            '& fieldset': { borderColor: tokens.line, borderWidth: 1 },
            '&:hover fieldset': { borderColor: tokens.muted },
            '&.Mui-focused fieldset': { borderColor: tokens.blue, borderWidth: 2 },
          },
        },
      },

      // Labels sit above the field and stay visible. See Section 4.3.
      MuiInputLabel: {
        defaultProps: { shrink: true },
        styleOverrides: {
          root: {
            position: 'static',
            transform: 'none',
            fontSize: tablet ? 15 : 13,
            fontWeight: 500,
            color: tokens.ink,
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,           // leading field icon, as the mockup shows
          },
        },
      },

      MuiMenuItem: { styleOverrides: { root: { minHeight: tablet ? 56 : 36 } } },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { border: `1px solid ${tokens.line}`, borderRadius: 10 } },
      },

      // Blue card header bar, as drawn in the mockup.
      MuiCardHeader: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.blue,
            color: tokens.surface,
            padding: '12px 16px',
            borderRadius: '10px 10px 0 0',
          },
          title: { fontSize: tablet ? 17 : 15, fontWeight: 600 },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: { paddingBlock: 10, borderColor: tokens.line },
          head: { backgroundColor: tokens.navy, color: tokens.surface, fontWeight: 600 },
        },
      },

      MuiBottomNavigation: {
        // Labels are hidden on unselected items unless this is set.
        defaultProps: { showLabels: true },
        styleOverrides: { root: { backgroundColor: tokens.navy, height: 64 } },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            color: 'rgba(255,255,255,0.75)',
            '&.Mui-selected': { color: tokens.surface, backgroundColor: 'rgba(255,255,255,0.12)' },
          },
        },
      },

      MuiCssBaseline: {
        styleOverrides: {
          ':focus-visible': { outline: `3px solid ${tokens.blue}`, outlineOffset: 2 },
          '@media (prefers-reduced-motion: reduce)': {
            '*': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' },
          },
        },
      },
    },
  });
};

export const identifierStyle = {
  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
  fontWeight: 500,
  letterSpacing: '0.01em',
} as const;
```

## 11. Writing

**Buttons name their outcome.** The mockup's "Generate Challan" is right — keep it, and keep the name through the flow, so the button that says "Generate challan" produces "Challan generated".

**Errors say what happened and what to do.** Not "Invalid input" but "Vehicle number should look like MH12AB1234". Not "Request failed" but "Couldn't save. Check the connection and tap Retry — your entries are still here." Errors do not apologise and are never vague.

**Empty states point somewhere.** "No challans match these filters", with a clear-filters action. Not "No data".

**The driver-facing summary is the most carefully written text in the product.** It is read by someone who did not choose to be there and may contest it later. Plain sentences, no system vocabulary, no abbreviations. "You are being recorded for: not wearing a seat belt. This is your second recorded violation in 90 days." Not "Violation Type: NO_SEAT_BELT | Occurrence: 2".

**Never call the driver an offender in the interface.** The record describes a violation. Judgement belongs to the process that follows, not to the form.

## 12. Accessibility floor

- Visible keyboard focus on every interactive element — the dashboard will be driven by keyboard.
- Every input programmatically associated with its label. Placeholders are not labels. Field icons are decorative and get `aria-hidden`.
- Colour never carries meaning alone; chips carry their word.
- Evidence thumbnails carry meaningful alt text: "Evidence photo 2 of 3, challan DMD/2025/08/002".
- The signature canvas has an accessible alternative: the refusal path is reachable without drawing.
- Touch targets per Section 5.
- Test the tablet flow at 200% zoom before the pilot.
