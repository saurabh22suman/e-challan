# Tasks: marshal character guidance (008)

Implementer boxes are ticked only after evidence is recorded in
`docs/handoffs/marshal-character.md`. The review box is independent and remains
reviewer-owned.

- [x] MC-01 prepare and record transparent WebP derivatives; preserve originals
- [x] MC-02 character primitive, callout, crop-to-kind mapping and on-demand loading
- [x] MC-03 integrate welcome, processing, validation, connection and guidance states
- [x] MC-04 integrate local acknowledgement with honest photo/signature wording
- [x] MC-05 unit/browser acceptance, reduced-motion, image failure and layout stability
- [x] MC-06 regression, build, initial-JS gate and asset-size evidence
- [x] Independent review (code/browser scope; CHAR-01 closed)

Independent CHAR-01 re-review 2026-10-19: **PASS for the code/browser scope**,
`docs/reviews/marshal-character-char01.md`; combined current accepted snapshot
`docs/reviews/marshal-character-accepted.sha256`. The reviewer confirmed the
correction and revision-2 acceptance after independent checks. Earlier rejection
`docs/reviews/marshal-character.md` is preserved for history and superseded for
the corrected scope. Real-device and representative-user gates remain pending.

Revision-1 implementation evidence: `docs/handoffs/marshal-character.md`.
Gates at that handoff: focused unit 5/5, focused browser 9/9, full unit 236,
integration 103, browser 65, foundation 27, format/lint/typecheck/build,
153083 B gzip initial JS, and disposable-copy fault sensitivity
(`docs/handoffs/marshal-character-fault-sensitivity.txt`).

CHAR-01 correction evidence: `docs/handoffs/marshal-character-char01.md`,
preparation `docs/handoffs/marshal-character-char01-prepared.md`, active
manifest revision 2 (`docs/handoffs/marshal-character-tests.sha256`, rev 1
archived), and classification fault sensitivity
(`docs/handoffs/marshal-character-char01-fault-sensitivity.txt`). Gates on the
corrected state: focused component 13/13, focused CHAR-01 browser 7/7, full unit
244, integration 103, browser 72, foundation 27, format/lint/typecheck/build,
153084 B gzip initial JS.

## Gate notes

- No final submission or issued-challan celebration is in scope.
- Existing frozen acceptance is not replaced or weakened.
- Real-device camera/signature and representative-user comprehension remain
  separate pending gates; the prepared pack is
  `docs/handoffs/field-acceptance/` (prepared, not executed).
