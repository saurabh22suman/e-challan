# CHAR-01 — prepared acceptance revision (008, revision 2)

Prepared: 2026-10-19, before the production correction. Source:
`docs/reviews/marshal-character.md` §1 CHAR-01 (HTTP failures mislabelled as lost
connection) and §6 disposition. Feature `specs/008-marshal-character/`.

**This record approves nothing.** Independent re-review remains separate.

## Baseline revision

The active frozen manifest is revised to revision 2. Revision 1 is preserved
unchanged as `docs/handoffs/marshal-character-tests-rev1.sha256` (its own
SHA-256 is pinned in the revision-2 manifest). The reviewer inspected and
rejected revision 1 in `docs/reviews/marshal-character-inspected.sha256`; no
accepted snapshot existed for it.

Revision 2 adds two acceptance files and updates `spec.md` with the CHAR-01
classification requirement. The five revision-1 entries remain pinned and
unchanged; no existing test was edited, skipped or weakened. Assets, animation
CSS, `MarshalCharacter`, and the R1–R7 suites are untouched by this preparation.

| New acceptance | Covers |
| --- | --- |
| `apps/tablet/src/__tests__/catalogue-errors.test.tsx` | Component classification: rejected transport → `network`; HTTP 500/503 → `service_error` with the status; 401/403 → `unauthenticated`; malformed 200 → `invalid_contract`; no fabricated masters; retry recovers the real catalogue after both a 500 and a transport rejection |
| `apps/tablet/e2e/marshal-catalogue-errors.spec.ts` | Browser boundary: transport rejection shows the connection character with Retry; HTTP 500/503 show `marshal-service-error` with an honest “tablet reached the server” message and no connection character or “can't reach” text; 401 refusal and malformed 200 stay character-free and distinct; Retry loads the real seeded catalogue (Logistics / Car / seat-belt violation) after both failure classes |

## Expected RED before the correction

- Component: HTTP 500/503 cases fail because the current classification returns
  `reason: 'network'`; the 500-retry case fails on the first assertion. Transport,
  401/403, malformed and transport-retry cases pass (already correct today).
- Browser: HTTP 500/503 cases fail because `marshal-service-error` does not
  exist and the connection callout is shown; the 500-retry case fails at
  `marshal-service-error`. Transport, 401 and malformed cases pass.
- The failing assertions are behavioural (wrong state/absent element), not
  import or type failures; reason comparisons are cast to `string` so the new
  union member is a runtime expectation, not a compile error.
- The two retry browser controls hold the failure until the test deliberately
  releases it: React StrictMode runs the catalogue effect twice in development,
  so a one-shot per-path failure would be consumed by the first mount and the
  second round would silently succeed.

## Planned fault sensitivity

In a disposable copy, revert the HTTP classification to `network` (the CHAR-01
fault) and show the new component acceptance fails; restore and show it passes.
The workspace is not modified. The script and record are added with the
implementation evidence.

## Non-goals

No API, contract, database, asset, animation or R1–R7 change. No submission or
receipt behaviour. Manual/device gates remain pending.
