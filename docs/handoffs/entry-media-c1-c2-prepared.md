# Entry-media C1/C2 correction — prepared planner handoff

Prepared: 2026-10-18, planner session per owner direction recorded in
`docs/handoffs/ux-00-readiness.md`. Source: independent re-review
`docs/reviews/entry-media-v1-v6-rereview.md` (2026-10-17, CHANGES_REQUIRED) and
its disposition to prepare the two narrowly scoped regressions, implement the
fixes, run affected regressions and the standard gates, then return for
independent re-review.

**This record approves nothing.** F-04, I-01, I-02, I-03 and I-05 keep both
boxes unchecked; only the independent reviewer may tick review.

Because the owner explicitly assigned implementation, preparation and
implementation run in one session (disclosed deviation; same pattern as F-01
2026-10-03 and the owner-authorised entry-media batch 2026-10-15). The
implementer must not edit acceptance files, weaken assertions or change
requirements; test defects return here first.

## Scope fence

Allowed production paths: `apps/tablet/src/features/photos/PhotoCapture.tsx`
and `apps/tablet/src/features/signature/SignaturePad.tsx`. No contract, API,
route, migration, storage, submission or styling change is authorised. Do not
clear visible strokes, do not change the pad mount lifecycle, do not remove the
existing late-stream guards, and preserve every existing acceptance test
unchanged.

## Required corrections (reviewer text)

- C1: share immediate stream teardown/capture invalidation with cancel,
  including tracks, video attachment and encoding state as appropriate; discard
  late play completion without disturbing a newer acquisition; add the
  pending-play control plus normal-start/reopen tests.
- C2: separate provisional drawing from confirmed evidence; invalidate parent
  confirmation and outstanding hydration when a drawing starts or changes;
  preserve valid visible strokes; test Confirm → add stroke → Back without
  reconfirmation, reconfirmed multi-stroke PNG contents, and delayed image
  decode → new stroke; keep the stable mount lifetime.

## Acceptance (frozen in `docs/handoffs/entry-media-c1-c2-tests.sha256`)

| File | Level | Covers |
| --- | --- | --- |
| `apps/tablet/src/__tests__/photo-cancel-play.test.tsx` | Unit/component | C1 immediate stop + detach on cancel during pending play (reviewer probe adopted, assertion not weakened); late settlement discarded; normal re-open, second stream untouched |
| `apps/tablet/src/__tests__/signature-invalidation.test.tsx` | Unit/component | C2 parent `onChange(null)` on first stroke after confirmation; re-confirm reports the newest export; single pad instance, no extra clear; delayed decode cannot overwrite a new stroke or the new confirmation |
| `apps/tablet/e2e/entry-media-invalidation.spec.ts` | Browser (tablet project, real API/DB) | C2a edit-after-confirmation clears the summary acknowledgement and the superseded capture is not restored (Confirm disabled, blank pad); C2b reconfirmed multi-stroke export restores ink in both stroke regions |

Deliberately not covered by C1/C2 acceptance: real rear-camera hardware, real
stylus signing, and non-jsdom play() timing fidelity. Those remain B-03/V-03 or
the existing camera acceptance; browser fake-device evidence is not
hardware acceptance.

## Recorded RED (before any production change)

Files saved: `/tmp/opencode/c1c2-unit-red.txt`, `/tmp/opencode/c1c2-e2e-red.txt`
(session-local; the assertions and messages below are the durable record).

- Unit: 2 files failed / 4 tests failed.
  - `photo-cancel-play.test.tsx` — both tests fail at
    `expected "vi.fn()" to be called at least once` (the acquired stream's
    `track.stop` is never called while `video.play()` is pending).
  - `signature-invalidation.test.tsx` — `expected last "vi.fn()" call to have
    been called with [ null ]` (no parent invalidation), and
    `expected "vi.fn()" to not be called at all, but actually been called 1
    times` (the stale decode calls `drawImage`, overwriting the new stroke).
- Browser: `C2a` failed at
  `expect(page.getByText('Driver signature captured.')) .toHaveCount(0)` after
  the edit; `C2b` passed pre-fix as designed (regression guard).

## GREEN targets

- `pnpm --filter @echallan/tablet exec vitest run src/__tests__/photo-cancel-play.test.tsx src/__tests__/signature-invalidation.test.tsx` — 2 files, 4 tests passed.
- `pnpm exec playwright test apps/tablet/e2e/entry-media-invalidation.spec.ts --project=tablet` — 2 passed.
- `pnpm --filter @echallan/tablet run test` — 9 files, 73 tests (69 existing + 4 new), no existing test changed.

## Gates and evidence

Run the full affected sequence: `pnpm run format:check`, `pnpm run lint`,
`pnpm run typecheck`, `pnpm run test`, `pnpm run test:integration`,
`pnpm run test:e2e`, `pnpm run build`, `pnpm run check:tablet-size`,
`pnpm run test:foundation` (isolated rerun disclosed if the known contention
timeout recurs). Fault-sensitivity in a disposable copy: `cancelAcquisition`
reverted to the pre-fix body must fail the C1 tests; the C2 stroke invalidation
removed must fail the C2 tests and the C2a browser journey; restore and rerun
after each fault.

Implementer evidence goes to `docs/handoffs/entry-media-c1-c2.md`; independent
review to `docs/reviews/entry-media-c1-c2.md` (new review request:
`docs/review-requests/entry-media-c1-c2.md`). Do not modify this preparation
record; a revised baseline requires a documented planner correction.

## Baseline revision rev 2 (2026-10-18, planner-documented)

Added during implementation, before the fix was accepted: the browser C2a case
exposed that a remounted pad knows the parent's confirmed capture only through
`initialCapture`, so the rev-1 unit acceptance (no remount case) did not pin
the parent-notification behavior for that path. Revision 2 adds, without
weakening or removing any assertion:

- `signature-invalidation.test.tsx` — a fifth case (remount: decode success,
  then a stroke notifies the parent `onChange(null)`) and one added assertion
  in the delayed-decode case (the parent is notified even while the decode is
  still pending).
- This revision note and the manifest header note. No production contract and
  no scope change. Prettier normalized the added unit test's formatting
  (whitespace only; no assertion changed) before this revision was finalized.

RED for the added case: the rev-1 RED run covers the four original cases; the
fifth case's failure is proven by the rev-2 fault-sensitivity run (C2 stroke
invalidation reverted → the C2 unit tests and C2a fail), recorded in
`docs/handoffs/entry-media-c1-c2.md`. rev 1 manifest archived byte-for-byte at
`docs/handoffs/entry-media-c1-c2-tests-rev1.sha256`. Reviewer confirmation of
this revision is required; nothing here is an approval.
