# Handoff — inclusive UX revamp batch (UX-01–UX-08)

Date: 2026-10-18. Owner-authorised batch session (owner clarification 2026-10-18
in `docs/decisions.md`; brief `docs/handoffs/inclusive-ux-batch.md`; prepared
planning record `docs/handoffs/inclusive-ux-prepared.md`). Combined independent
review at batch exit is mandatory; **no checkbox is ticked by this record**.

Feature: `specs/007-inclusive-ux/`. Source plan: UX-01–UX-08 in
`docs/handoffs/inclusive-ux-revamp-plan.md`. The C1/C2 correction
(`docs/handoffs/entry-media-c1-c2.md`) is included in this batch exit review per
the owner authorisation; its interim review request is superseded by
`docs/review-requests/inclusive-ux.md`.

## Files changed (production)

| Area | File | Change |
| --- | --- | --- |
| Theme | `packages/theme/src/primitives.tsx` | New shared `ErrorSummary`; `FormSection` heading carries `titleId` + `tabIndex=-1` for stage-focus. |
| Theme | `packages/theme/src/index.ts` | Exports for ErrorSummary. |
| Theme | `packages/theme/tsconfig.json`, `tsconfig.build.json` | DOM lib (ErrorSummary focus contract). |
| Contracts | `packages/contracts/src/domain.ts` | `REMARKS_MAX_LENGTH = 2000` exported and used by the shared remark schema (behaviour unchanged). |
| Tablet | `routes/EntryFlow.tsx` | Three named stages without section step badges; stage-heading focus; linked error summary with nonce focus and field links; `Check details` action with pending state; remarks helper + counter; Other-last display; violation rows ≥56px; summary as definition list with department/vehicle type/contractor/remarks; `Change details` + `Continue to photos`; repeat notice 90-day/recommendation wording; context strip reduced to post/shift; duplicate photo/acknowledgement notices removed. |
| Tablet | `routes/LoginScreen.tsx` | `e-Challan marshal sign-in`, supervisor help text, Show/Hide password. |
| Tablet | `App.tsx` | Wrapping header (Log out stays reachable), identity hidden under `sm`, `main` landmark. |
| Tablet | `features/issuance/VehiclePicker.tsx` | Combobox/listbox semantics with `aria-activedescendant`; ArrowDown/Up roving, Enter select, Escape close, mousedown guard so clicks land; truthful manual-entry copy with carried-details disclosure; no-match copy points at manual entry. |
| Tablet | `features/photos/PhotoCapture.tsx` | Removed duplicated photo-requirement caption (single live count remains). |
| Tablet | `features/signature/SignaturePad.tsx` | Confirmed state chip, disabled Confirm, `Sign again`, local-only endpoint notice, `Clear signature` label; redraw clears the stale invalidation notice. |
| Tablet | `features/signature/RefusalForm.tsx` | Plain linked refusal errors with focus; local-only confirmation wording (no revision/hash). |
| Admin | `App.tsx`, `routes/LoginScreen.tsx`, `routes/DashboardScreen.tsx` | `e-Challan dashboard sign-in` h1 + help text + Show/Hide password; AppBar brand is no longer a heading; `Demo review workspace` h1; honest unavailable copy; role from the session only. |

Acceptance and revised frozen-test files are listed in
`docs/handoffs/inclusive-ux-prepared.md`.

## Unit of work evidence

- UX-01: stages/focus/error summary/overflow/targets — UXA-01..04, UXA-16
  browser cases pass; heading focus moved to the section h2 (the previous id
  sat on the header container).
- UX-02: UXA-06 (tablet + admin), UXA-28 admin case pass.
- UX-03: UXA-09, UXA-12, UXA-13/14 pass; ENT regression suites pass.
- UX-04: UXA-16, UXA-19 (definition-list semantics), REP suites pass.
- UX-05: single instruction retained; camera lifecycle/C1 tests pass.
- UX-06: UXA-23/25/27 and the C1/C2 regressions pass.
- UX-07: UXA-28 pass.
- UX-08: automated portion done (overflow, targets, focus, labels, keyboard);
  representative-user and real-device validation NOT executed (no users/device
  in this session) and is recorded as pending — see "Pending, not claimed".

## Batch-exit gates (final frozen state)

| Command | Result |
| --- | --- |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS, 0 errors; 1 pre-existing `SignaturePad.tsx` unused eslint-disable warning + 118-file boundary pass |
| `pnpm run typecheck` | PASS (all workspaces + e2e tsconfig) |
| `pnpm run test` | PASS: contracts 42, api 101, admin 14, tablet 74 |
| `pnpm run test:integration` | PASS: 103 real-PostgreSQL tests |
| `pnpm run test:e2e` | PASS: 52 (tablet 41 incl. 11 new, admin 9 incl. 1 new, api-proxy 2), ~2.1 min |
| `pnpm run build` | PASS |
| `pnpm run check:tablet-size` | PASS: 153002 B gzip initial across 2 assets (threshold 250000; +3654 B vs the C1/C2 state) |
| `pnpm run test:foundation` | PASS: 27 in one run (164 s) |

## Failure sensitivity

- Whole-packet RED before implementation: tablet spec 10/10 failed, admin spec
  1/1 failed (recorded in the prepared record).
- Disposable copy (`/tmp/opencode/echallan-faults`, own dev server on 5273, real
  API shared): `docs/handoffs/inclusive-ux-fault-sensitivity.sh`; log
  `docs/handoffs/inclusive-ux-fault-sensitivity.txt`:
  error-summary focus removed → UXA-04 fails, restore → passes; picker
  arrow-key navigation removed → UXA-09 fails, restore → passes;
  carried-details disclosure removed → UXA-12 fails, restore → passes.
- The 36 unit failures seen during integration were frozen-selector collisions
  from the documented baseline revision (password-toggle label collision,
  `/review summary/i`, strict-mode duplicate error text), not behavioural
  regressions; all suites end green with the revision recorded.

## Browser/screen evidence (Playwright MCP, live stack)

`.playwright-mcp/ux2-error-summary.png` (focused summary with six linked
messages), `ux2-narrow-390.png` (390 px: wrapped header, `Step 1 of 3: Enter
details`, no overflow), `ux2-summary.png`, `ux2-signature-confirmed.png`
(confirmed chip, disabled Confirm, Sign again, local-only notice),
`ux2-admin-workspace.png` (single h1, honest copy, session role).

## Pending, not claimed

- Real-device checks (rear camera, stylus feel, glare/gloves, rotation/DPR) and
  representative-user sessions (UXA-31/32, B-03/V-03): NOT executed; the
  usability protocol in the revamp plan §9 remains the vehicle.
- The optional 60-second inactivity advance warning was not implemented; the
  approved 600-second expiry and its clearing behaviour are preserved.
- No automated contrast engine or 200 % zoom harness was added (no new
  dependencies per plan); UXA-29/30 are partly covered by structural,
  overflow and target assertions.
- English-only; the owner language/terminology decision remains open.

## Known issues

- `pnpm run lint` keeps one pre-existing warning (unused eslint-disable in
  `SignaturePad.tsx`), unchanged from the prior review record.
- The initial tablet JS graph now emits two assets (153002 B total); both are
  the initial graph under the budget check.
- `docs/handoffs/entry-media-c1-c2-tests.sha256` (rev 2) is superseded for two
  files by this batch's documented revision; its C1/C2 intent is re-run here.

## Review request

See `docs/review-requests/inclusive-ux.md`. Independent review must inspect the
changed source and preserved acceptance, verify the documented baseline
revision, rerun the gates, and decide PASS/CHANGES_REQUIRED/BLOCKED. No review
may be self-issued.
