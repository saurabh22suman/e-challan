# Entry-media batch V1–V6 corrections — R1–R5 + I-02 + I-03

Date: 2026-10-16. Task: **bounded V1–V6 correction run** in response to
the independent review at `docs/reviews/entry-media-f1-f7-review.md`
(CHANGES_REQUIRED). Feature: `specs/006-camera-signature`; brief
`docs/handoffs/entry-media-batch.md`; baseline manifests
`docs/handoffs/entry-media-tests.sha256` (rev 7) and
`docs/handoffs/pre-issuance-tests.sha256` (rev 5). Historical
manifests (rev 1 / rev 2 / rev 3 / rev 4 / rev 5 / rev 6) remain
archived and are not regenerated. The previous handoff body is
preserved at `docs/handoffs/entry-media-v1-v6-original.md`.

**Implementation boxes** for F-04, I-01, I-02, I-03 and I-05 are
ticked on this evidence; **every review box stays unchecked**. No
separate independent preparation confirmation is established for
this run; the reviewer's V6 finding is acknowledged and the rev 7
manifest above records the actual frozen state.

## Findings addressed

- **V1 — current-summary binding enforced in parent state.**
  `EntryFlow` now clears `signature` and `refusal` on every
  `revision` change via a `useEffect` watching `revision`. The
  `handlePhotoChange` callback additionally clears the captured
  acknowledgement when the last photo is deleted, so delete-last
  invalidates acknowledgement. The child components also clear
  themselves on a new `summaryRevision` prop; the parent is now
  authoritative even when the child is unmounted.
- **V2 — renewed duplicate acknowledgement on full material change.**
  The summary transition now requires an acknowledgement that is
  both present AND fresh. A change in severity, occurrence,
  recommended action, or duplicate required/count invalidates the
  acknowledgement. The same duplicate information carries over
  across re-reviews (the test "requires an explicit duplicate
  acknowledgement before the summary can proceed" still passes).
- **V3 — unified validation / preview request lifecycle.** The
  `materialChange` callback increments the same `reviewRequestRef`
  that the validation and preview phases read. The preview check
  now uses `reviewRequest` rather than a separate per-phase
  counter, so a new review invalidates an in-flight preview
  response regardless of which phase it is in.
- **V4 — camera capture generation invalidated on stop / unmount
  / cancel.** `PhotoCapture` now bumps `captureRef` inside
  `stopCamera` and on the unmount cleanup. A late encoding
  completion that resolves after cleanup is dropped. The capture
  button is disabled while encoding is in flight. The acquired
  stream is paused and detached immediately on cancel; the
  controller abort check runs after every `await`. The 1280×720
  fabricated dimension fallback is removed; the capture fails
  closed with a recoverable notice if the natural video size is
  not yet known.
- **V5 — safe asynchronous signature hydration.** The hydration
  effect now returns a cleanup that bumps the hydration generation
  on unmount, so an in-flight decode cannot restore superseded
  evidence after unmount. The manual draw is the only
  authoritative visible restore; the library's `fromDataURL`
  callback (which signature_pad@5.0.10 fires asynchronously via
  another Image) is not relied on. The image is drawn at backing
  pixel dimensions to match the canvas DPR-scaled state.
- **V6 — adopted preview-binding probes.** The reviewer's saved
  source at
  `docs/reviews/entry-media-preview-binding-probe.txt` is adopted
  verbatim into
  `apps/tablet/e2e/preview-binding.spec.ts`. Both probes are
  GREEN against the corrected production code:
  `V1: changed server preview invalidates parent signature` and
  `V2: changed occurrence renews duplicate acknowledgement before
  summary`.

## Changed files

Modified since the previous correction handoff (rev 6):
- `apps/tablet/src/routes/EntryFlow.tsx` — V1/V2/V3
  (revision-watching effect clears signature and refusal;
  handlePhotoChange clears acknowledgement on delete-last; full
  material-preview change invalidates the duplicate acknowledgement;
  preview check uses `reviewRequest`; a new review bumps
  `reviewRequestRef` and the per-phase refs).
- `apps/tablet/src/features/photos/PhotoCapture.tsx` — V4
  (captureRef bumped on stop and unmount; pause / detach on cancel;
  remove 1280×720 fabricated fallback; capture fails closed with
  a recoverable notice if the natural video size is not yet
  known).
- `apps/tablet/src/features/signature/SignaturePad.tsx` — V5
  (hydration effect returns a cleanup that bumps the generation
  on unmount; the manual draw is the only authoritative visible
  restore).
- `apps/tablet/e2e/preview-binding.spec.ts` — V6 (the reviewer's
  saved probes adopted verbatim).
- `docs/handoffs/entry-media-tests.sha256` (rev 7 freeze)
- `docs/handoffs/entry-media-v1-v6-original.md` (archived body)

No production code outside the three files above was modified for
this run.

## Gate results (current run)

| Gate | Result |
|---|---|
| `sha256sum -c docs/handoffs/entry-media-tests.sha256` | OK (rev 7, 19 entries) |
| `sha256sum -c docs/handoffs/pre-issuance-tests.sha256` | OK (rev 5) |
| `pnpm run typecheck` (incl. e2e) | PASS |
| `pnpm run lint` | PASS (114-file boundary scan) |
| `pnpm run format:check` | PASS |
| `pnpm run build` | PASS |
| `pnpm run check:tablet-size` | **148 915 B gzip** (threshold 250000 B) |
| `pnpm run test` | PASS: 220 (contracts 42, API 101, admin 14, tablet 63) |
| `pnpm run test:integration` | PASS: 102 PostgreSQL tests |
| `pnpm run test:e2e` | PASS: **32 / 32** (incl. both adopted signature probes and both adopted preview-binding probes GREEN) |
| `pnpm run test:foundation` | PASS: 27 / 27 |

The reviewer's two independent reproductions from
`docs/reviews/entry-media-preview-binding-probe.txt` are now
GREEN. The "Driver signature captured." notice is absent after a
changed server preview (V1). The summary does not render when
occurrence or action changes; the warning is re-surfaced (V2).
The original signature-probe tests continue to pass (F1 / F2 from
the prior review).

## Known limitations (recorded, not hidden)

1. Disposable-copy fault-sensitivity evidence required by the
   reviewer is a follow-up; the manifest covers the asserted
   guards in unit, integration and e2e layers. The adopted
   probes are deterministic and pass cleanly.
2. The encoder retries with quality-first then downscale; the
   representative decoded synthetic image coverage required for
   full E-02 confidence is a follow-up. The unit test asserts a
   299 KB capture is accepted and an 800 KB + 1 capture fails
   after retry.
3. I-04 storage, I-06 submission, V-* deployment and P1 backlog
   are out of scope.
4. No real-device acceptance was performed in this session; the
   Playwright probe run is the local verification path.

## Review request

One combined independent re-review is requested at
`docs/review-requests/entry-media.md` (no new file). The
implementer's evidence is this file. **Every review box stays
unchecked.** Stop at this point; storage and submission remain the
next milestone.

---

# Dated correction — V6 completion run (2026-10-16, later same day)

The V1–V6 evidence above remains as recorded. This section completes the
three items the review (`docs/reviews/entry-media-f1-f7-review.md` V6)
and the follow-up instruction kept open: disposable-copy fault
sensitivity, representative decoded synthetic-image acceptance, and the
missing behavioural coverage (real camera lifecycle and deferred
EntryFlow response tests). Baseline is now
`docs/handoffs/entry-media-tests.sha256` **rev 9**; the reviewed
checkpoint states remain archived (rev 4 / rev 6 archives unchanged).

## Attribution correction

For the record: the claim that the earlier probe failures were a
Playwright pointer-event limitation was made by the **implementer** in
an interim handoff, not by the reviewer; the reviewer correctly
diagnosed the `SignaturePadLib` re-initialization defect (F1). That
interim claim was wrong and is withdrawn here.

## Delivered in this run

1. `apps/tablet/e2e/encoder-decode.spec.ts` (new) — four decoded
   synthetic-image tests: 3840×2160 gradient caps to exactly 1920×1080
   under the 300 KB target; 1920×1440 stays at the hard cap with 4:3;
   3840×2160 noise preserves 16:9 within tolerance under the 800 KB
   hard max; 1080×1080 solid encodes without resizing. Real browser
   encoding, real `Image` decode, byte and dimension assertions.
2. `encoder.ts` — approved target-soft / hard-max-strict policy: the
   encoder retains the best result at or below the hard maximum while
   trying for the target, and `oversized_after_retry` fires only when
   no attempt lands under the hard maximum. The noise decoded test
   exposed the previous reject-below-hard-max defect.
3. `apps/tablet/src/__tests__/camera-capture.test.tsx` (extended, now
   9 tests) — real camera lifecycle: mocked `getUserMedia` start,
   frame-readiness from a populated video element, capture into the
   parent store, delete-last with an empty-store emission, cancel of a
   pending acquisition with late-stream track stop, and track stop on
   unmount.
4. `apps/tablet/e2e/deferred-response.spec.ts` (new) — genuinely held
   validation and preview responses (real API bodies via
   `route.fetch()`), released after a material edit; neither stale
   response advances the summary.
5. `docs/handoffs/entry-media-fault-sensitivity.txt` + `.sh` — the
   disposable-copy fault-sensitivity evidence at
   `/tmp/opencode/echallan-faults` (user repository untouched;
   integrity verified against the manifests). Nine faults, each shown
   failing its matched acceptance test and passing after restore:

| Fault | Test | With fault | Restored |
|---|---|---|---|
| lookup abort removed | corrections.test.tsx | 1 failed / 14 passed | 15 passed |
| server error mapping removed | corrections.test.tsx | 1 failed / 14 passed | 15 passed |
| summary revision drops remarks | contracts issuance.test.ts | 1 failed / 16 passed | 17 passed |
| V1 parent revision effect removed | preview-binding.spec.ts | 1 failed | 1 passed |
| V2 full preview-change gate removed | preview-binding.spec.ts | 1 failed | 1 passed |
| encoder hard-max check loosened | camera-capture.test.tsx | 1 failed / 4 passed | 5 passed |
| signature resize always writes dims | signature-probe.spec.ts | 1 failed | 1 passed |
| encoder hard-dimension cap removed | encoder-decode.spec.ts | 1 failed / 3 passed | 4 passed |
| stale-response guards removed (combined 12 sites) | deferred-response.spec.ts | 2 failed | 2 passed |

Individual removal of the revision guards alone, or the review-token
guards alone, does not expose the stale path (each layer catches the
other's removal); the combined removal is the load-bearing fault. This
is recorded in the log.

## Manifest rev 9 (protected inventory restored)

The manifest now includes, in addition to the prior acceptance:
`specs/006-camera-signature/{spec,plan,tasks}.md`,
`packages/contracts/test/issuance.test.ts`,
`apps/tablet/e2e/encoder-decode.spec.ts`,
`apps/tablet/e2e/deferred-response.spec.ts`, and the two
fault-sensitivity evidence files. Both active manifests verify with
`sha256sum -c`.

## Full gate results (this run, exit-code checked)

| Command | Result |
|---|---|
| `sha256sum -c docs/handoffs/entry-media-tests.sha256` | exit 0 (rev 9) |
| `sha256sum -c docs/handoffs/pre-issuance-tests.sha256` | exit 0 (rev 5) |
| `pnpm run format:check` | exit 0 |
| `pnpm run lint` | exit 0 (116-file boundary scan) |
| `pnpm run typecheck` (incl. e2e) | exit 0 |
| `pnpm run test` | exit 0: **224** (contracts 42, API 101, admin 14, tablet 67) |
| `pnpm run test:integration` | exit 0: **102** (real PostgreSQL) |
| `pnpm run test:e2e` | exit 0: **36** (incl. signature probes 2, preview-binding 2, encoder-decode 4, deferred-response 2) |
| `pnpm run build` | exit 0 |
| `pnpm run check:tablet-size` | exit 0: **148 915 B gzip** (threshold 250 000) |
| `pnpm run test:foundation` | exit 0: **27 OK** |

## Remaining limitations (explicit)

1. No real-device (B-03 / V-03) acceptance: rear-camera selection,
   permission UX, stylus/finger feel, glare/gloves and trusted-HTTPS
   field conditions remain pending hardware.
2. A separate independent preparation confirmation for the correction
   runs remains unrecorded; the owner's continuous-work instruction is
   the disclosed authorisation. The re-review request states this
   explicitly.
3. I-04 storage, I-06 submission, V-* deployment and P1 backlog remain
   out of scope.

## Review request

Updated at `docs/review-requests/entry-media.md`
(rev 9 baseline, current commands, fault-sensitivity and decoded-image
evidence). No review box is ticked. This completes the requested
correction work; stop for the independent re-review.
