# UX-00 — readiness and baseline reconciliation

Date: 2026-10-18. Role: planner session for the inclusive UX revamp
(`docs/handoffs/inclusive-ux-revamp-plan.md`, UX-00), extended by explicit owner
direction into the bounded correction unit described below.

**This record approves nothing and ticks no checkbox.** It states the actual
baseline, reconciles the active manifests, and identifies the next ready unit.

## Owner direction for this session

Source: owner instruction in the revamp session chat on 2026-10-18 (this
session): start with UX-00 readiness and acceptance preparation, then implement
the next ready task test-first, use Playwright for screens and failure states,
record changes and results, and stop for independent review without
self-approval. The instruction is the bounded authorisation for this session's
scope; it does not tick any review box and does not authorise the wider UX
table.

Because the owner explicitly assigned implementation, preparation and
implementation run in one session. This is the same disclosed process deviation
recorded for F-01 (2026-10-03) and used, with owner authorisation, by the
entry-media batch (2026-10-15). It does not substitute for independent review.

## Tree recheck

The workspace now contains `apps/{api,tablet,admin}`, `packages/{contracts,theme}`
and the S-01 root scripts (`format:check`, `lint`, `typecheck`, `test`,
`test:integration`, `test:e2e`, `build`, `check:tablet-size`, `test:foundation`,
`db:*`). The planning note in `AGENTS.md` ("no application yet") is stale;
`AGENTS.md` instructs rechecking the tree.

## Reviews rechecked (no newer report than 2026-10-17 exists)

| Record | Status | Consequence |
| --- | --- | --- |
| `docs/reviews/entry-media-v1-v6-rereview.md` (2026-10-17) | CHANGES_REQUIRED: C1 and C2 remain open | The reviewer-prescribed next step is the bounded C1/C2 correction: prepare the regressions, implement, run gates, return for re-review. |
| `docs/reviews/owner-ui-revision-round{1,2}.md` (2026-10-17) | Implementer-led; **not** the independent review | `docs/review-requests/owner-ui-revision.md` expects `docs/reviews/owner-ui-revision-independent.md`; that report does not exist yet. Pending gate. |
| `docs/decisions.md` B-08/B-09 (2026-10-17) | Owner decisions; explicitly state review still required | Baseline confirmation remains owed. |

C1/C2 were verified still open by direct code inspection, not inferred:

- C1: `apps/tablet/src/features/photos/PhotoCapture.tsx` `cancelAcquisition`
  aborts the controller and clears `acquisitionRef`, but does not stop an
  already-acquired `streamRef` stream or detach `video.srcObject` while
  `video.play()` is pending.
- C2: `apps/tablet/src/features/signature/SignaturePad.tsx` `handleEndStroke`
  updates only local capture/confirmable state; it does not clear
  `confirmedRef`, notify the parent `onChange(null)`, or advance
  `hydrationGenerationRef` when a new stroke supersedes a confirmed capture.

## Manifest reconciliation (no hashes regenerated)

Verified 2026-10-18 with `sha256sum -c` on each active manifest:

- `docs/handoffs/owner-ui-revision-tests.sha256` — all 9 hash lines OK. The 35
  "improperly formatted" warnings are the prose header of that file, not hash
  entries.
- `docs/handoffs/entry-media-tests.sha256` (rev9) — 9 mismatched paths:
  `apps/tablet/src/__tests__/pre-issuance-entry.test.tsx`,
  `apps/tablet/src/features/photos/PhotoCapture.tsx`,
  `apps/tablet/src/features/signature/SignaturePad.tsx`,
  `apps/tablet/src/features/signature/RefusalForm.tsx`,
  `apps/tablet/src/features/issuance/useLookupController.ts`,
  `apps/tablet/src/routes/EntryFlow.tsx`,
  `apps/tablet/e2e/pre-issuance.spec.ts`,
  `apps/tablet/e2e/signature-probe.spec.ts`,
  `apps/tablet/e2e/preview-binding.spec.ts`.
- `docs/handoffs/pre-issuance-tests.sha256` (rev5) — 6 mismatched paths:
  `apps/api/tests/integration/pre-issuance.test.ts`,
  `apps/tablet/src/__tests__/pre-issuance-entry.test.tsx`,
  `apps/tablet/e2e/pre-issuance.spec.ts`, `specs/005-pre-issuance/spec.md`,
  `docs/decisions.md`, `apps/tablet/vitest.config.ts`.

Every mismatched path is one of the files the owner-authorised B-08/B-09
revision (`docs/decisions.md` 2026-10-17, `docs/handoffs/owner-ui-revision.md`,
`docs/handoffs/owner-ui-revision-tests.sha256`) deliberately changed or
superseded; the unchanged owners-of-record for those paths are the revision
handoff and the revised manifest. The historical manifests were not rewritten.
Reviewer confirmation of that baseline revision is part of the pending
owner-ui-revision review; nothing here replaces it.

## Readiness determination

- **No reviewed source baseline exists for UX-01..UX-07 implementation.** The
  entry-media combined checkpoint (F-04, I-01, I-02, I-03, I-05) is still
  unchecked pending the C1/C2 re-review, and the B-08/B-09 revision awaits its
  independent review. Per the revamp plan §6, this session **reports the precise
  gate and prepares** rather than silently proceeding into the UX table.
- **The next ready unit is the bounded C1/C2 correction** (reviewer disposition
  2026-10-17; revamp plan §2 "C1/C2 correction belongs to the existing
  correction process, with new planner acceptance where required"). Prepared and
  implemented in this session; it changes no UX scope, no contract, no API and
  no business rule.
- **UX-01 gate (precise)**: after the C1/C2 independent re-review and the
  owner-ui-revision independent review both report PASS, UX-01 (shared
  ErrorSummary/action area/progress/shell reflow, UXA-01–05) can be prepared
  against a reviewed baseline. UX-02/03 then follow; UX-05/UX-06 additionally
  need C1/C2 independently closed, which this correction feeds.
- **Open owner inputs still unanswered** (from the plan §10): reading
  languages/terminology, help contact route, target tablet/B-03. These gate
  UXA-31/UX-32 and real-device claims, not the C1/C2 correction.

## Prepared unit and acceptance

Unit: entry-media C1/C2 correction. Preparation record:
`docs/handoffs/entry-media-c1-c2-prepared.md`. Frozen acceptance manifest:
`docs/handoffs/entry-media-c1-c2-tests.sha256`.

Planner-owned acceptance files (all new; no existing test was modified):

- `apps/tablet/src/__tests__/photo-cancel-play.test.tsx` — C1: immediate track
  stop and video detachment on cancel during a pending play, plus normal
  re-open after the discarded late settlement.
- `apps/tablet/src/__tests__/signature-invalidation.test.tsx` — C2: parent
  notification when a stroke supersedes a confirmation; delayed decode cannot
  overwrite a new stroke.
- `apps/tablet/e2e/entry-media-invalidation.spec.ts` — C2a browser journey
  (edit after confirmation clears the parent acknowledgement; superseded
  capture is not restored) and C2b regression guard (reconfirmed multi-stroke
  export restores both stroke regions).

Recorded RED (2026-10-18, before any production change; genuine assertion
failures):

- Unit: 2 files failed / 4 tests failed. C1: `expected "vi.fn()" to be called
  at least once` (tracks not stopped on cancel). C2: `expected last "vi.fn()"
  call to have been called with [ null ]`; and `expected "vi.fn()" to not be
  called at all, but actually been called 1 times` (`drawImage` from the stale
  decode).
- Browser: C2a failed at `expect getByText('Driver signature captured.')
  .toHaveCount(0)`; C2b passed pre-fix as designed (regression guard, not RED
  evidence).

Commands and expected GREEN while the harness runs with the already-running
local stack (API 3001, tablet 5173, admin 5174, PostgreSQL via `pnpm db:up`):

```bash
sha256sum -c docs/handoffs/entry-media-c1-c2-tests.sha256
pnpm --filter @echallan/tablet exec vitest run src/__tests__/photo-cancel-play.test.tsx src/__tests__/signature-invalidation.test.tsx
pnpm exec playwright test apps/tablet/e2e/entry-media-invalidation.spec.ts --project=tablet
```

Full affected-work gate sequence after GREEN: `pnpm run format:check`,
`pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run
test:integration`, `pnpm run test:e2e`, `pnpm run build`, `pnpm run
check:tablet-size`, `pnpm run test:foundation`.
