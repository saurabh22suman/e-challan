# UI/UX professional redesign contract

Status: **implementation contract for the 2026-10-25 redesign; independent review pending.**
This is the short, concrete contract required by the owner handoff. It supplements
`docs/design.md` and the existing PRD/design/constitution rules; it does not change
domain behaviour, permissions, evidence requirements or API contracts.

## Direction

**Gatehouse console**, not a marketing dashboard. The product should read as a
quiet industrial safety/operations tool: navy chrome, crisp alignment, restrained
blue emphasis, tabular identifiers, thin rules and deliberate density. The one
signature element is the **operations rail**: a persistent section navigator with
the workspace identity and visible role/scope, while each destination carries its
own page title and task-specific actions. No gradients, decorative dashboard
animation, oversized hero type in work screens, or gratuitous shadows.

## Tokens

| Role | Value |
| --- | --- |
| Chrome | `tokens.navy` `#0B2E5C` |
| Primary action | `tokens.blue` `#0A4FAF` |
| Canvas | `tokens.canvas` `#F2F5FA` |
| Surface | `tokens.surface` `#FFFFFF` |
| Ink | `tokens.ink` `#0E1D33` |
| Muted ink | `tokens.muted` `#445268` |
| Rule | `tokens.line` `#C9D4E2` |
| Soft rule | `tokens.lineSoft` `#E3EAF3` |
| Field boundary | `tokens.fieldLine` `#7E8EA6` |
| Commit | `tokens.green` `#157A3E` — challan commit only |

Semantic tones stay as defined in `tokens.ts` / `docs/design.md` §3.3. Status is
always a labelled tinted outline; severity remains a solid labelled chip. Green
is never used for success decoration or ordinary primary actions.

Type: IBM Plex Sans for UI; IBM Plex Mono for identifiers only (challan number,
vehicle, gate pass, staff ID). Page title 30/26px; section title 20px; body
15/17px; captions 12.5/14px. Number metrics use tabular figures, not heading
typography.

## Geometry

Use only the shared 4/8/12/16/24/32/48px scale. Named values are exported from
`packages/theme`:

- `RADIUS.control` 10px, `RADIUS.card` 12px, `RADIUS.pill` 999px.
- Admin controls 44px; tablet inputs/secondary actions 56px; tablet primary/commit
  64px. Equal context means equal rendered height.
- Page gutter: 24px desktop, 16px on narrow screens. Section gap: 24px.
  Card/header/content and dialog inset: 24px at >=600px, 16px below; header and
  content share the same horizontal edge. Field gap: 16px; label gap: 6px;
  toolbar gap: 12px; dialog actions: 16px 24px (12px 16px below 600px).
- Use CSS strings/px for spacing and radius in `sx`; never bare numbers where MUI
  would multiply by the 8px spacing unit or the 10px shape radius.
- Flat surfaces. Borders and alignment carry hierarchy; only overlays may cast a
  shadow.

## Responsive

- 1200px is the admin list breakpoint: tables at/above it, readable record cards
  below it. This keeps row actions visible instead of forcing horizontal table work
  at 1100/1152px laptop widths. Do not use different list breakpoints per destination.
- 1400px is the rail breakpoint: vertical section nav at/above it, horizontal
  scrollable tabs below. Common 1100/1152/1280/1366 laptops therefore keep the
  full content width for the queue.
- Admin page gutters collapse to 16px; tablet content stays inside a bounded
  reading width while the camera/signature work areas keep their usable size.
- No unintended page-level horizontal overflow. Tables may scroll only inside a
  bounded container.

## Reusable patterns

1. **PageHeader** — eyebrow, H1/page title, one-line scope/description, actions.
   The dashboard shell owns the workspace name once, in the operations rail.
2. **SectionHeader** — H2, optional description, right-aligned actions.
3. **MetricCard** — label, value, optional hint; `loading` renders a skeleton and
   never a fabricated zero.
4. **FilterBar** — search, one primary filter trigger, saved view, secondary
   utility; chips show applied filters. Filtering is live; `Done` closes the
   drawer, "Updating results" is shown while a request is pending, and export is
   disabled until the applied query settles.
5. **DetailGrid / DetailItem** — stable CSS grid columns, not flex wrapping.
6. **EmptyState** — neutral message plus one recovery action.
7. **FormSection** — quiet header and a field body using the card inset.
8. **Dialog** — all dialog headers share the theme's blue chrome so create/edit/
   reset/details cannot drift; warning/danger use a distinct solid semantic header
   and explicit confirm tone. Destructive consequences remain visible.
9. **List** — table at/above 1200px, record cards below; row actions are labelled
   buttons, never casual links.
10. **ActionButton** — semantic tone plus density; no raw MUI variant/colour pairs
    in screens. Green remains commit-only.

## Antipattern register

| # | Finding | Decision / evidence |
| --- | --- | --- |
| 1 | Unknown totals rendered as zero | Fixed: KPI strip renders skeletons until a report exists; stale results keep their values with an "Updating" indicator; failures do not invent totals. |
| 2 | Ambiguous filter application | Fixed: the drawer states that results update as filters change, `Done` closes it, export is disabled while the query is pending, and chips/list/totals/export use the applied query. A delayed-response check confirmed the disabled/enabled transition. |
| 3 | "Needs attention" meaning | Fixed: the shortcut is now named `Under review`; it applies only the Under Review status and no longer duplicates a saved-view option. |
| 4 | Account-agnostic saved views | Fixed: the v2 envelope is namespaced by a non-secret user identity. Unowned legacy v1 arrays are discarded, never assigned to the next login. Tokens are never stored. Regression tests cover both paths. |
| 5 | API-shaped copy | Fixed in primary UI: implementation/timezone/bucket/audit wording moves to secondary help or is removed; audit consequences stay where they matter. |
| 6 | ToneDialogTitle bypass / Users header | Fixed: every dialog header shares one blue theme; list panels use quiet surfaces. The blue Users section header was removed. |
| 7 | MUI unit multiplication | Fixed: named radius tokens and explicit px strings; audit `sx` radii and numeric stack spacing. |
| 8 | Min-height vs actual height | Fixed in theme for single-line inputs/selects/actions: measured 44px admin root and 56px tablet root/input; multiline fields keep natural height; tablet 56/64px gates pass. |
| 9 | Inconsistent list breakpoints | Fixed: one 1200px list breakpoint for Challans, Users and Masters, with the rail moving only at 1400px. |
| 10 | Unstructured detail fields | Fixed with DetailGrid/DetailItem in profile, challan detail and account metadata. |
| 11 | Monolithic screens | Cohesive presentational sections/primitives extracted; domain state machines and API orchestration are left intact. |
| 12 | Tests mistaken for visual acceptance | Verification matrix below includes role walkthroughs and screenshots at required widths, not only unit/build output. |

## Verification matrix

| Surface | Checks |
| --- | --- |
| Admin shell | 1440/1366/1280/1152/1100/1024/768/390; rail-to-tabs transition; row action visibility; heading hierarchy; no overflow |
| Challans | loading/unknown KPIs, stale refresh, delayed filter, pending export, empty/error, table/cards with visible row actions at 1100/1152/1280/1366/1440, saved-view isolation and legacy discard, detail context/evidence/action order, hidden cancellation until requested |
| Users/Masters | 1024/768 list density, create/edit/reset/deactivate dialogs, long labels, empty/error, bulk controls |
| Profile/Trend | stable detail grid, chart/table, 7/30/90, empty/error, lazy bundle, no tablet chart |
| Marshal | 768x1024/390x844, first field and driver/vehicle/violation summary data fully within the first screen, form/summary/media/refusal/issued, camera/signature usable areas, duplicate/occurrence notices, error-summary focus, commit only green |
| Accessibility | keyboard focus, labels, landmarks, reduced motion, high contrast, target sizes |

## Implementation evidence

- **Checks:** formatting, lint (210 files, import boundaries clean), typecheck,
  unit suites (68 contracts + 56 admin + 104 API + 92 tablet = 320), integration
  (152), foundation (27), browser journeys (93), production build and tablet-size
  gate. Focused regressions cover laptop action visibility, task-first phone entry /
  summary (driver, vehicle and violation fully in the first screen), phone detail
  context + progressive cancellation, and legacy-view discard. A real-Chrome
  cache-clear/restart check confirms the readiness handoff; production HTML is
  checked for absence of the dev watchdog.
- **Loading truth:** a delayed report showed five KPI skeletons and no numeric
  zero claim; the total card contained only its label while unknown.
- **Filter consistency:** a delayed report with a changed search left Export
  disabled and "Updating results" visible; after the response it re-enabled.
- **Saved views:** account-scoped envelope held separate customer keys; Admin's
  "Admin terminal view" was absent for Supervisor and vice versa. No token stored.
- **Geometry:** measured admin single-line input root 44px and tablet root/input
  56px; no page-level overflow at 1440/1366/1280/1152/1100/1024/768/390/320, with
  primary row actions visible at the laptop widths.
- **Screenshots:** `docs/ui-redesign-evidence/final-*.png` at 1440/1366/1280/
  1152/1100/1024/768/390 for the login, rail/table/cards, dialogs, masters, trend,
  marshal form, summary, signature, refusal and profile, plus the real-Chrome
  handoff capture. No credentials/tokens in evidence.
- **Local dev reliability:** the Marshal handoff waits on a dev-only tablet
  readiness endpoint (optimizer + entry transform + request idle) with a hard 10s
  abort. A boot diagnostic is injected only by the Vite serve plugin; it does not
  auto-reload a pending handoff and is absent from production HTML. The observed
  blank was a dependency-reoptimization race, not the WebSocket itself.

Independent Codex UI/UX review remains pending until the owner returns. Visual
behaviour beyond mocked camera/signature fixtures and hardware camera/signature
feel remain device checks, not claims made here.
