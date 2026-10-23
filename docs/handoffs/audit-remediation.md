# Audit remediation — remaining findings

**Date:** 2026-10-22  
**Scope:** All remaining findings in
`docs/audits/2026-10-21-comprehensive-app-audit.md` (AUD-02–AUD-24). AUD-01 was
implemented earlier in `docs/handoffs/AUD-01-submission.md`.  
**Review state:** Implemented and verified locally; independent review is still
required. No review checkbox has been ticked.

## Implemented changes

### Shared theme and interaction quality

- Friendly sign-in validation on both clients; empty credentials stay local and
  show `Enter your username and password.` instead of serialized Zod output.
- `LoginRequestSchema` is still the shared contract, but client parse failures
  are translated to a stable auth error.
- Visible keyboard focus on buttons, icon buttons, tabs and table sort labels.
  App-bar buttons use a white focus ring on navy; other controls use the blue
  ring with a light halo.
- Input boundaries now use `fieldLine #7E8EA6` (≥3:1 on white and canvas);
  `muted` moved to `#445268` (≥7:1 on white/canvas); primary blue is `#0A4FAF`
  (≥7:1 with white); card-header subheads use white.
- Admin controls are 44 px high. Deactivate controls use the error colour.
- Camera-unavailable copy is now a complete sentence and no longer concatenates
  a fallback fragment.
- Anonymous pages no longer probe `/auth/session`; no 401 console noise.
- Product titles, favicons, web manifests, install icons and a production-only
  tablet service worker were added. `/favicon.ico` now returns 200.
- Copy standardised to sentence case for the shell/page headings.

### Admin navigation and layout

- Admin tabs and challan details are URL-owned (`/challans`,
  `/challans/:id`, `/users`, `/masters`, `/profile`); Back closes a detail and
  returns to the list, refresh keeps the section and unknown URLs show a 404.
- Dashboard intro card reduced to a compact heading/subtitle block.
- Challans, Users and Master data render stacked cards below 1200 px instead of
  hiding status/action columns behind a nested horizontal scrollbar.
- Filters collapse behind `Show filters` on narrow screens; the filter option
  load is non-fatal.
- Create/Reset dialog actions are outside the scrolling content, so primary
  actions remain visible at 390 px.

### Admin reporting

- New server-side `GET /challans/report` with Kolkata date filters, location,
  status, severity, department, violation type, issuing marshal, vehicle, gate
  pass, sorting and pagination.
- Totals tiles: total, issued today, pending, resolved and repeat offenders
  (90 days).
- New `GET /challans/report/export` generates a real `.xlsx` with ExcelJS and
  writes an audited `challans.exported` event containing filters and row count.
- Table sort controls, pagination, clear-filter CTA and export download.

### Evidence and cancellation

- Authenticated `GET /challans/:id/evidence` metadata plus scoped photo and
  signature byte routes. Every byte view writes an `evidence.viewed` audit row.
- Detail dialog renders evidence photos, signature and refusal data through
  short-lived object URLs.
- Admin-only cancellation from any non-cancelled status with mandatory reason,
  terminal state, retained history and audit event. The detail dialog exposes
  the cancellation form and terminal copy only to Admins.
- Refusal evidence is returned with metadata and shown to reviewers.

### Master data

- Admin `Masters` tab over the existing six master kinds: create, edit and
  deactivate, including severity/default action for violation types and
  location selection for gates.
- Historical snapshots are explicitly explained as retained; no delete action
  or reactivation is invented.

### Tablet continuity

- `/` (and `/entry` deep link) are owned routes; sign-in returns to the entry
  screen.
- Draft text, issued receipt and operation id are stored in
  `sessionStorage` per tab. Refresh restores the entered draft or the issued
  receipt. Logout and “Create another challan” clear it.
- Photos/signature bytes are deliberately not persisted; they must be recaptured
  after a refresh. This is an explicit security/size boundary, not a claim of
  full offline draft support.

## Verification

| Gate | Result |
|---|---|
| `pnpm format:check` | pass |
| `pnpm run lint` | pass |
| `pnpm run typecheck` | pass |
| `pnpm test` | contracts 68, API unit 104, tablet 88, admin 26 pass |
| `pnpm test:integration` | 14 files / 141 tests pass |
| `pnpm build` | API + tablet + admin pass |
| `pnpm check:tablet-size` | 170,454 B gzip (<250,000 B) |
| `pnpm test:foundation` | 27 pass |
| Playwright admin | 14 pass |
| Playwright tablet | 62 pass |
| Playwright API proxy | 2 pass (78 total browser journeys) |

Browser verification on the isolated test database covered: signed/refused
submission, evidence display, cancellation, server filters/totals, XLSX
download, mobile cards, collapsed filters, sticky create-dialog actions, 404,
focus rings, PWA manifest/service worker registration, friendly login errors,
and draft restoration.

## Test-baseline changes (documented, not weakened)

- Admin foundation acceptance now expects the real server totals tiles that were
  previously asserted absent.
- Admin operations test stubs serve `/challans/report`; assertions on review
  transitions and performers are unchanged.
- Tablet heading copy assertions follow the sentence-case change.
- The idle-logout test waits for the hydrated driver field after lazy route load.
- Admin unit tests reset `window.history` between cases so a deep-link detail
  modal cannot hide the shell heading via `aria-hidden`.

## Residual limitations

- Real tablet hardware, rear camera, stylus and trusted HTTPS were not available.
- Local evidence storage has no orphan-TTL sweep; a crash between file write and
  DB commit can leave orphan files.
- Media server validation checks MIME, magic bytes, declared bytes and E-02
  dimensions; it does not decode every image.
- `entry_started_at` is not populated (SUB-07 timing still outstanding).
- Tablet draft persistence covers text/preview/receipt, not captured media.
- Offline issuance remains P2 and is not implemented.
- `pnpm test:integration` and browser runs use synthetic data only.
