# e-Challan design system and consistency plan

Status: **implemented 2026-10-24; pending independent review.** This document
complements `docs/eChallan_DESIGN.md`; it does not replace the PRD, the
constitution or the approved visual constraints. Where they conflict, the
PRD/owner decision and `docs/eChallan_DESIGN.md` win until this proposal is
approved.

## Owner decisions — 2026-10-24

- **Cancelled challans:** muted-rose tone, not neutral and not danger red.
- **Deactivated / inactive accounts and masters:** neutral slate tone. Red is
  reserved for errors and destructive actions, not for an intentional state.
- **Supervisor trend series:** Issued, Resolved and Cancelled.
- **Trend placement:** a dedicated **Trend** tab in the admin dashboard, visible
  to Supervisor and Admin. It is not a card above the challan table.
- **Default trend range:** 30 days (implementation default; the API returns the
  actual range/granularity).

Still open: whether a full shadcn/Tailwind migration is ever commissioned.

Reference material consulted: shadcn/ui theming and component variants
(`https://ui.shadcn.com/docs/theming`,
`https://ui.shadcn.com/docs/components/alert`,
`https://ui.shadcn.com/docs/components/badge`,
`https://ui.shadcn.com/docs/components/alert-dialog`,
`https://ui.shadcn.com/docs/components/sonner`) and Apache ECharts
(`https://echarts.apache.org/en/index.html`, tree-shaking and accessibility
handbook pages).

## 1. What is inconsistent today

The audit found these concrete inconsistencies:

1. `StatusChip` has no tone. `Active`, `Inactive`, `Issued`, `Under Review`,
   `Resolved` and `Cancelled` all render as the same neutral outline.
2. Dialog headers are always blue. A destructive deactivation/cancellation
   dialog therefore looks like a normal edit dialog except for its final button.
3. There is no toast system. Transient success/error feedback is rendered as an
   inline `Notice`, so it can remain on screen and stack with other notices.
4. Login and handoff failures use MUI `Alert` directly; the rest of the app uses
   the shared `Notice`. The styling and roles drift.
5. `SyncStatusBar`, `MarshalCharacter` and metric cards use raw status colours
   directly instead of a shared semantic tone.
6. Tables mix `StatusChip` with plain `Yes/No` text for the same account state.
7. Buttons lack a complete shared emphasis model (primary, secondary, outline,
   ghost, destructive, commit, loading, disabled).
8. Filters, page headers, empty states and bulk action bars use slightly
   different spacing/container treatments across Challans, Users and Masters.
9. No chart exists for a Supervisor to see the trend of challans.

## 2. Approach: adopt shadcn’s model, not its stack

shadcn/ui’s useful idea is the **semantic token pair**: `primary` plus
`primary-foreground`, `muted` plus `muted-foreground`, and variants such as
`default`, `secondary`, `destructive` and `outline`. Its toast types are
`success`, `info`, `warning`, `error` and `loading`.

This repository already uses MUI with exact-path imports, a tablet JS budget and
PWA constraints. Replacing MUI with Tailwind/Radix would be a second design
system, not a consistency fix. The plan is therefore:

- keep MUI as the component runtime;
- add shadcn-style semantic tokens and component variants in `packages/theme`;
- use one shared `StatusBadge`, `Notice`, `Toast`, `ConfirmDialog`, `EmptyState`,
  `PageHeader`, `FilterBar` and form-field pattern;
- never use a raw hex value in an app; apps consume tokens and primitives only;
- keep the tablet and admin separate surfaces with the same semantics and
  different density.

### 2.1 Why not a full shadcn/Tailwind migration now

shadcn/ui is not a drop-in component dependency. Its components are source files
built on Tailwind CSS and Radix primitives; adopting it means adding Tailwind,
PostCSS and Radix, copying/owning component code, and replacing MUI/Emotion
across the tablet, dashboard and shared theme.

Costs and risks:

- **Large rewrite:** every screen, form, dialog, table, focus state and theme
  override changes at once; this is not a visual bug fix.
- **Two design systems during migration:** both MUI and Tailwind/Radix styles
  would coexist, which is the opposite of the consistency goal.
- **Pilot regression risk:** the existing acceptance suite, browser journeys,
  import-boundary gate and tablet initial-JS budget were built around MUI. Each
  would need a new baseline and independent review.
- **PWA/offline risk:** the shell cache, service worker, exact-path imports and
  tablet camera UI would all need revalidation.
- **No business value for the current gate pilot:** semantic tokens, tone-aware
  badges, dialogs and toasts solve the reported inconsistency without replacing
  the runtime.
- **ECharts is already an addition:** adding Tailwind/Radix at the same time
  increases bundle, dependency and review surface unnecessarily.

The shadcn visual principles we are keeping are the valuable part: semantic
tokens, surface/foreground pairs, explicit component variants, restrained
surfaces, clear focus states and accessible feedback. If the owner wants the
shadcn architecture itself, treat it as a separate migration project after the
pilot, with its own bundle/PWA/test plan and a side-by-side prototype. It should
not be smuggled into the consistency fix.

## 3. Foundations

### 3.1 Token layers

Use three layers so a component never names a colour directly:

1. **Primitive:** raw palette values such as `blue.600`, `green.700`.
2. **Semantic:** meaning such as `feedback.success.bg`, `status.issued.border`,
   `surface.card`, `focus.ring`.
3. **Component:** `button.destructive.bg`, `dialog.danger.header`,
   `toast.success.border`.

Every tone has a surface/foreground pair and an icon colour:

```text
tone = {
  bg:       tinted surface
  fg:       accessible text/icon colour on bg
  border:   visible UI boundary
  solid:    only where a solid fill is explicitly allowed
}
```

The existing `tokens.ts` palette stays the primitive source. The semantic layer
is additive; existing names may be aliased during migration and removed later.

### 3.2 Surfaces and text

- `background`, `surface`, `surfaceRaised`, `surfaceMuted`
- `foreground`, `foregroundMuted`, `foregroundOnDark`
- `border`, `borderSoft`, `fieldBorder`, `focusRing`
- Radius: 10px controls, 12px cards/dialogs; no pill shapes except badges.
- Elevation: flat by default; borders and spacing carry hierarchy. Shadows only
  for overlays/dialogs.
- Spacing: existing 8px scale. Admin uses the 44px control floor; tablet uses
  56px/64px targets and 12px adjacent gaps.

### 3.3 Tone palette (proposal)

These values are the proposed semantic tones. Contrast must be verified in the
token tests before merge; the implementation may tune a value, never a meaning.

| Tone | Text/icon | Background | Border | Use |
| --- | --- | --- | --- | --- |
| neutral | `#445268` | `#F2F5FA` | `#C9D4E2` | inactive, draft, read-only, inactive master |
| info | `#08408D` | `#E8F0FC` | `#9CBEF0` | issued, saved, online action, install banner |
| success | `#0F5D2F` | `#E7F4EC` | `#9BCDAE` | active, resolved, sent, online, success toast |
| warning | `#7A4A00` | `#FCF1E1` | `#E3C08A` | under review, pending, offline, caution |
| danger | `#7E1017` | `#FCEBEC` | `#E7A6AA` | error, failed send, destructive action |
| cancelled | `#7A1F3A` | `#FBEFF3` | `#D8A7B8` | cancelled challan, not a generic error |

Solid green (`#157A3E`) remains reserved for the challan commit action. Status
and toast surfaces use tints/outlines, never a solid green fill.

Severity keeps its current solid chips: Minor `#AB6600`, Major `#C24218`,
Critical `#96131B`, white text. Severity is a labelled solid chip; status is a
tinted outline; they must not look interchangeable.

### 3.4 Typography and iconography

- IBM Plex Sans for UI; IBM Plex Mono for identifiers only.
- One icon per semantic meaning, reused everywhere:
  - success: check circle
  - info: info circle
  - warning: triangle alert
  - danger: octagon/cross circle
  - cancelled: ban
  - inactive: user pause/slash
  - issued: file/ticket
  - under review: clock
  - resolved: check circle
- Colour is never the only signal. Every status has a visible label and an icon
  or shape; toasts and alerts include the tone word in their accessible name.

## 4. Status mapping

### 4.1 Accounts and masters

| State | Tone | Label | Notes |
| --- | --- | --- | --- |
| Active | success | Active | green tint, check icon |
| Deactivated / Inactive | neutral | Deactivated | slate, pause icon; not red |
| Pending invitation (future) | warning | Pending | amber |
| Role: Admin / Supervisor / Marshal | neutral | role name | role is not a health state |

Using red for a deactivated account would imply an error or a destructive failure.
The state is intentional; the neutral “Deactivated” badge is the correct signal.
The **deactivate action dialog** uses danger, because the action is destructive.

### 4.2 Challans

| Status | Tone | Label | Icon |
| --- | --- | --- | --- |
| Issued | info | Issued | ticket |
| Under Review | warning | Under Review | clock |
| Resolved | success | Resolved | check circle |
| Cancelled | cancelled | Cancelled | ban |

Current severity stays a separate solid chip. Do not merge status and severity
into one colour.

### 4.3 Operational states

| State | Tone |
| --- | --- |
| Online / sent / saved successfully | success |
| Draft saved / sending | info |
| Offline / pending acknowledgement | warning |
| Failed send / API error | danger |
| Missing evidence (historical) | neutral |

## 5. Feedback patterns

### 5.1 Inline notice (persistent)

- Use for page-level validation, permission notices, empty-state explanations
  and errors that require the user to change something on the page.
- Tone: info, success, warning, danger, cancelled/neutral.
- `role="alert"` for errors that need immediate announcement; `role="status"`
  otherwise.
- Never auto-dismiss.
- Shared `Notice` primitive; remove direct MUI `Alert` usage from app screens.

### 5.2 Toast (transient)

- Use for completed actions: “User reactivated”, “Master entry updated”,
  “Export started”, “Challan sent”.
- No toast for field validation; keep that inline next to the field and in the
  error summary.
- Tones and durations:
  - success/info: 5 seconds
  - warning: 8 seconds
  - danger: persistent until dismissed, or 10 seconds when it has a retry action
- Pause on hover/focus. One toast is visible; a newer completed action replaces
  it immediately so feedback for the latest action is never stuck behind an
  older toast.
- One provider per app, shared from `packages/theme`; MUI `Snackbar`/`Alert`
  implementation, not Sonner/Tailwind.
- Each toast has a title, optional description, optional action and a dismiss
  control. Password/credential material never appears in a toast.
- `aria-live="polite"` by default; `assertive` for danger.

### 5.3 Dialogs and confirmations

- Default dialog: blue/navy header (existing language), primary confirm.
- Warning dialog: neutral header with amber icon/accent; warning confirm.
- Destructive dialog (deactivate user, cancel challan, bulk deactivate): danger
  header/accent, destructive confirm, explicit object name and consequence.
- The dialog tone is chosen by the consequence, not by the object’s current
  status. A deactivated account’s badge remains neutral after the action.
- Destructive confirmations keep the existing reason/remarks requirements.

### 5.4 Empty, loading and error states

- Empty state: neutral icon + one sentence + one action (clear filters, retry,
  create first entry).
- Loading: skeleton for cards/tables; spinner + text only where a skeleton would
  misrepresent layout.
- Error: danger inline notice with retry; never a blank page.
- No fabricated totals or placeholder rows.

## 6. Component contract

Create or consolidate in `packages/theme`:

| Component | Variants / props | Rule |
| --- | --- | --- |
| `StatusBadge` | `tone`, `label`, `icon`, `size` | tinted outline; label required |
| `SeverityChip` | `severity` | solid; unchanged meaning |
| `Button` | `primary`, `secondary`, `outline`, `ghost`, `destructive`, `commit`, `loading` | one primary action per view; commit green only |
| `Notice` | `tone`, `role` | persistent inline |
| `Toast` / `ToastProvider` | `tone`, `title`, `description`, `action`, `duration` | transient, shared provider |
| `ConfirmDialog` | `tone`, `title`, `description`, `confirmLabel`, `onConfirm` | consequence-based tone |
| `PageHeader` | title, subtitle, actions | same spacing on every admin page |
| `FilterBar` | search, filters, saved views, active chips | one pattern for Challans/Users/Masters |
| `EmptyState` | icon, title, description, action | neutral |
| `FormField` | label, helper, error, required | static label above; error linked |
| `DataTable` | columns, rows, status cells, pagination | status cells use `StatusBadge` |
| `MetricCard` | label, value, tone, hint | tone only when the metric has semantic meaning |
| `RoleBadge` | role | neutral; no colour competition with status |
| `PwaInstallBanner` | tone info | mobile/tablet only |

The current `StatusChip` should be replaced by `StatusBadge`; keep a temporary
alias during migration so imports do not break in one step.

## 7. Screen consistency plan

### Admin

1. Users: status badges, bulk action bar tone, destructive dialogs, toast on
   create/reset/deactivate/reactivate, active/inactive filter chips.
2. Masters: same status badges and bulk bar; no “Yes/No” state cells.
3. Challans: status badges with tones; filters use the shared `FilterBar`;
   export success/error toasts; review transition dialogs tone-aware.
4. Profile: same form field/notice/toast patterns.
5. Login/handoff: use shared `Notice`/`Alert` for errors; no direct MUI Alert.
6. PWA install banner: standard info tone; never on desktop.

### Tablet

1. Preserve 56/64px targets, static labels and the green-only commit action.
2. Sync bar uses semantic tones; offline = warning, failed = danger, sent =
   success, draft = info.
3. Validation remains inline + error summary; toasts are only for completed
   actions.
4. No chart, data grid, date picker or admin-only widget enters the tablet
   bundle. The boundary check stays enforced.

## 8. Supervisor challan trend chart

### 8.1 Placement and access

- New **Trend** tab in the admin dashboard, visible to Supervisor and Admin.
  Suggested tab order: Challans, Trend, then Admin-only Users/Masters, then
  Profile. Challans remains the default landing; Trend is one click away.
- Marshal has no admin dashboard access; the API must still return 403 for a
  Marshal token.
- Supervisor scope is their assigned locations; Admin sees all locations.
- Optional location filter stays inside the caller’s authorised scope.

### 8.2 Data contract and semantics

Add a server-side aggregate endpoint rather than aggregating client-side:

```text
GET /challans/report/trend?from=2026-09-24&to=2026-10-24&granularity=day
```

```json
{
  "timezone": "Asia/Kolkata",
  "granularity": "day",
  "from": "2026-09-24",
  "to": "2026-10-24",
  "points": [
    { "bucketStart": "2026-09-24", "issued": 3, "resolved": 1, "cancelled": 0 }
  ],
  "totals": { "issued": 14, "resolved": 4, "cancelled": 1 }
}
```

Definitions:

- `issued`: challans whose `issuedAt` falls in the bucket and whose location is
  in scope. This is an event count, not “currently Issued”.
- `resolved`: distinct challans with a review action to `Resolved` in the bucket.
- `cancelled`: distinct challans with a cancellation action in the bucket.
- `Under Review` is a workflow/backlog state, not a daily event. If a third
  workflow series is needed later, add it as a separate backlog metric rather
  than pretending it is a daily count.
- Buckets are zero-filled for the requested range.
- Range is capped (proposal: 365 days) and validated. Timezone is explicitly
  `Asia/Kolkata` in SQL and response.
- The chart is read-only and does not approve D3/D5 business rules; it reports
  stored statuses/actions.

### 8.3 Chart specification

- Apache ECharts, pinned at implementation time, tree-shaken modules only:
  `echarts/core`, `LineChart`, `GridComponent`, `TooltipComponent`,
  `LegendComponent`, `AriaComponent`, `CanvasRenderer`.
- Register an `eChallan` ECharts theme from the same semantic tokens.
- Line chart with three series:
  - Issued: blue
  - Resolved: green
  - Cancelled: muted rose, dashed line
- Use distinct line patterns/markers as well as colour. Enable
  `aria.show` and decal patterns for colour-blind users.
- Tooltip includes the bucket and all three counts. Legend is keyboard
  accessible. No 3D, no misleading smoothing; use straight lines or stepped
  lines for counts.
- Responsive `ResizeObserver`; minimum height; no horizontal page overflow.
- Lazy-load the ECharts component from the Trend route so the login and other
  admin routes do not pay the chart bundle cost. The tablet bundle must not
  import ECharts; extend the boundary check to enforce this.
- Provide a visually hidden or collapsible data table for screen readers and a
  “View as table” action. Empty, loading and error states are explicit.
- Default range: 30 days, daily buckets. Range presets 7/30/90 days; 90 days may
  use weekly buckets. The server returns the actual granularity used.

### 8.4 Chart tests

- API integration: Admin vs Supervisor scope, Marshal 403, date range, timezone
  boundary, zero-filled buckets, max-range refusal, invalid granularity.
- Contract unit tests for the trend response.
- Chart transform tests for empty/one/many buckets and missing series.
- Browser test: Supervisor sees only their locations; Admin sees all; legend and
  accessible table; lazy chunk loads only on the Trend tab.
- Visual check at 1280 and 768 widths; tablet has no chart.

## 9. Implementation phases

| Phase | Work | Exit gate |
| --- | --- | --- |
| 0. Audit and decisions | Approve tone semantics, cancelled/deactivated choices, chart series and range | This document approved; no code migration started |
| 1. Token foundation | Add semantic tone groups, surface/text pairs, chart palette, contrast tests | Token tests and existing visual tests pass |
| 2. Shared primitives | `StatusBadge`, `ToastProvider`, `ConfirmDialog`, `PageHeader`, `FilterBar`, `EmptyState`, `FormField` | Component tests; no raw hex in app screens |
| 3. Admin migration | Users, Masters, Challans, Profile, login/handoff, PWA banner | Screens use shared primitives; statuses visibly distinct |
| 4. Tablet migration | Sync status, notices/toasts, severity/status consistency | Touch targets, contrast, green commit rule and tablet JS budget pass |
| 5. Trend API | Contract, service, route, SQL aggregation, tests | Role scoping and totals verified against real PostgreSQL |
| 6. Trend UI | Lazy ECharts card/tab, theme, accessibility table, states | Browser/visual tests; chart excludes tablet bundle |
| 7. Final QA | Contrast audit, responsive screenshots, device checks, docs | Owner review and no regressions in existing acceptance tests |

Chart work can run in parallel with phases 3–4 after phase 1, but the token
foundation must land first.

## 10. Decisions needed before implementation

Decided by owner on 2026-10-24: muted-rose cancelled tone, slate deactivated
tone, and Issued/Resolved/Cancelled trend series.

Still open:

1. **Full shadcn/Tailwind/Radix migration:** not proposed for this consistency
   fix. If desired, it is a separate project with its own bundle/PWA/test
   approval.

Implemented in this batch:

- semantic tone tokens and contrast tests;
- `StatusBadge`, tone-aware `Notice`, `ToastProvider`/`useToast`,
  `ToneDialogTitle`;
- admin account/master/challan status badges, destructive dialog tones and
  action toasts;
- tablet sync/status semantic tones;
- Supervisor/Admin Trend tab with scoped `/challans/report/trend`;
- Apache ECharts 6.1.0, modular imports, custom theme, decal/aria, accessible
  table, lazy admin chunk (the tablet bundle is unchanged and the boundary gate
  rejects ECharts outside `apps/admin`).

## 11. Implementation evidence

- Theme/contracts: semantic tones with AA contrast tests; status mapping covers
  every `StatusKind` and challan status.
- Admin: user/master active and deactivated states are visually distinct;
  destructive dialogs are tone-aware; completed actions use toasts.
- Trend API: real-PostgreSQL integration tests cover Admin/Supervisor scope,
  Marshal 403, range/granularity validation, zero-fill and weekly buckets.
- Trend UI: ECharts 6.1.0 loaded only by the lazy Trend chunk; the admin initial
  entry chunk does not contain ECharts; the tablet initial-JS gate remains under
  budget.
- Browser evidence: 85 Playwright journeys pass, including the Trend tab,
  status/toast flows and the production single-origin smoke.
- Independent review is still required before these changes are treated as
  accepted.

## 12. Non-negotiables

- Solid green remains reserved for the challan commit action.
- Status is always labelled; colour is never the only signal.
- The tablet keeps its touch targets, static labels and 250 KB initial-JS budget.
- Admin-only components (charts, data grids, date pickers) never enter the tablet
  bundle.
- Evidence and audit records are not restyled into something that implies a
  different state.
- No fabricated trend data: the chart reads real stored challan/action rows,
  scoped by the API.
