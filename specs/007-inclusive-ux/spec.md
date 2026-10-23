# Feature specification: inclusive UX revamp (007)

Source: `docs/handoffs/inclusive-ux-revamp-plan.md` (UX-01–UX-08), owner
clarification 2026-10-18, batch brief `docs/handoffs/inclusive-ux-batch.md`.

## Objective

Make the tablet and dashboard surfaces understandable and operable by staff with
limited reading confidence or digital experience: plain task language, one
dominant next action per area, large controls, honest success states and
recoverable errors, without changing approved business rules or the B-02
single-form flow.

## Requirements (trace)

- Three named stages with matching progress and no competing section numbers
  (UXA-01, UI-03/ENT-05).
- No horizontal document overflow at 390/768/1024/1280 widths (UXA-02).
- Tablet touch minimums and sticky/no-cover action rules (UXA-03).
- Invalid Check details focuses a linked error summary; inline errors persist;
  values retained; unrelated errors survive a fix (UXA-04).
- Preserved 600-second inactivity expiry clearing unsent state (UXA-05, partial).
- Both sign-ins: Show/Hide password, plain copy, one h1 + main, generic failure
  (UXA-06/07/08).
- Vehicle picker keyboard/touch parity, manual-entry honesty, retry/no-results
  paths preserved (UXA-09/11/12).
- Other-last display without ID/semantic changes; remarks helper/counter
  (UXA-13/14).
- Complete summary, Change details focus, honest repeat/duplicate wording
  (UXA-16/17/19).
- Single photo instruction; distinct recoverable camera failures (UXA-20/21).
- Signature provisional/confirmed/sign-again, immediate invalidation, local-only
  endpoint copy (UXA-23/24/27; C2 correction already implemented).
- Refusal copy and linked validation, invalidation consistency (UXA-25/26).
- Admin honest workspace, session-derived identity only (UXA-28).
- Automated accessibility/overflow/keyboard sweep; representative-user and
  device validation prepared, not executed (UXA-29/30/31/32 partial).

## Out of scope

Storage/submission/receipt (I-04/I-06), operational dashboard (R-series),
production auth, deployment, offline. New dependencies. API/contract changes.

## Acceptance

Executed inventory (reconciled 2026-10-19 with the delivered packet; the
earlier draft reference to non-existent component files is withdrawn):

- `apps/tablet/e2e/inclusive-ux.spec.ts` — UXA-01–UXA-28 browser-covered subset
  (12 cases, extended per the 2026-10-19 review).
- `apps/tablet/e2e/inclusive-ux-media.spec.ts` — R2 external-invalidation case
  with Chromium's fake camera device (application flow, not hardware).
- `apps/admin/e2e/inclusive-ux.spec.ts` — UXA-06/UXA-28 on the dashboard.
- `apps/tablet/e2e/deferred-response.spec.ts` — R1/UXA-15 held-response
  recovery, four cases.
- C1/C2 component acceptance: `photo-cancel-play.test.tsx`,
  `signature-invalidation.test.tsx`.
- Existing suites carry the documented exact-label baseline revision
  (`docs/handoffs/inclusive-ux-prepared.md`,
  `docs/handoffs/inclusive-ux-corrections-prepared.md`).

Corrections under the 2026-10-19 review (R1–R7) and their evidence are recorded
in `docs/handoffs/inclusive-ux-corrections.md`; the manifest is
`docs/handoffs/inclusive-ux-tests.sha256` revision 2.
