# Review request — inclusive UX revamp batch (2026-10-18)

Independent combined review requested for the owner-authorised batch executing
`docs/handoffs/inclusive-ux-revamp-plan.md` UX-01–UX-08, including the C1/C2
correction (`docs/handoffs/entry-media-c1-c2.md`) per the owner clarification
2026-10-18 in `docs/decisions.md`. Run in a fresh session/model; the batch
session cannot approve it. This request supersedes
`docs/review-requests/entry-media-c1-c2.md` and stands alongside the pending
`docs/review-requests/owner-ui-revision.md` (same files, wider scope: treat the
owner-ui revision review as folded into this batch review, as its baseline
revision is part of the documented revision below).

## What to review

1. **Acceptance integrity**: the new specs
   `apps/tablet/e2e/inclusive-ux.spec.ts` (11 tests) and
   `apps/admin/e2e/inclusive-ux.spec.ts` (1 test), plus the documented
   test-baseline revision in `docs/handoffs/inclusive-ux-prepared.md`. Confirm
   each listed selector change preserves its assertion's intent and that no
   behavioural assertion was weakened, skipped or removed. The prepared record
   lists every changed frozen file and the reason.
2. **Behaviour**: UXA-01–04, 06, 09, 12–14, 16, 23, 25, 27, 28 as implemented;
   the copied-out parts of the catalogue recorded as not automated (UXA-05
   warning, UXA-29/30 partial, UXA-31/32 manual) must not be claimed as passed.
3. **Preserved contracts**: B-02 single form, B-08 vehicle interaction and
   scoping, E-02/E-03 limits and binding, 600-second expiry, green-only commit,
   tablet <250 KB initial JS, exact-path MUI imports, package boundaries. No
   API/contract behaviour change beyond the exported `REMARKS_MAX_LENGTH`
   constant and the theme DOM lib.
4. **C1/C2 inclusion**: the correction is re-run in this batch; verify its
   closure and that the revision of its two acceptance files keeps the C1/C2
   guarantees.
5. **Re-run independently**: `sha256sum -c docs/handoffs/inclusive-ux-tests.sha256`,
   `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`,
   `pnpm run test`, `pnpm run test:integration` (db containers required),
   `pnpm run test:e2e`, `pnpm run build`, `pnpm run check:tablet-size`,
   `pnpm run test:foundation`; optionally rerun the disposable-copy fault
   script.
6. **Evidence**: `docs/handoffs/inclusive-ux.md` (per-unit evidence, gates,
   fault sensitivity, MCP screenshots `ux2-*`). Real-device and
   representative-user evidence is explicitly NOT supplied.

## Known open items (not defects)

- UX-08 representative-user and real-device validation is pending; no hardware
  acceptance is claimed.
- Owner decisions still open: languages/terminology, help contact route,
  target tablet (B-03). The build uses generic supervisor-help wording.
- The optional inactivity advance warning was not implemented; the approved
  expiry is preserved.
- Pre-existing lint warning in `SignaturePad.tsx` unchanged.

Report PASS / CHANGES_REQUIRED / BLOCKED in `docs/reviews/inclusive-ux.md` with
accepted file hashes, rerun results, and any items returned to the planner
versus the implementer.
