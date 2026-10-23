# Inclusive UX revamp — prepared planning record

Prepared: 2026-10-18, owner-authorised batch session (owner clarification
2026-10-18 in `docs/decisions.md`; brief `docs/handoffs/inclusive-ux-batch.md`).
Source plan: `docs/handoffs/inclusive-ux-revamp-plan.md` UX-01–UX-08.

**This record approves nothing.** The combined review at batch exit is
independent and mandatory. Because the owner explicitly assigned the batch,
preparation and implementation ran in one session (disclosed deviation, same
pattern as F-01 and the 2026-10-15 entry-media batch).

## Acceptance packet

| File | Level | Covers |
| --- | --- | --- |
| `apps/tablet/e2e/inclusive-ux.spec.ts` | Browser (tablet, real API/DB) | UXA-01 stages/heading focus/no step badges; UXA-02 four viewports no overflow + narrow step text; UXA-03 tablet 56/64px targets and violation rows; UXA-04 linked focused error summary, unrelated errors survive a fix, link focuses its field; UXA-06 marshal sign-in title/help/Show-Hide password value retention; UXA-09 picker ArrowDown/Up active option, Enter selects, Escape closes; UXA-12 manual-entry scope wording, no false registry claim, carried-details disclosure; UXA-13/14 Other-last order, remarks helper and 0/2000 counter; UXA-16 Change details + Continue to photos, values retained, heading focus; UXA-23/27 confirmed chip, Sign again, local-only endpoint copy; UXA-25 refusal linked errors and plain local-only confirmation. |
| `apps/admin/e2e/inclusive-ux.spec.ts` | Browser (admin, real API/DB) | UXA-06/UXA-28 dashboard sign-in title/help/Show-Hide, honest workspace copy, one h1, session-derived role, no task-ID copy. |

Deliberately not automated in this packet: UXA-05 advance-warning timer (no
warning is implemented; the 600-second expiry and its clearing behaviour are
preserved and remain covered by the existing AUTH-03/04 suites), UXA-08/10/11/
15/17/18/19/20/21/22/24/26 (existing suites and the C1/C2 correction
regressions remain the coverage; not all re-authored here), UXA-29/30 partial
(no automated contrast/zoom harness in this build), UXA-31/32 (manual/owner
decision, recorded as pending).

## Documented test-baseline revision (planner correction, required for review)

The plan requires copy and layout that the frozen suites pinned. Every changed
selector is listed here; no behavioural assertion was weakened, and none was
removed:

- `Check details` replaces the old form action label `Review summary`;
  `Continue to photos` and `Change details` replace the summary step's
  `Continue`/`Back`: tablet `pre-issuance.spec.ts` (5 + 1), `preview-binding.spec.ts`
  (3 + 2 + 2), `signature-probe.spec.ts` (1 + 2), `deferred-response.spec.ts`
  (2), `entry-media-invalidation.spec.ts` (1 + 4), `camera-signature.spec.ts`
  (1 + 1), `foundation.spec.ts` (1); component `pre-issuance-entry.test.tsx`
  (/review summary/i ×6, `/^back$/i`), `pre-issuance-repeat.test.tsx` (/review
  summary/i ×4, `/^back$/i`), `foundation.test.tsx` (×1).
- Validation messages now appear twice by design (linked summary + inline
  helper). Strict-mode collisions were disambiguated with `.first()` and
  `getAllByText(...).length > 0` for the same message text
  (`pre-issuance.spec.ts` ×2, `pre-issuance-entry.test.tsx` ×2). The assertions
  still require the message to be visible after a failed check.
- Manual-entry copy honesty: `/not in the registry/i` assertions replaced by
  `/manual entry\./i` in `pre-issuance.spec.ts` and `pre-issuance-entry.test.tsx`.
- Refusal errors use the plan's plain wording; `signature.test.tsx` asserts
  `/refused to sign/i` instead of the raw schema strings.
- Sign-in screens: `getByLabel('Password')` is now exact on both apps
  (`Show password` would otherwise collide) in `f02-auth.spec.ts` (tablet/admin),
  `foundation.spec.ts` (admin), the tablet component suites and
  `foundation.test.tsx` (admin).
- The authenticated-shell marker on admin changed from the AppBar text to the
  page h1 `Demo review workspace` (`f02-auth.spec.ts` ×6, `foundation.spec.ts`
  ×2, `foundation.test.tsx` ×3, `f02-auth.test.tsx` ×16). The R-01 copy
  assertion was replaced by the honest `Reviewing challans is not available in
  this demo yet.` text.
- `docs/handoffs/entry-media-c1-c2-tests.sha256` (rev 2) covers
  `entry-media-invalidation.spec.ts` and `signature.test.tsx`; both were revised
  as above, so that interim manifest no longer describes the current state. Its
  C1/C2 acceptance intent is unchanged and fully re-run at this batch exit.

Production files changed beyond presentation-only edits, disclosed:
`packages/theme/tsconfig.json` and `tsconfig.build.json` gained the DOM lib
(required by the ErrorSummary focus contract); `packages/contracts/src/domain.ts`
exports `REMARKS_MAX_LENGTH` (the counter uses the shared limit; the schema
behaviour is unchanged).

## Recorded RED (before implementation)

- `pnpm exec playwright test apps/tablet/e2e/inclusive-ux.spec.ts --project=tablet`
  — 10 failed / 0 passed.
- `pnpm exec playwright test apps/admin/e2e/inclusive-ux.spec.ts --project=admin`
  — 1 failed / 0 passed.

These pre-implementation runs are also the primary failure-sensitivity evidence
for the whole packet; disposable-copy fault injections for the focus,
keyboard-picker and carried-details guards are recorded in
`docs/handoffs/inclusive-ux-fault-sensitivity.{sh,txt}`.

## Commands

```bash
pnpm exec playwright test apps/tablet/e2e/inclusive-ux.spec.ts --project=tablet
pnpm exec playwright test apps/admin/e2e/inclusive-ux.spec.ts --project=admin
```

Full batch-exit gates and results are recorded in
`docs/handoffs/inclusive-ux.md`.
