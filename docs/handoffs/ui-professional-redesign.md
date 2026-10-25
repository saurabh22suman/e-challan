# UI/UX professional redesign — implementation handoff

Status: **Ready for another independent Codex re-review after the Chrome findings; not independently approved.**
Date: 2026-10-25. No commit, push, deploy, account-permission change or live
operational-data write was made. Existing review/implementation checkboxes are
unchanged.

## Scope and inputs

Implemented the owner's autonomous redesign brief and antipattern addendum across
Admin, Supervisor and Marshal, keeping the existing React/MUI/shared-theme
architecture, contracts, auth handoff, role/location scoping, audit/evidence rules
and domain transitions. Read: `AGENTS.md`, the constitution, `docs/decisions.md`
(B-09), PRD/design docs, the current source and the seven pre-existing Codex edits.
The pre-existing edits were inspected and refined in place rather than reverted.
The independent review in `independent-ui-ux-review.md` was then addressed in the
same session; findings 1-5 are recorded below.

Contract: `docs/ui-professional-redesign-contract.md`.
Evidence: `docs/ui-redesign-evidence/final-*.png` (index in its README).

## What changed

### Shared system

- Added `RADIUS`, `PAGE_GUTTER`, `CARD_INSET`, `LIST_CARD_BREAKPOINT`,
  `NAV_RAIL_BREAKPOINT` and reusable `PageHeader`, `SectionHeader`, `MetricCard`,
  `DetailGrid`/`DetailItem`, `EmptyState` and `RecordCard`.
- Rebuilt theme geometry around one scale: 24px card/dialog inset at normal width,
  16px on narrow screens; 44px admin controls; 56px tablet inputs/secondary
  actions; 64px tablet primary/commit. Single-line input roots measure 44/56px;
  multiline fields keep natural height.
- Removed numeric-radius/`sx` multiplication drift. Dialog headers now use one
  shared blue theme; warning/danger use the shared solid semantic tones.
- Kept green reserved for the Marshal commit action. Status stays a labelled tint;
  severity stays a solid labelled chip.
- Replaced the marketing-style Admin login with a restrained split gatehouse
  sign-in; preserved `Sign in` h1 and all credential/focus behaviour.

### Admin / Supervisor

- Added a persistent operations rail with the workspace h1, role/scope and
  destination titles at >=1400px; below that it becomes scrollable top tabs so
  1100/1152/1280/1366 laptop queues keep the full content width. Removed repeated
  generic prose from destination bodies.
- Challans: page header, consistent KPI row, live-filter drawer, applied chips,
  saved view, table-to-card list, bounded table, empty/error states and a
  two-column detail dialog with the review action beside the evidence.
- Loading truth: KPIs show skeletons until a report exists, stale results stay
  visible with an update indicator, and failures never invent zero totals.
- Filters: live application is stated in the drawer; `Done` closes; export is
  disabled while the query is pending; results/totals/export share the applied
  query. The truthful shortcut is now `Under review`.
- Saved views: v2 storage is account-scoped. Unowned legacy v1 arrays are
  discarded, never assigned to the next login. No tokens are stored; regression
  tests cover both the envelope and upgrade path.
- Lists: tables at/above 1200px, record cards below; primary row actions stay
  visible at 1100/1152/1280/1366/1440 laptop widths.
- Users: page header, quiet list surface, unified toolbar, record cards at narrow
  widths, meaningful count/status, destructive actions distinct from reset/
  reactivate.
- Masters: page header, wrap-safe category navigation, shared toolbar/list,
  card/table breakpoint at 1200px, clear empty state.
- Profile/Trend: stable detail grids, no flex-wrap columns, one KPI pattern,
  clean chart/table state and scoped period label.

### Marshal

- Moved the page heading into the content header; compact app bar keeps brand,
  post/shift, Profile and Log out while staying one row at 390px.
- Reduced the character panel to compact guidance without removing its tested
  states, motion hooks or copy; the decorative illustration is hidden on phone
  widths while the guidance/action remain. Consolidated the step strip.
- Moved recent-vehicle shortcuts after the vehicle field and moved repeated summary
  guidance below the driver data, so the first field and driver/vehicle/violation
  are on the first phone screen.
- Tightened form helper spacing, made evidence and signature sections coherent,
  kept camera/signature usable areas, removed duplicate heading weight, and made
  the commit panel a clear sticky final step.
- Restyled signature/refusal actions consistently; refusal counter now sits close
  to its field. Kept all domain checks, error-summary focus and invalidation rules.

## Antipattern register outcome

| # | Outcome | Evidence |
| --- | --- | --- |
| 1 | Fixed | Delayed report: five KPI skeletons, no zero claim; stale values retained on refresh. |
| 2 | Fixed | Delayed query: "Updating results" visible, Export disabled, re-enabled after response. |
| 3 | Fixed | Shortcut renamed `Under review`; it applies only Under Review and no duplicate saved-view option remains. |
| 4 | Fixed | Legacy unowned views are discarded; v2 envelope holds separate account keys. Unit regression plus browser role switch. |
| 5 | Fixed | Operational copy; timezone/bucket wording secondary. |
| 6 | Fixed | All dialog headers share theme chrome; Users list surface is quiet. |
| 7 | Fixed | Radius tokens + explicit px; no numeric `sx` radius drift remains. |
| 8 | Fixed | Measured 44px admin and 56px tablet input roots; multiline preserved. |
| 9 | Fixed | Table at/above 1200px, cards below; rail at >=1400px. Laptop regression covers 1100/1152/1280/1366/1440. |
| 10 | Fixed | DetailGrid used in challan, profile and account metadata; phone detail shows context before action. |
| 11 | Partial | Visual sections/primitives extracted; domain state machines deliberately untouched. |
| 12 | Addressed | Browser journeys plus task-first phone and laptop action-visibility regressions. |

## Independent review fixes

1. **Laptop navigation/content width:** rail now starts at 1400px; 1100/1152 use
   full-width top navigation and record cards. New `layout-usable.spec.ts` asserts
   visible row actions and no page overflow at 1100/1152/1280/1366/1440.
   Evidence: `final-admin-challans-1100/1152/1280/1366/1440.png`.
2. **Marshal task-first phone:** recent shortcuts moved after the vehicle field;
   decorative illustration hidden at phone width; summary guidance moved below the
   driver data. New `task-first-mobile.spec.ts` asserts the first field and driver
   name are on the first 390x844 screen. Evidence: `final-tablet-entry-390.png`,
   `final-tablet-summary-390.png`.
3. **Phone detail order:** record context (including driver/vehicle/violation strip)
   precedes evidence and action; cancellation is hidden behind `Cancel this
   challan`. New `detail-phone-context.spec.ts` asserts context-before-action and
   progressive cancellation. Evidence: `final-admin-detail-390.png`.
4. **Legacy saved views:** a v1 array has no owner, so it is discarded and replaced
   with an empty v2 envelope; it is never assigned to the next login. New
   `saved-views.test.tsx` covers this and a different-account case.
5. **Visible exceptions:** blue Users CardHeader removed; queue shortcut renamed
   `Under review`; no qualifier/caption. The planner-owned user-management helper
   was narrowly corrected to assert the shared blue default and a distinct danger
   background instead of comparing a removed CardHeader; the component test copy
   was updated from "Needs attention" to "Under review". No behavioural assertion
   was removed or skipped.

## Chrome re-review follow-up (2026-10-25)

1. **Marshal blank in Chrome — root cause and deterministic fix.** Reproduced in
   real Chrome (`channel: 'chrome'`) by clearing the tablet Vite cache and
   restarting it, then performing the normal UI handoff. During the first handoff
   the tablet Vite dependency optimizer was still running; module requests were
   aborted (`ERR_NETWORK_CHANGED`) and `#root` remained empty. The WebSocket
   failure was a symptom of the dev-server/module-graph churn, not the reason React
   failed to mount. Captured module responses after the optimizer settled were all
   200 and the same handoff rendered.
   Fix: the tablet dev server now exposes a dev-only `/__echallan_ready` endpoint
   that awaits dependency-optimizer initialization, entry transform and request
   idle; the admin handoff waits for it with a hard 10s abort and shows a
   recoverable "still starting" message instead of navigating into a blank page.
   The local boot diagnostic is injected only by the Vite serve plugin, never in
   production HTML; it does not auto-reload a pending one-time handoff and only
   offers a manual Reload after 8s. Production skips readiness completely.
   Evidence: after cache clear + restart, real Chrome UI sign-in -> handoff rendered
   Marshal entry in 1.4s with zero failed requests. An expired handoff URL correctly
   returned 401 and redirected to the dashboard sign-in. `dist/index.html` contains
   no watchdog text. Screenshot: `final-tablet-chrome-handoff-1024.png`.
2. **Phone summary task priority.** Summary order is now driver -> vehicle ->
   violations -> severity, then gate pass and secondary metadata; the repeat notice
   moves below the summary on phone widths. `task-first-mobile.spec.ts` checks
   driver, vehicle and violation with both top and bottom bounds inside 390x844.
   Evidence: `final-tablet-summary-390.png`.

## Verification actually run

| Gate | Command | Result |
| --- | --- | --- |
| Format | `pnpm run format:check` | pass |
| Lint/boundaries | `pnpm run lint` | pass; 210 files scanned |
| Typecheck | `pnpm run typecheck` | pass |
| Unit | `pnpm run test` | 320 pass (68 contracts, 56 admin, 104 API, 92 tablet) |
| Integration | `pnpm run test:integration` | 152 pass (real PostgreSQL) |
| Foundation | `pnpm run test:foundation` | 27 pass |
| Browser | `pnpm run test:e2e` | 93 pass, including readiness/handoff and task-first regressions |
| Build | `pnpm run build` | pass |
| Tablet budget | `pnpm run check:tablet-size` | 179,148 B gzip / 250,000 B |
| Layout | new focused browser tests | row actions visible at 1100/1152/1280/1366/1440; first phone field and driver/vehicle/violation fully in view |
| Dev handoff | real Chrome, cache cleared + Vite restarted | readiness endpoint waited; handoff rendered in 1.4s, zero failed module requests |
| Production HTML | build output grep | no watchdog/readiness text in either `dist/index.html` |
| Saved views | browser role switch | no cross-account leak |
| Filter delay | browser delayed response | updating + export disabled, then enabled |

No behavioural test was skipped or weakened. The approved `Review workspace` h1
remains in the rail. One planner-owned visual helper (`user-management.spec.ts`)
was narrowly corrected because it compared dialog chrome to a removed CardHeader;
it still asserts white dialog text, shared blue default chrome and a distinct danger
tone. The component test's shortcut name changed with the truthful copy.

## Role coverage / click inventory

- **Admin:** login/logout; Challans search, saved view, live drawer filters, chips,
  clear, quick Under Review queue, sort, pagination, refresh, export trigger,
  table and card layouts, detail open/close/previous/next; Trend 7/30/90,
  chart/table, empty/error; Users create/reset/deactivate/reactivate dialogs;
  Masters categories, add/edit/deactivate dialogs and bulk controls; Profile.
  The UI/API suites exercise mutations against isolated synthetic data. Excel
  file contents and live destructive writes were not independently inspected in
  this pass.
- **Supervisor:** scoped Challans, filters/detail, Trend and Profile; Users/Masters
  correctly absent; cancellation/reopen controls correctly absent. Review actions
  are covered by component/API tests; no live seeded status was mutated.
- **Marshal:** real-Chrome handoff/login/logout, post/shift context, first-field
  entry, recent vehicles, registry and manual entry, violations/remarks, validation
  focus, task-first summary, occurrence and duplicate warnings, photos/signature
  area, refusal, invalidation, disabled commit. Camera hardware, real signature
  feel and an actual issued challan on the live demo were not claimed; synthetic
  browser tests and local drafts only.

## Known limitations / review notes

- Pre-existing Codex edits were preserved, but the original seven-file starting
  diff was not saved as a separate artifact before integration. The resulting
  diff is the review baseline.
- Camera permission/capture, real stylus signature, trusted-HTTPS PWA install and
  device ergonomics remain hardware acceptance checks. Excel download content and
  a real Admin cancellation were not inspected on the demo database. The Vite
  readiness handshake and boot diagnostic are development-only (verified absent
  from production HTML); production handoff behaviour is unchanged.
- The live local database contains prior synthetic E2E test accounts; no data was
  reset or mutated for screenshots.
- No independent UI/UX approval is claimed.

Review request: inspect the diff, the contract, the new focused regressions and
final screenshots at 1100/1152/1280/1366/1440 and 390. Return PASS/
CHANGES_REQUIRED/BLOCKED in a separate reviewer session. Independent re-review is
pending.
