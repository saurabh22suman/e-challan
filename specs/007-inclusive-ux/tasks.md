# Tasks: inclusive UX revamp (007)

Implementer-owned boxes are ticked only after the unit's evidence is recorded in
`docs/handoffs/inclusive-ux.md`; the reviewer box is independent and
reviewer-owned. These boxes are not the implementation-plan checkboxes and
change no existing task state.

2026-10-19 independent correction re-review: **PASS for the code/browser scope**,
`docs/reviews/inclusive-ux-corrections.md`; accepted snapshot
`docs/reviews/inclusive-ux-accepted.sha256`. The reviewer restored the returned
completion boxes after independent checks. Manual/device acceptance remains
separately pending below.

- [x] UX-01 progress/stages, ErrorSummary, focus, reflow, target evidence
- [x] UX-02 both sign-in screens (title, Show/Hide password, copy, landmarks)
- [x] UX-03 entry grouping/copy, picker keyboard, manual honesty, Other-last, remarks helper
- [x] UX-04 summary completeness/semantics, Change details focus, notice wording, Continue to photos
- [x] UX-05 photos instruction de-duplication, failure presentation retained
- [x] UX-06 signature confirmed/sign-again, local-only copy, refusal copy, invalidation
- [x] UX-07 admin workspace copy/semantics
- [x] UX-08 automated accessibility sweep; manual/device validation recorded pending
- [x] Independent combined review (code/browser scope; separate implementing agent)
- [ ] UX-08 representative-user and real-device validation (B-03/V-03; language decisions pending)

Earlier CHANGES_REQUIRED checkpoint: `docs/reviews/inclusive-ux.md`, preserved
for history and superseded for the corrected scope by the PASS report above.
Canonical cross-feature and release checkboxes are not advanced by these boxes.

Subsequent 008 integration changed EntryFlow.tsx and its catalogue-error handling.
The initial CHAR-01 rejection in `docs/reviews/marshal-character.md` is closed
by **PASS** `docs/reviews/marshal-character-char01.md` (2026-10-19), which
reconfirms this affected code/browser scope and R1–R7 regressions. Current combined
snapshot: `docs/reviews/marshal-character-accepted.sha256`. The original accepted
manifest remains historical and is not rewritten. Manual/device and canonical
cross-feature gates remain separate.

UX-08 field pack prepared 2026-10-19: `docs/handoffs/field-acceptance/`
(device checklist, 10 scenarios for 5–8 staff, observation/results templates,
executable preflight, owner-input list). Prepared, **not executed**. The UX-08
representative-user/real-device box stays unchecked until the sessions run on
the owner-named device with the owner inputs answered.
