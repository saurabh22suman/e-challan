# Comprehensive Application Audit — e-Challan

**Audit date:** 2026-10-21  
**Scope:** Tablet marshal PWA, Admin dashboard, shared theme/contracts, role permissions, browser behaviour, responsive layout and accessibility  
**Mode:** Audit only. No application source, tests, configuration or design files were modified.

---

## 1. Executive Summary

The application has a coherent visual foundation and some genuinely solid engineering: role scoping is enforced by the API, the tablet form has a clear error-recovery pattern, photo capture/signature/refusal work against a real browser media stream, review transitions are auditable, and user administration works end to end. The shared MUI theme, self-hosted fonts and explicit touch-target tokens give the two applications a common visual language.

It is **not release-ready for gate use**. The most serious problem is simple: **a marshal cannot submit a challan at all**. The browser flow ends at “Photos and signature” with no commit control, and the API deliberately has no submission route. Several other P0 admin capabilities are absent: no dashboard totals, no date/location/violation filters, no sorting or pagination, no export, no evidence viewer in challan detail, no admin cancellation and no master-data screens. These are documented scope gaps in the repository, not hidden regressions, but they still make the current build an internal demo/foundation rather than a pilot build.

Two systemic defects affect every surface:

1. **Empty sign-in submits raw Zod JSON to the user** in both applications, exposing internal schema detail and destroying trust in the first interaction.
2. **MUI buttons and tabs have no visible keyboard focus indicator** in Chromium despite the theme’s global focus rule. Keyboard-only users cannot see where they are.

The tablet itself is the stronger surface: it is responsive, has generous 56/64 px targets, clear static labels and a useful linked error summary. The admin surface is desktop-first and becomes hard to use on small screens because its tables hide the action and status columns behind an internal horizontal scroll.

**Release readiness:** **NOT READY.** Suitable for an internal demonstration of the implemented slice; not for pilot issuance or acceptance.

**Severity totals:** 1 Critical, 6 High, 5 Medium, 12 Low (24 issues).

> **Post-audit remediation (2026-10-22):** All 24 findings in this report have
> been addressed in code. AUD-01 added atomic signed/refused submission; the
> remaining remediation added reporting/export, evidence viewing, cancellation,
> master-data screens, routing, draft restoration, responsive card layouts and
> the shared focus/contrast/copy fixes. The original findings below are retained
> as the audit baseline. See `docs/handoffs/audit-remediation.md` and
> `docs/handoffs/AUD-01-submission.md`. Independent review and real-device
> acceptance remain outstanding; the release-readiness statement below is the
> pre-remediation assessment.

---

## 2. Audit Environment

### 2.1 Repository and working tree

| Item | Value |
|---|---|
| Repository | `/home/soloengine/thedutchrabbit/e-chalan` |
| Branch / commit | **Unavailable.** The directory is not a Git repository (`git rev-parse` returns “not a git repository”). There is no branch or commit to record. |
| Working tree | No VCS status available. Application source was inspected read-only; only this report and `docs/audits/evidence/2026-10-21/` were added. |
| Application source modified | No |
| Node / pnpm | Node 22.23.2 / pnpm 11.22.0 |
| Framework | React 18.3, Vite 8.3, MUI 9.4, Emotion, TypeScript 6.0 |
| API | Fastify 5.12, Drizzle 0.45, PostgreSQL 16 |
| Authentication | Opaque server-side sessions stored in PostgreSQL; bearer token in `localStorage`; Argon2id for admin-created/reset passwords |
| Routing | **No client router.** Each application has one URL, `/`; screens/tabs/dialogs are in-memory state. |

### 2.2 Application URL and data isolation

| Service | URL | Notes |
|---|---|---|
| Tablet | `http://127.0.0.1:5173/` | Vite dev server, `/api` proxied |
| Admin | `http://127.0.0.1:5174/` | Vite dev server, `/api` proxied |
| Demo API | `http://127.0.0.1:3001` | Running, left untouched |
| Audit API | `http://127.0.0.1:3002` | Same source, connected to isolated `echallan_test` database |

Browser tests used Playwright request interception to send the applications’ same-origin `/api/...` calls to the isolated API on port 3002. This kept the seeded demo database intact while allowing destructive role/workflow tests (review transitions, user creation, password reset, deactivation). The application source and build used by 5173/5174 are identical to the normal running instance. The isolated database was dropped and reseeded after the audit; it again contains 14 synthetic challans.

Test database content at start:

- 14 challans total (Admin scope), 8 visible to the seeded Supervisor.
- Statuses represented: Issued, Under Review, Resolved, Cancelled.
- 5 seeded users: 1 Admin, 2 Supervisors, 2 Marshals.
- Synthetic media/evidence rows: none by design.

### 2.3 Accounts and browsers

Only synthetic, committed demo accounts were used. **Passwords are intentionally omitted from this report.**

| Role | Synthetic username | Surface |
|---|---|---|
| Marshal | `DEMO-EMP-004` | Tablet |
| Supervisor | `DEMO-EMP-002` | Admin dashboard |
| Admin | `DEMO-EMP-001` | Admin dashboard |
| Anonymous | — | Both sign-in screens |

Browsers:

| Browser | Version / build | Coverage |
|---|---|---|
| Chromium | Headless Chrome 153 / Playwright 1.63 | Primary; all viewports and states |
| Firefox | Playwright Firefox 155.0 (build 1543) | Representative smoke: tablet entry + admin list/detail |
| WebKit | Build 2359 downloaded | **Blocked** — host libraries missing (`libevent-2.1.so.7`, `libavif16`, `libmanette-0.2-0`) |

### 2.4 Viewports

| Device class | Viewport |
|---|---|
| Small mobile | 360 × 800 |
| Standard mobile | 390 × 844 |
| Large mobile | 430 × 932 |
| Tablet | 768 × 1024 |
| Laptop | 1366 × 768 |
| Desktop | 1920 × 1080 |

Additional zoom check: 683 × 384 as a 200%-zoom-equivalent layout at 1366 × 768. This is not the same as operating the browser’s zoom menu; see limitations.

### 2.5 Limits and blockers

- **No real gate device, rear camera, stylus or trusted HTTPS.** Camera tests used Chromium’s fake media device; signature input used a mouse. Hardware feel, sunlight legibility and glove use were not measured.
- **WebKit blocked** by missing host libraries. No Safari/iOS evidence.
- **Ambiguous post/shift sign-in state not reached.** The seeded marshal has one post and one shift, so the extra Post/Shift selectors were not exercised against real ambiguous data.
- **Ten-minute wall-clock idle logout was not waited out.** Idle expiry was forced in the isolated database and the resulting UI return-to-login was verified.
- **True 200% browser zoom was not used.** The half-viewport equivalent is reported as a layout check only.
- **Unimplemented flows cannot be tested.** No submission, evidence viewing, cancellation, export, dashboard summary or master-data UI exists.
- **Not every role × state was repeated at all six viewports.** Shared screens (sign-in, form, list, detail, dialogs) were captured at all six viewports; role-conditional variants (Supervisor vs Admin detail and reopen, Admin-only user dialogs) were exercised at representative desktop widths plus mobile dialog measurements. Conditional controls were individually verified.
- **One-record and missing-optional-data scenarios were not separately exercised.** Empty, many-record and long-text scenarios were tested; missing optional values were inspected in the seeded records and code but not driven as a dedicated browser scenario.
- Mobile admin results should be read in the context of the PRD’s desk-based Admin role; they are still reported because the audit requested mobile coverage.

### 2.6 Application inventory (discovery deliverable)

There are **2 URL routes** (one per application) and **17 primary screen/modal states**. All primary states were reached and tested. There are **22 API endpoints**.

#### Primary states and intended purpose

| # | App / state | Purpose | Roles |
|---|---|---|---|
| 1 | Tablet sign-in | Authenticate a marshal into a bound post/shift | Anonymous |
| 2 | Tablet entry form | Capture vehicle, gate pass, driver, masters, violations, remarks | Marshal |
| 3 | Driver summary | Review consolidated details, occurrence and duplicate warning | Marshal |
| 4 | Photos and signature | Capture evidence, draw/confirm signature | Marshal |
| 5 | Refusal | Record refusal reason and witnessing supervisor | Marshal |
| 6 | Tablet profile dialog | Own identity, locations, current post/shift, session expiry | Marshal |
| 7 | Admin sign-in | Authenticate Supervisor/Admin | Anonymous |
| 8 | Challans tab | Scoped challan list with status filter | Supervisor, Admin |
| 9 | Detail — Issued | Read fields/history; start review | Supervisor, Admin |
| 10 | Detail — Under Review | Record action + remarks; resolve | Supervisor, Admin |
| 11 | Detail — Resolved | Read outcome; Admin reopen | Supervisor, Admin |
| 12 | Detail — Cancelled | Read terminal state and cancellation reason | Supervisor, Admin |
| 13 | Admin profile tab | Own identity, assignments, session context | Supervisor, Admin |
| 14 | Users tab | List users; invoke reset/deactivate/reactivate | Admin |
| 15 | Create user dialog | Create Marshal/Supervisor/Admin with locations/password | Admin |
| 16 | Reset password dialog | Set a new password and revoke sessions | Admin |
| 17 | Deactivate dialog | Confirm deactivation (retained account/history) | Admin |

Additional states exercised: Challans empty/loading/error/retry; Users empty; duplicate-warning acknowledgement; camera unavailable; catalogue network error/retry; role-refusal alerts; expired session; unknown URL; dialog escape/backdrop/cancel.

#### API routes and guards

| Endpoint group | Purpose | Access |
|---|---|---|
| `GET /health`, `GET /health/ready` | Liveness / real database readiness | Public |
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/session` | Session lifecycle | Public login; bearer token for the others |
| `GET /challans`, `GET /challans/:id` | Scoped review list and detail | Supervisor/Admin list; scoped detail also preserves Marshal own-post read |
| `POST /challans/:id/review` | Start/resolve/reopen transitions | Supervisor/Admin; reopen Admin-only |
| `GET /profile` | Own profile and session context | Any authenticated role |
| `GET/POST /admin/users`, `POST /admin/users/:id/deactivate`, `.../reactivate`, `.../reset-password` | User administration | Admin only |
| `GET /masters/:kind` | Active catalogue for selectors | Any authenticated role |
| `GET/POST/PATCH /admin/masters/:kind`, `POST /admin/masters/:kind/:id/deactivate` | Master-data management (API present, no UI) | Admin only |
| `GET /registry/lookup`, `POST /challans/validate`, `POST /challans/preview` | Marshal registry and pre-issuance checks | Marshal only, bound to session post |

There is **no** `POST /challans` submission endpoint.

#### Shared vs role-specific components

- **Shared packages:** `packages/theme` (palette, typography, spacing, touch targets, MUI overrides, `FormSection`, `Notice`, `StatusChip`, `SeverityChip`, `ErrorSummary`); `packages/contracts` (Zod schemas for auth, domain, issuance, review, profile, masters).
- **Shared patterns but duplicated app code:** sign-in screens, app bars, profile panels and field rows. Apps do not import each other’s internals.
- **Role-specific:** tablet entry/summary/media/refusal; Admin Challans/Users/Profile tabs and review/user dialogs.
- **Admin-only conditional UI:** Users tab and reopen control.
- **Marshal-only:** issuance form, registry picker, pre-issuance validation/preview.
- **Not present:** tablet dashboard/challan list navigation, master-data screens, evidence viewer, cancellation UI, export/totals.

#### Major interactions inventoried

Sign-in, password reveal, role-boundary refusal, session restore, logout, tab switching, status filter, open detail, start review, select action, enter remarks, resolve, reopen, create user, select role/locations, reset password, deactivate/reactivate, search registry, keyboard combobox navigation, manual vehicle entry, gate-pass/driver autocomplete, master selects, six violation checkboxes, remarks counter, duplicate acknowledgement, camera start/stop/capture/retake, signature draw/confirm/clear/sign-again, refusal capture, error-summary links, retry/recovery, modal close/backdrop/escape.

#### Expected responsive behaviour

- **Tablet:** portrait/landscape; full-width form; stacked actions; 56–64 px targets; step strip collapses to “Step n of 3”.
- **Admin:** desk-first; tables should remain legible or have an explicit desktop-only strategy; dialogs should keep their primary action reachable.
- **Both:** no document-level horizontal overflow; no clipped actions; keyboard focus always visible.
- **Current result:** tablet meets these expectations; admin table and mobile dialog behaviour do not (AUD-08, AUD-13, AUD-20).

#### Design references and conflicts

- `docs/eChallan_DESIGN.md` — original visual/touch/layout baseline.
- `docs/decisions.md` B-02 — owner chose single-form entry followed by summary and signature, superseding PRD E2.1’s stepped-entry requirement.
- `docs/decisions.md` B-09 — owner authorised a full visual restyle beyond the design document, superseding specific visual treatment where in conflict. Constitution-level gates remain: tablet JS budget, exact-path imports, static labels, touch targets, contrast, green-only commit.
- `docs/eChallan_PRD.md` — requirements and P0/P1/P2 priorities.
- No Functional Specification v0.2 is present; no missing business rules were invented for this audit.

The current single scrolling form → summary → photos/signature flow is therefore **not** a design violation; it follows B-02. The visual palette/radius changes are likewise treated as B-09 restyle, not defects. Findings focus on the remaining gates and on inconsistencies within the delivered product.

### 2.7 Evidence

- 98 screenshots under `docs/audits/evidence/2026-10-21/`.
- 1 Playwright trace for the anonymous empty-sign-in failure.
- No credentials, session tokens or production data are included in evidence. Only the anonymous-login trace is retained; authenticated traces were intentionally not stored because they would contain bearer tokens.

---

## 3. Coverage Matrix

Legend: **PASS** = verified; **FAIL** = confirmed defect or missing capability; **PARTIAL** = works but with a significant gap; **BLOCKED** = could not execute; **N/A** = not applicable to that role.

| Role | Page / state | Desktop | Mobile | Visual | Interactions | Accessibility | Status |
|---|---|---|---|---|---|---|---|
| Anonymous | Tablet sign-in | FAIL | FAIL | PASS | FAIL | FAIL | **FAIL** |
| Anonymous | Admin sign-in | FAIL | FAIL | PASS | FAIL | FAIL | **FAIL** |
| Marshal | Entry form | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| Marshal | Driver summary | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| Marshal | Photos and signature | PASS | PASS | PASS | FAIL | PARTIAL | **FAIL** |
| Marshal | Refusal | PASS | PASS | PASS | FAIL | PARTIAL | **FAIL** |
| Marshal | Profile dialog | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| Supervisor | Challans list | PASS | FAIL | PARTIAL | PARTIAL | PARTIAL | **PARTIAL** |
| Supervisor | Detail — Issued / Under Review | PASS | PARTIAL | PASS | PASS | PARTIAL | **PARTIAL** |
| Supervisor | Detail — Resolved / Cancelled | PASS | PARTIAL | PASS | PASS | PARTIAL | **PARTIAL** |
| Supervisor | Profile | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| Admin | Challans list | PASS | FAIL | PARTIAL | PARTIAL | PARTIAL | **PARTIAL** |
| Admin | Detail / reopen | PASS | PARTIAL | PASS | PARTIAL | PARTIAL | **PARTIAL** |
| Admin | Users list | PASS | FAIL | PARTIAL | PASS | PARTIAL | **PARTIAL** |
| Admin | Create / Reset / Deactivate dialogs | PASS | PARTIAL | PASS | PASS | PARTIAL | **PARTIAL** |
| Admin | Profile | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| All | Empty / loading / error / retry | PASS | PASS | PASS | PASS | PARTIAL | **PARTIAL** |
| All roles | API authorization | PASS | N/A | N/A | PASS | N/A | **PASS** |

Notes:

- “Desktop” includes 1366 and 1920; “Mobile” includes 360/390/430; “Tablet” is covered in screenshots and dedicated 768 checks.
- Sign-in rows fail because empty submission exposes raw validation JSON (AUD-02); focus failure is AUD-03.
- Photos/signature and refusal fail because the flow cannot be completed (AUD-01), not because the media controls themselves are broken.
- Supervisor/Admin detail states are individually reachable and were exercised. The seeded data supplies Issued, Under Review, Resolved and Cancelled rows.

---

## 4. Design Consistency Findings

### 4.1 What is coherent

- Both apps use the same `@echallan/theme`, IBM Plex Sans/Mono self-hosted fonts, 8 px spacing scale, blue-headed cards and navy app bar.
- Status is always an outlined labelled chip; severity is a solid labelled chip; no green fill is used outside the reserved `success` token.
- Tablet targets meet or exceed the design floor: no visible tablet control measured below 44 px; primary actions are 64 px and secondary/inputs 56 px.
- Static labels are above the fields on both apps and every visible input has an associated label. Automated checks found no duplicate IDs or unlabelled visible controls.
- Heading order has no skips; the tablet error summary is focusable and every one of its six links focuses the correct control.
- Date/time formatting is consistently `en-IN` with `Asia/Kolkata`; identifiers are mono.
- Loading, warning, error, success and role-refusal states are persistent notices, not transient toasts.

### 4.2 Findings

1. **Button/tab focus is invisible.** The global `:focus-visible` rule in `packages/theme/src/createTheme.ts:329` is overridden for MUI’s button base. Computed focus style for “Show password”, “Open” and tab controls is `outline: none 0px`; screenshots show no visible indicator. Text inputs and native selects do show a dark 3 px outline, so the failure is specific to MUI ButtonBase/Tab. This is both a design inconsistency and a WCAG 2.4.7 failure. **AUD-03.**
2. **The input boundary does not meet the product’s own contrast target.** Tokens claim “UI borders >= 3:1” (`tokens.ts:10`), but `line #C9D4E2` on white measures **1.50:1** (1.37:1 against the canvas). Browser-computed input fieldset border is `rgb(201, 212, 226)` on `rgb(255, 255, 255)`. In glare/low vision, the field boundary effectively disappears. **AUD-09.**
3. **Secondary text misses the stated 7:1 target.** `muted #4E5D75` on white measures **6.67:1** (6.11:1 on canvas); card-header subheads on blue measure **4.99:1**. WCAG AA still passes, but the design document’s outdoor 7:1 target does not. **AUD-12.**
4. **Admin table density is inconsistent with the design reference and with itself.** Rows are 74 px on wide screens (design reference says 44 px for desk density), 134 px at 1024, and 155 px at 390; long data produced a 216 px row. The table header is white instead of the reference navy header (this specific treatment may be covered by B-09, so it is recorded as a deviation rather than a failure). **AUD-08.**
5. **The Admin intro card is repeated above every tab.** “Demo review workspace” occupies a full card on Challans, Users and Profile; at 360 it consumes roughly the first 330 px, pushing the actual task below the fold. **AUD-24.**
6. **Empty states are inconsistent.** Challans has “No challans match this filter.”; Users renders only table headers when the list is empty. Neither points to a recovery action. **AUD-15, AUD-21.**
7. **Copy/casing is inconsistent.** “Create New Safety Violation” uses title case; “e-Challan Dashboard”, “e-Challan dashboard sign-in”, “e-Challan marshal sign-in” and “Demo review workspace” use three different conventions. Browser titles still say “Foundation”. **AUD-22.**
8. **Small number of token bypasses.** The signature pen (`#12243D`), camera surfaces (`#0B1220`), white canvas fills and app-bar overlay alphas are hardcoded rather than tokenised. Camera dark surfaces are defensible; the signature pen is close to but not equal to `tokens.ink`. **AUD-23.**
9. **Destructive confirmation uses the routine primary colour.** “Deactivate user” is a solid blue primary action, identical in emphasis to “Create user” or “Reset password”. The design guideline asks destructive actions to be separated and recognisable. **AUD-19.**

### 4.3 Deliberate differences, not defects

- Tablet uses larger type and 56–64 px controls; Admin uses 40 px desk controls. This is intentional surface scaling.
- Tablet has a step strip and full-width form; Admin has tabs and tables. Different tasks, same design language.
- The sidebar/dashboard/chart mockup and bottom navigation are not implemented; B-09 permits a restyle, and the missing destination screens are treated as scope gaps where relevant rather than visual defects.
- No Reliance/DMD brand chrome is present. This is treated as part of the authorised B-09 restyle, not a defect, but it is a noticeable departure from the original mockup.

### 4.4 Verdict

The application feels like **one coherent product with a shared design system**, not a collection of independently designed screens. The shared palette, typography, card headers, chips, field labels, focus language (where it works) and spacing are visibly consistent. The remaining inconsistencies are systemic and fixable at the theme/component level — focus visibility, input-boundary contrast, secondary-text contrast, empty states and admin mobile tables — rather than evidence of ad-hoc per-screen styling.

---

## 5. Functional Interaction Findings

### 5.1 Confirmed working

- **Role boundaries:** 20/20 API authorization checks passed: Marshal cannot list challans or review; Supervisor cannot manage users or read another location; Admin can read across locations; logout revokes the token; tampered/absent tokens receive 401.
- **Sign-in:** wrong credentials produce one generic message and clear the password; show/hide works; role-specific surfaces reject the wrong role and revoke the issued session; a valid stored session survives reload; an idle-expired session returns to sign-in and clears storage.
- **Entry form:** required-field validation produces six linked errors and focuses the summary; every summary link focuses its field; edits retain unrelated errors; registry list, keyboard combobox navigation, gate-pass and driver autocomplete, manual-vehicle mode, master selects, all six violation checkboxes, remarks counter, vehicle normalisation, “Other” remark rule, and the duplicate-warning acknowledgement all work.
- **Media:** fake-device camera start/capture/retake/stop, thumbnail display, signature draw/confirm/clear/sign-again, and refusal reason/witness/staff-ID capture all work. Camera denial/unavailability produces a persistent error.
- **Summary/preview:** occurrence notice, severity derivation, photo count, signature/refusal acknowledgement, and preview-gated navigation work.
- **Admin list:** status filter options and filtering, open detail, loading spinner, error notice with Retry, recovery after retry, empty-list message and refresh after a review change work.
- **Review lifecycle:** Issued → Under Review → Resolved → Admin reopen → Under Review was executed against the isolated real database; action, remarks, performer and history were appended correctly. Supervisor cannot reopen; Cancelled is terminal; invalid resolution is blocked.
- **User administration:** create with role/location rules, duplicate/length validation, reset with length/mismatch validation and working new password, deactivate with confirmation, reactivate, and self-deactivation disabled all work. Deactivation retains the account.
- **Dialogs:** Escape, backdrop click, explicit Close/Cancel, focus return to opener, and focus containment for Profile/Create User worked.
- **Profile:** each role sees its own details; Marshal has post/shift; Supervisor/Admin show “Not bound”; no password material is represented.
- **Resilience:** catalogues network error + Retry, list error + Retry, slow responses and session expiry were exercised.
- **Cross-browser:** Firefox completed tablet entry and admin list/detail smoke without console errors or overflow.

### 5.2 Confirmed failures / missing flows

1. **No challan submission exists.** The last actionable controls are signature/refusal; there is no “Generate challan” or equivalent, no success state, no server-assigned number, and no submit endpoint. This is the Critical finding.
2. **Empty login exposes raw validation JSON.** Both apps parse credentials with `LoginRequestSchema.parse(...)` before calling the API and display `Error.message`; an empty form renders the Zod issue array in an `Alert`. No request is sent.
3. **No routing/history.** Browser Back from an authenticated screen goes to `about:blank`; refresh resets the Admin tab and closes any dialog; a challan cannot be linked or restored. A draft is lost on refresh.
4. **Admin list is incomplete for reporting.** Only status filtering exists; no sort, pagination, date range/location/severity/department/vehicle/gate-pass/marshal filters, result count or export. The API silently caps at 200 rows.
5. **Detail cannot show evidence.** The dialog shows fields, violations, remarks and history, but no photos or signature (and there are no evidence routes/UI).
6. **Admin cannot cancel.** The API explicitly rejects `to: 'Cancelled'`; the UI exposes no cancellation control.
7. **No master-data screens.** Admin-only master APIs exist, but no tab/screen calls them; E5 management is not operable.
8. **Users empty state is missing.** A mocked empty list renders bare column headers.
9. **Camera-unavailable copy is malformed:** “This device does not support camera capture. camera permission.”
10. **Administrative validation is less accessible than tablet validation:** create/reset/review forms use inline errors without an error summary, focus move or live announcement; the entry form uses a linked summary and focuses it. On mobile the create action initially sits below the viewport.
11. **PWA surface is absent.** No manifest link, icons, theme-color or service worker; titles still include “Foundation”; `/favicon.ico` is 404.
12. **Anonymous console noise.** Both apps call `GET /api/auth/session` with no token and log two 401s under React StrictMode; the favicon 404 also logs.

---

## 6. Role-Based Findings

### 6.1 Permission matrix (verified against the UI and API)

| Capability | Marshal | Supervisor | Admin |
|---|---|---|---|
| Tablet issuance surface | Yes | No (refused) | No (refused) |
| Submit a challan | **No — not implemented** | N/A | N/A |
| Read challan list | No (403) | Yes, assigned locations | Yes, all locations |
| Read challan detail | Own post only | Scoped | All |
| Start review / resolve | No (403) | Yes | Yes |
| Reopen resolved | No | No | Yes |
| Cancel | No | No | **No — not implemented** |
| Manage users | No | No (Users tab hidden) | Yes |
| Read master catalogues | Yes | Yes | Yes |
| Manage master data | No | No | **API only; no UI** |
| View evidence/signature | Only captures locally | **No viewer** | **No viewer** |
| View own profile | Yes | Yes | Yes |
| See post/shift | Yes | No (unbound) | No (unbound) |

### 6.2 Role-specific observations

- **Marshal:** The form is well aligned to field conditions, but the role cannot complete its primary job. No submit means no challan number, no success feedback and no proof that the record exists. The “No challan has been submitted” notices are honest but confirm the gap.
- **Supervisor:** Scoping works and the review sequence is understandable. The role cannot see evidence, which makes a review decision less defensible. Cancellation is unavailable to everyone.
- **Admin:** Role-scoped list and user management work. The role’s reporting responsibilities are essentially absent: no totals, filters, export or charts. User administration has no search and no empty state. Reopen works and is correctly hidden from Supervisors.
- **Cross-role consistency:** Status names, date formatting, identifier styling and profile terminology are consistent. The Admin’s extra “Users” tab and location-wide list are clear. The major inconsistency is capability asymmetry: a Marshal can capture evidence, but no reviewer can view it.

---

## 7. Responsive and Accessibility Findings

### 7.1 Responsive

- **No document-level horizontal overflow** was measured on any of the 60 role/viewport screens at 360/390/430/768/1366/1920. That is a positive result.
- **Tablet:** 360, 390, 768 and 1366 layouts remain usable. Step strip collapses correctly; actions stack; no clipped fields. The 390 summary buttons wrap to two lines, which is visually acceptable but less tidy.
- **Admin:** The challan table is 923 px wide inside a 294–686 px container at 360–768. At 390, the first “Open” action starts at x≈860, entirely outside the viewport; status, issued time and action columns are hidden until an internal horizontal scroll that is only reachable at the bottom of the table. Row height becomes 155 px at 390 and long data produced 216 px.
- **Admin Users:** The table is 862 px wide at 360; Active, Locations and Actions are off-screen. The “Create user” button wraps to two lines.
- **Dialogs:** Create User at 390 is 780 px tall with a 726 px scrolling content area; the primary action is initially below the viewport (bottom 884 px) and becomes visible after scrolling. Reset and Deactivate fit.
- **200%-zoom equivalent:** Tablet entry at 683 × 384 has no horizontal overflow, but only the top/left portion was visually checked; this is not a complete 200% zoom test.
- **Admin is desk-first.** The table failures are Medium rather than Critical because the intended role is desktop, but a tablet/laptop at 768 is a realistic admin device and is already broken.

### 7.2 Accessibility

| Check | Result |
|---|---|
| Visible focus on buttons/tabs | **FAIL** — computed `outline: none`; screenshots show no indicator |
| Visible focus on text inputs/selects | PASS — dark 3 px outline |
| Keyboard reachability of controls | PASS — all major controls reachable by Tab |
| Keyboard combobox (vehicle picker) | PASS — ArrowDown/ArrowUp/Enter/aria-activedescendant |
| Dialog focus trap / Escape / focus return | PASS — Profile and Create User; MUI standard detail |
| Labels and accessible names | PASS — no visible unlabelled input/select/textarea; 94 controls checked |
| Duplicate IDs | PASS — none |
| Heading order | PASS — no skipped levels |
| Image alternatives | PASS — content images have alt; character art is explicitly decorative `alt=""`/`aria-hidden` |
| Error announcement | PARTIAL — tablet summary has `role=alert` and focus; admin inline errors do not |
| Text contrast (WCAG AA) | PASS — sampled rendered text met 4.5:1 (disabled text exempt) |
| Non-text contrast (WCAG 1.4.11) | **FAIL** — input boundary 1.50:1 vs 3:1 |
| 7:1 product target | **FAIL** — muted text 6.67:1; card subheads 4.99:1 |
| Tablet touch targets | PASS — no sub-44 px visible controls; primary 64 px |
| Admin mobile touch targets | **FAIL** — buttons/inputs 40 px; below 44 px guidance |
| Reduced motion | PASS — theme respects `prefers-reduced-motion` |
| 200% zoom equivalent | PASS for overflow; incomplete visual check |

The focus failure is the most serious accessibility issue because the Admin workflow is explicitly keyboard-driven at a desk. A user tabbing to “Open”, “Start review”, or “Sign in” has no visual indication of which control will activate.

---

## 8. Detailed Issue Register

Issue types: **Confirmed defect** = reproduced in a browser; **Scope gap** = a required capability is absent; **Static finding** = code inspection, not a separate browser repro.

### AUD-01 — No challan submission or commit action

> **Status update 2026-10-21:** Implemented and locally verified; independent
> review pending. See `docs/handoffs/AUD-01-submission.md`.

- **Severity:** Critical
- **Type:** Scope gap (documented)
- **Role:** Marshal
- **Page/route:** Tablet `/` — Photos and signature / Refusal
- **Viewports:** 390 × 844, 768 × 1024, 1366 × 768
- **Expected:** After photos plus signature or refusal, a full-width green commit action creates the challan, assigns a server number and shows the issued record (PRD E2.15–E2.16).
- **Actual:** The only controls are back/refusal/signature controls. There is no Generate/Submit/Commit button, no success screen and no number. The API has no issuance/submission route. Notices explicitly say “No challan has been submitted.”
- **Reproduction:** Sign in as Marshal → choose a registry vehicle → Check details → Continue to photos → capture/sign or refuse → inspect all controls. No commit action exists at any stage.
- **Evidence:** [signature step at 390](evidence/2026-10-21/tablet/signature-step-390x844.png), [refusal confirmed](evidence/2026-10-21/tablet/refusal-confirmed-1366x768.png), [signature confirmed](evidence/2026-10-21/tablet/signature-confirmed-1366x768.png)
- **Code:** `apps/tablet/src/routes/EntryFlow.tsx` (flow ends at signature/refusal); `apps/api/src/preIssuance/routes.ts:27-28` (“deliberately no issuance or submission route here”); README lines 8–10.
- **Recommended fix:** Implement I-06 submission with server-side number assignment, all-or-nothing finalisation, signed/refused acknowledgement binding, photo ownership, idempotency/retry, disabled in-flight state and a success screen. Add the reserved green commit action only when the record is valid.
- **Confidence:** High

### AUD-02 — Empty sign-in renders raw Zod JSON

- **Severity:** High
- **Type:** Confirmed defect
- **Role:** Anonymous / all
- **Page/route:** Tablet sign-in and Admin sign-in
- **Viewports:** 390 × 844, 1366 × 768
- **Expected:** A friendly required-field message, ideally inline, with focus on the first invalid field.
- **Actual:** The alert displays a serialized Zod issue array (`origin`, `code`, `too_small`, `minimum`, paths, messages), because `LoginRequestSchema.parse(...)` throws before the request and the login screen prints `Error.message`.
- **Reproduction:** Open either sign-in screen with both fields empty → press Sign in.
- **Evidence:** [tablet empty sign-in](evidence/2026-10-21/tablet/login-empty-alert-390x844.png), [admin empty sign-in](evidence/2026-10-21/admin/login-empty-alert-1366x768.png), [Playwright trace](evidence/2026-10-21/traces/login-empty-validation.zip)
- **Code:** `apps/tablet/src/auth/api.ts:116`, `apps/admin/src/auth/api.ts:64`, `apps/tablet/src/routes/LoginScreen.tsx:79-84`, `apps/admin/src/routes/LoginScreen.tsx:46-48`.
- **Recommended fix:** Validate username/password in the form before calling the API, or catch `ZodError` and map to “Enter your username” / “Enter your password.” Never display a serialized validation object.
- **Confidence:** High

### AUD-03 — MUI buttons and tabs have no visible keyboard focus

- **Severity:** High
- **Type:** Confirmed defect
- **Role:** All
- **Page/route:** Both apps, every screen with buttons or tabs
- **Viewports:** 390 × 844, 1366 × 768
- **Expected:** A visible focus indicator (WCAG 2.4.7) on every keyboard-focusable control.
- **Actual:** Computed style is `outline: none 0px` for “Show password”, “Sign in”, “Log out”, “Open”, “Start review”, “Create user” and tab labels. Screenshots show no indicator. Text inputs/selects do show a 3 px dark outline.
- **Reproduction:** Sign in → press Tab repeatedly → stop on any button/tab; compare with a focused text input. Or open Admin Challans and Tab to “Open”.
- **Evidence:** [focused Show password with no indicator](evidence/2026-10-21/a11y/focus-show-password-no-indicator.png), [focused Open with no indicator](evidence/2026-10-21/a11y/focus-open-button-no-indicator.png)
- **Code:** Button override in `packages/theme/src/createTheme.ts:143-156`; global focus rule at `:329` is not effective for ButtonBase.
- **Recommended fix:** Add explicit `&:focus-visible` styling to `MuiButtonBase`/`MuiButton`/`MuiIconButton`/`MuiTab` with a 3 px `tokens.blue` outline (or equivalent high-contrast ring) and offset; verify in both apps.
- **Confidence:** High

### AUD-04 — Admin reporting/list surface is incomplete

- **Severity:** High
- **Type:** Scope gap
- **Role:** Admin, Supervisor
- **Page/route:** Admin `/` — Challans
- **Viewport:** 1366 × 768 (desktop), 390 × 844
- **Expected:** Summary tiles (total/today/pending/resolved/repeat), date range/location/violation/severity/department/vehicle/gate-pass/marshal filters, sortable/paginated results and server-generated Excel export (PRD E4.1–E4.5).
- **Actual:** One status filter, a static table, no totals, no sort, no pagination, no export and no result count. `MAX_LIST_ITEMS = 200` silently truncates without warning. The screen title describes the review workspace, not reporting.
- **Reproduction:** Open Challans as Admin; inspect header, filter, table headers and page footer. Click a column header: nothing sorts. No export/total control exists.
- **Evidence:** [Admin challans desktop](evidence/2026-10-21/admin/admin-challans-laptop.png), [Admin challans mobile](evidence/2026-10-21/admin/admin-challans-small-mobile.png)
- **Code:** `apps/admin/src/features/challans/ChallanReviewPanel.tsx:82-161`; `apps/api/src/challans/service.ts:23,77`.
- **Recommended fix:** Build the reporting surface as a planned P0 slice: server-side filters, deterministic sort, pagination/count, totals, and audited export. Remove or explicitly disclose the 200-row cap.
- **Confidence:** High

### AUD-05 — Challan detail cannot show evidence photos or signature

- **Severity:** High
- **Type:** Scope gap
- **Role:** Supervisor, Admin
- **Page/route:** Admin `/` — Challan details dialog
- **Viewport:** 1366 × 768
- **Expected:** Reviewers can inspect all fields, photos and the signature for a challenged record (PRD E3.2).
- **Actual:** The dialog shows data fields, violations, remarks, cancellation reason and history, but no photo gallery, signature image or evidence link. No evidence route exists.
- **Reproduction:** Admin → Challans → Open any record → inspect every section. There is no evidence section.
- **Evidence:** [Challan detail desktop](evidence/2026-10-21/admin/admin-challan-detail-laptop.png)
- **Code:** `apps/admin/src/features/challans/ChallanDetailDialog.tsx` (no evidence rendering); README lines 8–9.
- **Recommended fix:** Add authenticated, authorised, logged evidence access (photos + signature) to the detail view, with loading/error states and immutable-record handling.
- **Confidence:** High

### AUD-06 — Cancellation is absent from UI and API

- **Severity:** High
- **Type:** Scope gap
- **Role:** Admin (required approver)
- **Page/route:** Admin `/` — Challan details
- **Expected:** Admin can cancel from Issued/Under Review/Resolved with a mandatory reason; Cancelled is terminal; record/history retained and audited (PRD E3.5, D3).
- **Actual:** No cancellation control. `POST /challans/:id/review` returns `invalid_transition: “Cancellation is not part of this review workflow.”`
- **Reproduction:** Open any non-cancelled detail as Admin; inspect actions. Only Start review/Resolve/Reopen exist. Direct API cancellation is refused.
- **Evidence:** [Reviewed resolved detail](evidence/2026-10-21/admin/review-resolved-1366x768.png), [Cancelled record](evidence/2026-10-21/admin/admin-challan-detail-small-mobile.png)
- **Code:** `apps/api/src/challans/service.ts:220-224`; `ChallanDetailDialog.tsx` actions.
- **Recommended fix:** Implement the approved Admin cancellation transition with mandatory reason, audit/appended history, terminal guard and confirmation UI.
- **Confidence:** High

### AUD-07 — Master-data management screens are missing

- **Severity:** High
- **Type:** Scope gap
- **Role:** Admin
- **Page/route:** Admin `/` — no Master data tab
- **Expected:** Admin can manage violation types/severity/default action, departments, contractors, locations/gates and vehicle types; deactivate rather than delete (PRD E5.1–E5.3).
- **Actual:** Admin APIs exist (`GET/POST /admin/masters/:kind`, `PATCH`, deactivate) but the dashboard exposes only Challans, Users and Profile. No UI uses these endpoints.
- **Reproduction:** Sign in as Admin; inspect tabs and all screens. No master-data entry point exists.
- **Evidence:** [Admin tabs](evidence/2026-10-21/admin/admin-challans-laptop.png)
- **Code:** `apps/admin/src/routes/DashboardScreen.tsx:53-66`; `apps/api/src/masters/routes.ts`.
- **Recommended fix:** Add master-data screens with active/inactive lists, create/edit, deactivation confirmation, validation and role-gated API calls.
- **Confidence:** High

### AUD-08 — Admin tables hide status/actions on small screens

- **Severity:** Medium
- **Type:** Confirmed defect
- **Role:** Admin, Supervisor
- **Page/route:** Admin `/` — Challans and Users
- **Viewports:** 360 × 800, 390 × 844, 430 × 932, 768 × 1024
- **Expected:** Table content/actions remain discoverable; no essential control is off-screen behind an undisclosed scroll.
- **Actual:** Challans table is 923 px wide in 294–686 px containers. At 390, the first Open action is at x≈860. Status/Issued/Action disappear; row height is 155 px. Users table is 862 px wide at 360; Active/Locations/Actions are off-screen. The horizontal scrollbar is at the table bottom and not visible in the initial viewport.
- **Reproduction:** Set 390 × 844 → Admin → Challans; inspect visible columns and scroll horizontally. Repeat on Users.
- **Evidence:** [Supervisor challans at 360](evidence/2026-10-21/admin/supervisor-challans-small-mobile.png), [admin table at 390](evidence/2026-10-21/admin/admin-mobile-table-390x844.png), [long-data row](evidence/2026-10-21/admin/long-data-mobile-390x844.png)
- **Code:** `apps/admin/src/features/challans/ChallanReviewPanel.tsx:116`; `UserAdminPanel.tsx:326`.
- **Recommended fix:** Choose a deliberate mobile strategy: responsive card/stacked rows, sticky first/action columns, column visibility controls, or an explicit “desktop required” guard. Do not rely on an undisclosed nested scrollbar.
- **Confidence:** High

### AUD-09 — Input boundary contrast is 1.50:1

- **Severity:** Medium
- **Type:** Confirmed defect
- **Role:** All
- **Page/route:** Both sign-in screens and all forms
- **Viewport:** 1366 × 768
- **Expected:** UI component boundaries meet 3:1 non-text contrast (WCAG 1.4.11) and the token’s own claim (`tokens.ts:10`).
- **Actual:** Fieldset border `rgb(201, 212, 226)` on white calculates to **1.50:1**. Against the canvas it is 1.37:1. The input is still identified by its label, but the field outline is effectively lost in glare/low vision.
- **Reproduction:** Focus any non-focused input and inspect the computed fieldset border; calculate contrast against the white input background.
- **Evidence:** [Tablet entry with pale fields](evidence/2026-10-21/tablet/entry-form-laptop.png), [Admin create dialog](evidence/2026-10-21/admin/admin-create-user-laptop.png)
- **Code:** `packages/theme/src/tokens.ts:29`; `createTheme.ts` OutlinedInput `borderColor: tokens.line`.
- **Recommended fix:** Darken the default border token to at least 3:1 against white/canvas (or use a 2 px border / stronger surface distinction), then re-measure in both apps.
- **Confidence:** High

### AUD-10 — No client routing; Back exits the app and state is not addressable

- **Severity:** Medium
- **Type:** Confirmed defect
- **Role:** All
- **Page/route:** Both apps
- **Expected:** Browser Back/Forward behaves predictably; refresh/direct URL preserves the current screen; detail/tab state is linkable.
- **Actual:** Both apps have one `/` route. Back from an authenticated screen navigates to `about:blank`; refresh resets to Challans/no dialog; an unknown path renders the app shell; a challan cannot be opened by URL. With no history entries, dialogs are not Back-dismissible.
- **Reproduction:** Sign in to Admin → open Challans → press browser Back. Or open a detail and refresh.
- **Evidence:** [After browser Back](evidence/2026-10-21/admin/after-back.png), [tablet after Back](evidence/2026-10-21/tablet/after-back.png)
- **Code:** `apps/*/src/App.tsx` (single conditional shell); no router dependency in `package.json`.
- **Recommended fix:** Introduce React Router with guarded routes (`/`, `/challans`, `/challans/:id`, `/users`, `/profile`) and let dialogs/tabs reflect URL state. Preserve session checks at route boundaries.
- **Confidence:** High

### AUD-11 — Draft is lost on refresh/accidental navigation

- **Severity:** Medium
- **Type:** Scope gap (P1)
- **Role:** Marshal
- **Page/route:** Tablet entry form
- **Expected:** A draft survives refresh/backgrounding/accidental navigation and can be resumed (PRD E2.18, P1).
- **Actual:** Filling the form and refreshing clears all values. The session persists, but the draft does not.
- **Reproduction:** Sign in → enter Driver name → refresh → Driver name is empty.
- **Evidence:** No screenshot needed; reproduced in browser (edge check). Entry form screenshot for context: [entry form](evidence/2026-10-21/tablet/entry-form-laptop.png)
- **Code:** `EntryFlow` local component state only; no persistence layer.
- **Recommended fix:** Persist a versioned draft (IndexedDB/local storage) keyed to session/post/shift, clear on logout, and provide resume/discard on return. This is P1, not a P0 blocker.
- **Confidence:** High

### AUD-12 — Secondary text misses the product’s 7:1 contrast target

- **Severity:** Medium
- **Type:** Static finding + measurement
- **Role:** All
- **Page/route:** All surfaces
- **Expected:** Product target is body text ≥ 7:1 (`tokens.ts:9`), driven by outdoor glare.
- **Actual:** `muted #4E5D75` on white = **6.67:1**; on canvas = **6.11:1**. Card-header subheads (white at 82% on blue) = **4.99:1**. WCAG AA passes, so this is a product-target miss rather than an AA failure.
- **Reproduction:** Compute contrast from the rendered colors; sample helper text and card subheads.
- **Evidence:** [Entry form](evidence/2026-10-21/tablet/entry-form-laptop.png), [Admin table](evidence/2026-10-21/admin/admin-challans-laptop.png)
- **Code:** `packages/theme/src/tokens.ts:32`; `createTheme.ts:189`.
- **Recommended fix:** Darken `muted` to reach 7:1 on white/canvas, and strengthen card subhead contrast or treat it as large/secondary text with a documented exception.
- **Confidence:** High

### AUD-13 — Admin mobile controls are 40 px high

- **Severity:** Low
- **Type:** Static finding + measurement
- **Role:** Admin, Supervisor
- **Page/route:** Admin sign-in, table actions, dialogs
- **Viewports:** 360, 390, 430
- **Expected:** Touch guidance is 44 px (WCAG 2.5.5) and the product uses 56–64 px on tablet.
- **Actual:** Desktop theme intentionally uses `desktopAction: 40`; at mobile widths the same 40 px buttons/inputs are retained. Measured: Show password 40 × 40, Sign in 40 high, filter input 21 px internal height, every table action 40 high.
- **Reproduction:** Open Admin at 390 and measure any action.
- **Evidence:** [Admin login at 360](evidence/2026-10-21/admin/login-small-mobile.png), [Users at 360](evidence/2026-10-21/admin/admin-users-small-mobile.png)
- **Code:** `packages/theme/src/touchTargets.ts:55-56`; `createTheme.ts:147-149`.
- **Recommended fix:** Use 44–48 px for interactive targets at mobile breakpoints, or explicitly state Admin is desktop-only.
- **Confidence:** High

### AUD-14 — Admin form validation is less accessible/consistent than tablet validation

- **Severity:** Low
- **Type:** Confirmed defect (UX consistency)
- **Role:** Admin
- **Page/route:** Create user, Reset password, Resolve challan, Reopen
- **Viewport:** 390 × 844, 1366 × 768
- **Expected:** Consistent error discovery: summary, focus move or live announcement.
- **Actual:** Inline helper text only; no summary, no focus move after submit (active element remains the submit button), no live region. The entry form has the opposite, stronger pattern. At 390 the Create User submit action starts below the viewport, making the error feedback less discoverable.
- **Reproduction:** Users → Create user → scroll to bottom → click Create with empty fields; inspect errors and focus.
- **Evidence:** [Create-user validation](evidence/2026-10-21/admin/create-user-validation-1366x768.png), [mobile errors](evidence/2026-10-21/admin/create-user-mobile-errors-390x844.png)
- **Code:** `CreateUserDialog.tsx`, `UserAdminPanel.tsx` reset/deactivate dialogs, `ChallanDetailDialog.tsx`.
- **Recommended fix:** Adopt `ErrorSummary`/focus-first-error for admin forms, or add a persistent live error region; keep actions sticky on mobile.
- **Confidence:** High

### AUD-15 — Users list has no empty state

- **Severity:** Low
- **Type:** Confirmed defect
- **Role:** Admin
- **Page/route:** Admin `/` — Users
- **Viewport:** 1366 × 768
- **Expected:** “No users yet” plus a Create user action, matching the Challans empty state.
- **Actual:** A bare table header is rendered; no message or action.
- **Reproduction:** Mock an empty `/admin/users` response (or use a fresh database with no users) → Users tab.
- **Evidence:** [Users empty](evidence/2026-10-21/admin/users-empty-1366x768.png)
- **Code:** `apps/admin/src/features/users/UserAdminPanel.tsx:326-405`.
- **Recommended fix:** Add an explicit empty state with the existing Create user action.
- **Confidence:** High

### AUD-16 — PWA surface is incomplete; titles/favicon are placeholder

- **Severity:** Low
- **Type:** Static/browser finding
- **Role:** All
- **Page/route:** Both app shells
- **Expected:** Installable tablet PWA with manifest, icons, theme-colour and offline worker where claimed.
- **Actual:** No manifest link, icons, theme-color or service worker registration. Titles are “e-Challan Tablet Foundation” / “e-Challan Admin Foundation”. `/favicon.ico` returns 404 on both origins.
- **Reproduction:** Inspect `document.head`/service worker registrations, or request `/favicon.ico`; observe tab title.
- **Evidence:** Console/favicon observations; entry screenshots show no logo.
- **Code:** `apps/tablet/index.html:6`, `apps/admin/index.html:6`; no manifest/service worker assets.
- **Recommended fix:** Add product titles, favicon/app icons and a web app manifest; add a service worker only if offline/installability is in scope (offline is P2).
- **Confidence:** High

### AUD-17 — Camera-unavailable copy is malformed

- **Severity:** Low
- **Type:** Confirmed defect
- **Role:** Marshal
- **Page/route:** Photos and signature
- **Viewport:** 1366 × 768
- **Expected:** A plain sentence telling the marshal what to do.
- **Actual:** “This device does not support camera capture. camera permission.”
- **Reproduction:** Open the flow in a context without a camera and press Start camera.
- **Evidence:** [Camera unavailable](evidence/2026-10-21/tablet/camera-unavailable-1366x768.png)
- **Code:** `apps/tablet/src/features/photos/PhotoCapture.tsx:207,494-510`.
- **Recommended fix:** Use a complete fallback sentence (for example, “This device does not support camera capture. Use a supported tablet or ask your supervisor.”).
- **Confidence:** High

### AUD-18 — Anonymous pages log two 401s per load

- **Severity:** Low
- **Type:** Confirmed defect (observability/noise)
- **Role:** Anonymous
- **Page/route:** Both sign-in screens
- **Expected:** No failed requests before a token exists; quiet console.
- **Actual:** `GET /api/auth/session` is called unconditionally without a token and returns 401; React StrictMode doubles the effect in development, producing two console errors per load.
- **Reproduction:** Open either sign-in page with DevTools console open.
- **Evidence:** Console capture; [login screenshot](evidence/2026-10-21/tablet/login-laptop.png)
- **Code:** `fetchSession` in both `auth/api.ts`; `SessionProvider` effect.
- **Recommended fix:** Skip the session request when no token is stored; treat 401 as an expected anonymous state without a console error.
- **Confidence:** High

### AUD-19 — Deactivation uses routine primary styling

- **Severity:** Low
- **Type:** Design finding
- **Role:** Admin
- **Page/route:** Deactivate user dialog
- **Viewport:** 1366 × 768, 390 × 844
- **Expected:** Destructive actions are visually distinct from routine actions and separated from them (design guidance).
- **Actual:** “Deactivate user” is the same solid blue primary as “Create user”; the row-level Deactivate is a plain text button next to Reset password.
- **Reproduction:** Users → Deactivate a non-self user.
- **Evidence:** [Users desktop](evidence/2026-10-21/admin/admin-users-laptop.png)
- **Code:** `UserAdminPanel.tsx` DeactivateDialog.
- **Recommended fix:** Use a destructive/error treatment for confirmation, keep Cancel visually safer, and avoid adjacent placement of reset and deactivate.
- **Confidence:** High

### AUD-20 — Create user action starts below the mobile viewport

- **Severity:** Low
- **Type:** Confirmed layout finding
- **Role:** Admin
- **Page/route:** Create user dialog
- **Viewport:** 390 × 844
- **Expected:** Primary action reachable without hunting; sticky action area or shorter form.
- **Actual:** Dialog content is 726 px with 817 px of content; the Create user button bottom is at ~884 px initially and only becomes visible after scrolling the dialog content.
- **Reproduction:** Admin → Users → Create user at 390; inspect initial viewport.
- **Evidence:** [Create dialog at 390](evidence/2026-10-21/admin/admin-create-user-small-mobile.png), [after scrolling](evidence/2026-10-21/admin/create-user-mobile-bottom-390x844.png)
- **Code:** `CreateUserDialog.tsx` layout.
- **Recommended fix:** Sticky DialogActions and/or a compact mobile layout; keep actions visible while scrolling fields.
- **Confidence:** High

### AUD-21 — Challans empty state lacks a clear-filter action

- **Severity:** Low
- **Type:** Design finding
- **Role:** Supervisor, Admin
- **Page/route:** Challans list
- **Expected:** Empty states point somewhere, e.g. “Clear filter” (design section 11).
- **Actual:** “No challans match this filter.” with no action; the filter is nearby but the recovery is implicit.
- **Reproduction:** Select a status with no rows (or mock an empty response).
- **Evidence:** [Empty state not captured separately; filter context](evidence/2026-10-21/admin/admin-challans-laptop.png)
- **Code:** `ChallanReviewPanel.tsx:114`.
- **Recommended fix:** Add “Clear filter” and optionally a location/date reset action when those filters arrive.
- **Confidence:** High (code/browser)

### AUD-22 — Page titles and casing are inconsistent/placeholder

- **Severity:** Low
- **Type:** Design/copy finding
- **Role:** All
- **Page/route:** Both apps
- **Expected:** Consistent sentence case and product titles without implementation labels.
- **Actual:** “Create New Safety Violation” (title case), “e-Challan Dashboard”, “e-Challan dashboard sign-in”, “e-Challan marshal sign-in”; browser titles include “Foundation”.
- **Reproduction:** Compare headings and browser tabs.
- **Evidence:** [Tablet entry](evidence/2026-10-21/tablet/entry-form-laptop.png), [Admin header](evidence/2026-10-21/admin/supervisor-challans-laptop.png)
- **Code:** `App.tsx` headings, `LoginScreen.tsx` headings, `index.html` titles.
- **Recommended fix:** Adopt one copy standard and product titles; reserve “Foundation” for development documentation.
- **Confidence:** High

### AUD-23 — Some colours bypass the theme tokens

- **Severity:** Low
- **Type:** Static finding
- **Role:** All
- **Page/route:** Signature/camera/app bars
- **Expected:** All semantic colours come from `tokens` so the design system can be changed once.
- **Actual:** Signature pen `#12243D`, camera surfaces `#0B1220`, white canvas fills and app-bar overlay alphas are hardcoded. Most are context-specific, but the pen colour is close to yet different from `tokens.ink (#0E1D33)`.
- **Reproduction:** Inspect the listed source.
- **Evidence:** Code; screenshots show the result.
- **Code:** `SignaturePad.tsx:228`, `PhotoCapture.tsx:370,388`, `App.tsx` overlays.
- **Recommended fix:** Add dedicated tokens for media surfaces/pen where semantic, or document them as local rendering constants.
- **Confidence:** High

### AUD-24 — Admin intro card dominates every tab

- **Severity:** Low
- **Type:** Design/layout finding
- **Role:** Supervisor, Admin
- **Page/route:** Admin dashboard, all tabs
- **Viewport:** 360 × 800, 390 × 844
- **Expected:** Task content is prioritised; onboarding is secondary/dismissible.
- **Actual:** The “Demo review workspace” card plus explanatory paragraph remains above Challans/Users/Profile and consumes roughly the first 330 px at 360. The task content starts below the fold.
- **Reproduction:** Open Admin at 360 and inspect the first viewport of Users/Profile.
- **Evidence:** [Users at 360](evidence/2026-10-21/admin/admin-users-small-mobile.png), [Supervisor challans at 360](evidence/2026-10-21/admin/supervisor-challans-small-mobile.png)
- **Code:** `apps/admin/src/routes/DashboardScreen.tsx:28-46`.
- **Recommended fix:** Show it only on first visit/Challans, make it dismissible, or collapse it to a one-line context bar.
- **Confidence:** High

---

## 9. Recommended Remediation Plan

### Work package 1 — Complete P0 issuance (blocks release)

**Issues:** AUD-01, AUD-11 (supporting), AUD-05 (evidence contract dependency)

1. Implement the server submission endpoint and immutable record creation: number assignment, evidence/signature/refusal binding, duplicate/occurrence validation, all-or-nothing persistence, audit row.
2. Add the reserved green commit action with an in-flight disabled state, retry/idempotency, and a success screen showing the assigned number.
3. Persist a resumable draft only after the submission contract is stable (P1).
4. Test on a real tablet with trusted HTTPS, rear camera, stylus/finger and plant Wi-Fi.

### Work package 2 — Complete P0 Admin capabilities

**Issues:** AUD-04, AUD-05, AUD-06, AUD-07

1. Reporting: totals, required filters, server-side sort/pagination/count, audited Excel export; remove the silent 200-row cap.
2. Evidence viewer: authenticated/authorised/logged photo and signature access in detail.
3. Admin cancellation with reason, terminal guard, history and audit.
4. Master-data screens for all required kinds, with deactivation instead of deletion.

### Work package 3 — Design-system and accessibility fixes

**Issues:** AUD-02, AUD-03, AUD-09, AUD-12, AUD-19, AUD-22, AUD-23, AUD-14

1. Fix button/tab focus at the theme component level; add a regression test that tabs to every control and asserts a visible focus indicator.
2. Map empty login submission to friendly inline errors; never render serialized Zod data.
3. Darken the default input border to 3:1 and recheck all non-text contrast.
4. Raise `muted`/card-subhead contrast to the documented target or record an approved exception.
5. Standardise copy/casing, titles, destructive treatment and common field-row primitives.
6. Reuse the entry-form error summary/focus pattern in Admin forms.

### Work package 4 — Responsive and state handling

**Issues:** AUD-08, AUD-10, AUD-13, AUD-15, AUD-20, AUD-21, AUD-24

1. Choose a mobile Admin strategy: responsive row cards/sticky action column/column controls or an explicit desktop-only guard. Do not rely on a hidden nested scrollbar.
2. Raise controls to 44–48 px where touch is supported.
3. Add routing and deep links; make Back close dialogs/return to the list, and restore state on refresh.
4. Add Users empty state, clear-filter action, sticky dialog actions and a compact campaign/context banner.
5. Re-run visual regression at 360/390/430/768/1366/1920 and 200% zoom.

### Work package 5 — Polish and observability

**Issues:** AUD-16, AUD-17, AUD-18

1. Replace “Foundation” titles; add favicon, manifest and icons; decide whether installability/service worker is in scope.
2. Fix the camera-unavailable sentence and review all media error copy.
3. Skip session probing when no token exists; reduce anonymous console noise.

### Work package 6 — Verification hardening

1. Add automated accessibility checks (axe or equivalent) for labels, focus, contrast and duplicate IDs in CI.
2. Add browser tests for empty login, focus-visible, mobile table action visibility and modal action reachability.
3. Keep real-database tests for review/user transitions and real-device evidence for camera, signature and sunlight/glove conditions.

---

## 10. Final Verification Summary

### 10.1 Coverage achieved

| Measure | Result |
|---|---|
| Roles discovered | 3 application roles + anonymous = 4 principals |
| URL routes discovered | 2 (one per app); no client router |
| Primary UI states discovered | 17 |
| Primary UI states tested | **17 / 17** |
| Additional states tested | Empty list, loading, error/retry, duplicate warning, camera unavailable, catalogue error, expired session, unknown URL, role refusal |
| Distinct control types/patterns exercised | **94** (including all 6 violation checkboxes and all 5 status options individually) |
| Screenshots captured | 98 |
| Playwright traces | 1 (anonymous empty sign-in) |
| API authorization checks | 20 / 20 passed |
| Viewports | 6 + 200%-equivalent check |
| Browsers | Chromium, Firefox; WebKit blocked |
| Tablet initial JS | **156,623 B gzip** (under 250,000 B budget) |

### 10.2 What passed

- Role separation and API authorization, including direct-URL-style API access, cross-location denial, token revocation and session expiry.
- Tablet entry validation, registry/combobox/keyboard interaction, autocomplete, master selection, all violation checkboxes, “Other” rule, vehicle normalisation, duplicate acknowledgement and error recovery.
- Fake-device photo capture, retake, signature draw/confirm/clear/sign-again, refusal capture and camera failure state.
- Admin status filtering, loading/empty/error/retry, detail variants, review lifecycle, Admin reopen, user create/reset/deactivate/reactivate, self-deactivation guard, profiles.
- Labels, heading order, duplicate IDs, image alternatives, dialog focus containment, keyboard combobox, error-summary links and text contrast (WCAG AA).
- Tablet responsive layout, no document overflow, 56–64 px target compliance, 200%-equivalent no-overflow, self-hosted fonts and bundle budget.
- Firefox smoke of tablet and admin flows.

### 10.3 Pre-remediation failures (addressed in §11)

- No challan submission (Critical).
- Raw Zod JSON on empty sign-in (High).
- Missing visible keyboard focus (High).
- Admin reporting/list, evidence viewer, cancellation and master-data screens missing (High).
- Admin tables and some dialog actions are not usable at small widths (Medium).
- Input border contrast fails 3:1; secondary text misses the 7:1 product target (Medium).
- No routing/deep links; Back exits the app; draft and tab state are lost (Medium).
- User empty state, camera copy, PWA surface, console noise and destructive styling (Low).

### 10.4 Not verified / blocked

- Real gate device, rear camera, stylus, sunlight/glove use and trusted HTTPS.
- WebKit/Safari; launch blocked by missing host libraries.
- Ambiguous post/shift login selection (single seeded context).
- True ten-minute idle timer (forced expiry was used instead).
- True browser zoom at 200%; half-viewport equivalent only.
- Photo maximum (4) and encoding-failure edge cases; upload does not exist.
- Submission/evidence/cancellation/export/master-data because those capabilities are absent.
- No claim is made about pilot acceptance, staff usability or production security beyond the checks above.

---

## 11. Remediation Verification (2026-10-22)

Implementation record: `docs/handoffs/audit-remediation.md`.

| ID | Status | Verification |
|---|---|---|
| AUD-01 | Fixed | Signed and refused submissions issue server numbers, persist files/DB rows and replay idempotently. |
| AUD-02 | Fixed | Empty sign-in shows a plain message; no serialized Zod output on either client. |
| AUD-03 | Fixed | Button/tab focus has a visible 3 px ring; verified in Chromium. |
| AUD-04 | Fixed | Server report with totals, ten filters, sort, pagination and audited XLSX export. |
| AUD-05 | Fixed | Scoped evidence metadata and logged photo/signature byte routes; detail viewer renders them. |
| AUD-06 | Fixed | Admin-only reason-required cancellation, terminal guard, history and audit. |
| AUD-07 | Fixed | Admin Masters tab creates/edits/deactivates all six master kinds. |
| AUD-08 | Fixed | Admin tables render stacked cards below 1200 px; mobile filters collapse on demand. |
| AUD-09 | Fixed | Input boundary uses `#7E8EA6`, measured ≥3:1 on white/canvas. |
| AUD-10 | Fixed | Admin tabs/details are URL-owned; Back/refresh/direct links behave; tablet owns `/` and `/entry` (single-screen Back remains browser-level). |
| AUD-11 | Fixed | Text draft, operation id and issued receipt survive refresh via tab-scoped storage; media must be recaptured. |
| AUD-12 | Fixed | `muted` measured ≥7:1 on white/canvas; card subheads are white. |
| AUD-13 | Fixed | Admin controls now use a 44 px floor. |
| AUD-14 | Fixed | Admin forms use a focused error summary; inline messages remain. |
| AUD-15 | Fixed | Users empty state has explanatory text and Create-first-user CTA. |
| AUD-16 | Fixed | Titles, favicon, manifest, icons and production service worker added; manifest/SW verified on preview. |
| AUD-17 | Fixed | Camera-unavailable copy is complete and actionable. |
| AUD-18 | Fixed | Anonymous loads make no session probe and log no 401s. |
| AUD-19 | Fixed | Deactivation is error-coloured in the row and confirmation. |
| AUD-20 | Fixed | Create/Reset dialog actions sit outside the scrolling content; measured visible at 390 px. |
| AUD-21 | Fixed | Filtered empty state exposes Clear filter. |
| AUD-22 | Fixed | Product titles and shell headings use one sentence-case style. |
| AUD-23 | Fixed | Signature pen, camera surface and navy overlays use theme tokens; remaining shadow is documented. |
| AUD-24 | Fixed | Dashboard intro reduced to a compact heading/subtitle block. |

**Remaining review/acceptance items:** independent review, real gate hardware,
real camera/signature/HTTPS, true 200% browser zoom, and the full SUB-07 timing
metric. These are not code-quality failures in the audited scope.

## Appendix A — Key Evidence Index

All paths are relative to `docs/audits/`.

| Evidence | File |
|---|---|
| Tablet empty sign-in — raw JSON | `evidence/2026-10-21/tablet/login-empty-alert-390x844.png`, `evidence/2026-10-21/tablet/login-empty-alert-1366x768.png` |
| Admin empty sign-in — raw JSON | `evidence/2026-10-21/admin/login-empty-alert-1366x768.png` |
| Playwright trace — empty login | `evidence/2026-10-21/traces/login-empty-validation.zip` |
| Tablet entry form, all viewports | `evidence/2026-10-21/tablet/entry-form-*.png` |
| Tablet summary, mobile/tablet | `evidence/2026-10-21/tablet/summary-*.png` |
| Tablet signature step, mobile/tablet | `evidence/2026-10-21/tablet/signature-step-*.png` |
| Confirmed signature / refusal | `evidence/2026-10-21/tablet/signature-confirmed-1366x768.png`, `evidence/2026-10-21/tablet/refusal-confirmed-1366x768.png` |
| Duplicate warning | `evidence/2026-10-21/tablet/duplicate-warning-1366x768.png` |
| Camera unavailable | `evidence/2026-10-21/tablet/camera-unavailable-1366x768.png` |
| Catalogue network error/retry | `evidence/2026-10-21/tablet/catalogue-network-error-1366x768.png` |
| Admin challans, desktop/mobile | `evidence/2026-10-21/admin/admin-challans-laptop.png`, `evidence/2026-10-21/admin/supervisor-challans-small-mobile.png` |
| Admin detail / review resolved | `evidence/2026-10-21/admin/admin-challan-detail-laptop.png`, `evidence/2026-10-21/admin/review-resolved-1366x768.png` |
| Admin users / empty / create / mobile action | `evidence/2026-10-21/admin/admin-users-laptop.png`, `evidence/2026-10-21/admin/users-empty-1366x768.png`, `evidence/2026-10-21/admin/admin-create-user-small-mobile.png`, `evidence/2026-10-21/admin/create-user-mobile-errors-390x844.png` |
| Long data / table overflow | `evidence/2026-10-21/admin/long-data-mobile-390x844.png`, `evidence/2026-10-21/admin/admin-mobile-table-390x844.png` |
| Focus indicator failure (pre-fix) | `evidence/2026-10-21/a11y/focus-show-password-no-indicator.png`, `evidence/2026-10-21/a11y/focus-open-button-no-indicator.png` |
| Focus indicator fixed | `evidence/2026-10-21/a11y/focus-open-button-fixed.png` |
| Final reporting dashboard | `evidence/2026-10-21/admin/report-dashboard-final-1366x768.png` |
| Mobile cards / collapsed filters | `evidence/2026-10-21/admin/mobile-cards-390x844.png`, `evidence/2026-10-21/admin/mobile-filters-390x844.png` |
| Evidence viewer | `evidence/2026-10-21/admin/detail-evidence-1366x768.png` |
| XLSX export | `evidence/2026-10-21/admin/echallan-report.xlsx` |
| Empty users state | `evidence/2026-10-21/admin/users-empty-new-1366x768.png` |
| Friendly login error | `evidence/2026-10-21/tablet/login-friendly-390x844.png`, `evidence/2026-10-21/admin/login-friendly-390x844.png` |
| Zoom-equivalent tablet | `evidence/2026-10-21/a11y/tablet-entry-zoom200-top.png` |
| Back navigation | `evidence/2026-10-21/admin/after-back.png`, `evidence/2026-10-21/tablet/after-back.png` |

No credentials or session tokens are included in the evidence set.
