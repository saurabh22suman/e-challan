# Handoff — inclusive UX corrections R1–R7

Date: 2026-10-19. Implementer evidence for the corrections returned by
`docs/reviews/inclusive-ux.md` (CHANGES_REQUIRED). Prepared acceptance:
`docs/handoffs/inclusive-ux-corrections-prepared.md`. **No checkbox is ticked
by this record**; the combined review stays unchecked until the independent
re-review passes.

## Corrections

### R1 — editing during Check details disabled the next action (High)

`apps/tablet/src/routes/EntryFlow.tsx` `materialChange` now resets `reviewing`
when a draft edit supersedes an in-flight review; the identity-guarded
`finally` still clears pending only for the current request, so an older
completion cannot clear a newer request's pending state. Verified live
(held validate + edit → action enabled; stale settlement leaves it usable;
fresh check reaches the summary) and by the four rewritten deferred-response
browser cases with observable completion synchronisation.

### R2 — signature presentation diverged from the parent state (High)

`apps/tablet/src/features/signature/SignaturePad.tsx`:

- restoration: a successful decode of `initialCapture` (the parent's
  acknowledged capture) now sets the confirmed presentation (chip, disabled
  Confirm, local-only notice) instead of inviting a repeat confirm;
- external invalidation: when the parent retracts the capture while the pad is
  mounted (`initialCapture → null` after a local-clear-aware check), the pad
  clears the canvas, drops capture/confirmable/parent refs and shows
  `Signature cleared because the evidence photos changed. Sign again.`

C2 start-of-drawing invalidation, hydration generation guards, stable mount
lifetime and multi-stroke behaviour are unchanged; the C1/C2 unit acceptance
still passes. Verified live (restore case) and by the fake-camera browser case
(delete last photo → pad reconciles; summary agrees).

### R3 — edits erased unrelated errors; violations link could not focus (High)

`EntryFlow.tsx`: `materialChange` retains unresolved errors for untouched
fields and re-evaluates touched fields immediately via the extracted pure
`computeClientErrors` (blank fields keep their error; corrected fields clear).
The error map/order includes `contractorId`. The violations group is
focusable (`tabIndex=-1`) and associated with its error
(`aria-describedby="violations-error"`). Verified live: after typing only the
driver name, gate-pass and violations errors persist and the gate-pass input
keeps `aria-invalid=true`; the violations link focuses the group. The server
contractor error is listed, focused and clears on correction (deferred case 3).

### R4 — Escape could not dismiss searched results (Medium)

`apps/tablet/src/features/issuance/VehiclePicker.tsx`: an explicit dismissal is
recorded per query (`dismissedQuery`); Escape/chevron close the panel even
while a focused 3+ character search is showing, new input or a deliberate
reopen restores it, and the input keeps focus with stale
`aria-activedescendant` references removed (validity asserted during held
loading/result replacement). Verified live (GJ0 → results → Escape closes →
ArrowDown reopens).

### R5 — summary repeated the false registry-absence claim (Medium)

`EntryFlow.tsx`: the manual-mode summary chip now reads `Manual entry` (no
registry claim anywhere), and the repeat notice no longer calls the
prospective occurrence a "challan number": "This gate pass appears {n} time(s)
in the last 90 days, counting this entry. … recommendation only — no action
has been taken yet." Verified live and by UXA-12 (summary) and the revised
frozen assertions.

### R6 — signature accessibility and control separation (Medium)

`SignaturePad.tsx`: the canvas has an accessible name
(`Signature drawing area`) and is described by the signing instruction; the
drawing surface is a labelled group under the `Driver signature` heading.
Destructive `Clear signature` is now physically separated from
`Confirm signature`/`Sign again` by a divider row. Verified by UXA-23/29
(naming, description, geometry) and live. The witnessed-refusal rule is
untouched: refusal remains a witnessed event, not a consent shortcut.

### R7 — dashboard sign-in stated the wrong inactivity policy (Medium)

Both sign-ins derive their duration from `IDLE_TIMEOUT_SECONDS`
(`packages/contracts/src/auth.ts`): marshal 600 s → "10 minutes"; desktop
3600 s → "60 minutes". No server expiry was changed. Verified live and by the
tablet/admin inclusive specs.

## Acceptance and RED/GREEN

- RED before production edits: deferred 4/4 failed; inclusive UXA-04/09/12/
  23-29/25 failed; media 1/1 failed; admin 1/1 failed; the revised unit case
  failed. Recorded in the prepared record.
- GREEN after corrections: `deferred-response.spec.ts` 4 passed;
  `inclusive-ux.spec.ts` 12 passed; `inclusive-ux-media.spec.ts` 1 passed;
  admin inclusive 1 passed; `signature-invalidation.test.tsx` 3 passed.
- Live reproduction checks (Playwright MCP): R1 held-request recovery sequence
  (pending → edit → enabled → stale settlement → fresh check reaches summary);
  R3 retention/focus (`violations-group` focused; unrelated errors persist);
  R4 dismissal/reopen; R2 restoration; R5 truthful chip (zero false claims);
  R7 60-minute wording. Screenshots:
  `.playwright-mcp/corrections-r2-restored-confirmed.png`,
  `.playwright-mcp/corrections-r7-admin-policy.png`.

## Batch-exit gates (final state)

| Command | Result |
| --- | --- |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | PASS, 0 errors; 1 pre-existing warning; 119-file boundary pass |
| `pnpm run typecheck` | PASS (all workspaces + e2e) |
| `pnpm run test` | PASS: 42 contracts, 101 API, 14 admin, 74 tablet |
| `pnpm run test:integration` | PASS: 103 real-PostgreSQL tests |
| `pnpm run test:e2e` | PASS: 56 (tablet 45 incl. the corrected/new cases, admin 9, api-proxy 2) |
| `pnpm run build` | PASS |
| `pnpm run check:tablet-size` | PASS: 153070 B gzip initial across 2 assets (< 250000) |
| `pnpm run test:foundation` | PASS: 27 |

Failure sensitivity: the pre-correction RED runs are the injected-fault
evidence for every corrected path; the R3/R4/R5/R7 live probes reproduce the
reviewer's own reproductions with corrected outcomes. No disposable-copy fault
run was repeated for this narrow correction (disclosed).

## Integrity

- No existing acceptance was weakened; the changed selectors/assertions are
  listed in `docs/handoffs/inclusive-ux-corrections-prepared.md` and are
  limited to the copy/presentation the corrections require (R5 chip, R2
  restored-capture presentation) plus disambiguation of the same message.
- Manifests: rev 1 archived byte-for-byte at
  `docs/handoffs/inclusive-ux-tests-rev1.sha256`; the active manifest is
  revision 2 with a header note. `specs/007-inclusive-ux/tasks.md` returns
  UX-01/02/03/04/06 and automated UX-08 to unchecked per the review
  disposition; UX-05/UX-07 remain as prior implementation claims.
- `specs/007-inclusive-ux/spec.md` acceptance section reconciled with the
  actual browser/C1-C2 inventory (no non-existent component files claimed).
- Mascot/character work: not touched.

## Pending, not claimed

- Representative-user and real-device validation (UXA-31/32, B-03/V-03)
  remains pending; the fake camera is not hardware acceptance.
- The optional inactivity advance warning is still not implemented.

## Review request

`docs/review-requests/inclusive-ux-corrections.md` — independent re-review of
the corrected baseline with the revised manifest, RED/GREEN evidence and
affected regression results.
