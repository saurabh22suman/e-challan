# Marshal character CHAR-01: independent focused re-review

Date: 2026-10-19.

**Verdict: PASS for feature 008's code/browser scope, with CHAR-01 closed.**

Scope: `docs/review-requests/marshal-character-char01.md`, the two corrected
production files, revision-2 acceptance and preservation of the previously
reviewed character/animation and inclusive-UX behaviour. Reviewer did not implement
the correction or its acceptance. No production or frozen acceptance was edited.

This report supersedes `docs/reviews/marshal-character.md`'s rejection for the
corrected baseline. That report and rejected hashes remain preserved for history.
No new blocking finding was observed in this focused re-review.

## 1. CHAR-01 closure

Reviewed `useCatalogues.ts` and EntryFlow's catalogue-error branches:

- Rejected catalogue transport is `network`.
- HTTP 401/403 is `unauthenticated` before other non-success handling.
- Other non-success HTTP responses are `service_error`, carrying the returned
  status in the explanation.
- Malformed successful bodies and schema/kind mismatches are `invalid_contract`.
- Only ready, validated data supplies choices. Error states do not fabricate
  masters or render an apparently usable entry form.
- Service errors use the concerned character and accurately say the tablet
  reached the server. The crossed-Wi-Fi image is reserved for transport rejection.
- Retry reruns the actual catalogue loading, retaining the established auth and
  contract boundaries. There is no API, database, asset or animation-policy change.

**CHAR-01 is closed.**

## 2. Independent live-browser probes

Used Playwright MCP with the real local API/database and the committed synthetic
marshal account. Intercepted only `/api/masters/departments`, leaving other
catalogue/session requests real. This repeats the original failure boundary with
a single failing catalogue rather than replacing the entire catalogue service.

| Injected failure | Observed presentation | Recovery independently observed |
| --- | --- | --- |
| HTTP 500 | `marshal-service-error`, character kind `error`, HTTP 500 explanation, zero connection callouts | Removed interception, clicked Retry; real form and Logistics option returned |
| HTTP 503 | Same truthful server-error state with HTTP 503, zero connection callouts | Retry returned real form and Logistics option |
| Rejected transport | Exactly one connection callout/crossed-Wi-Fi character, zero service-error callouts, no entry field | Retry returned the real form |
| HTTP 401 | Session-invalid message, no character, no entry field | No false catalogue or connection state shown |
| HTTP 403 | Same distinct session-refusal state, no character or entry field | No false catalogue or connection state shown |
| Malformed HTTP 200 JSON | Distinct contract-error text, no character or entry field | Retry returned the real form |

For both HTTP service failures, visible text included:

> The server returned an error. […] The tablet reached the server; the lists could not be loaded.

No “can't reach the server” claim or connection illustration appeared for these
HTTP responses. Browser routing was removed after each probe; no test/production
source was changed to obtain these results.

## 3. Acceptance integrity and revision confirmation

- Active `marshal-character-tests.sha256`: **9/9 entries OK**.
- Active manifest SHA-256:
  `6c09bf617bb7ae56ec804de3006762f8312ebc6d11c001279b8c4580248d44eb`.
- Archived revision 1 SHA-256:
  `af32fcc532e9fb149c0b9f4a901f05d984fb4bf1934116adc4f92d6661f11a01`,
  matching the independently recorded earlier manifest hash.
- The three original executable acceptance files and initial preparation record
  retain their earlier hashes. The feature spec is intentionally amended for
  CHAR-01; it is not byte-unchanged. The preparation's general statement that all
  five prior entries are unchanged should be read alongside its explicitly
  documented spec amendment. No executable assertion was removed or weakened.
- Read the eight new hook/component cases and seven new browser cases. They
  include negative controls, no-fabricated-data assertions and real seeded browser
  catalogue recovery after both transport and HTTP failures.
- The persistent-failure retry setup is appropriate under development StrictMode:
  the test, not a first request, decides when to remove the fault. This prevents
  the second mount from silently consuming a one-shot failure before Retry.
- Keeping mutable feature task checkboxes outside the frozen manifest remains
  appropriate. Existing 008 and R1–R7 acceptance is preserved.

**Revision 2 is confirmed for the current acceptance content and documented
correction.** Module/import failure is not being counted as behavioural RED; the
recorded wrong-state assertions and this review's own boundary probes supply
the relevant behavioural evidence.

The fault-sensitivity script and recorded fault/restored output were inspected,
not independently rerun. No new reviewer mutation execution is claimed.

## 4. Commands actually rerun

| Command | Result |
| --- | --- |
| `sha256sum -c docs/handoffs/marshal-character-tests.sha256` | PASS, 9/9 |
| `sha256sum docs/handoffs/marshal-character-tests-rev1.sha256` | Matches earlier reviewed revision-1 hash |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | Exit 0, 126-file boundary pass; one pre-existing SignaturePad.tsx:248 unused eslint-disable warning |
| `pnpm run typecheck` | PASS, packages/apps/e2e |
| `pnpm run test` | PASS, 244: 42 contracts, 101 API, 14 admin, 87 tablet |
| `pnpm db:up` | PASS, demo/test containers healthy |
| `pnpm run test:integration` | PASS, 103 real-PostgreSQL tests |
| `pnpm run test:e2e` | PASS, 72 browser cases, about 1.9 minutes |
| `pnpm run build` | PASS, shared packages/API/both clients |
| `pnpm run check:tablet-size` | PASS, 153084 B gzip, 2 initial assets, <250000 B |
| `pnpm run test:foundation` | PASS, 27 in one run, 106.808 seconds |
| Prior inclusive-UX accepted-hash check | Exactly one expected mismatch: changed EntryFlow.tsx; other paths still match |

The full browser run includes all original character tests: correct validation
and camera-error mapping, real pending processing, animation/reduced-motion,
decorative images, image failure, reserved geometry and honest local photo/
signature acknowledgement. The prior R1–R7 tests, actual image encode/decode,
signature pixels/invalidation, auth/location and changed-preview checks also pass.

Assets, CSS, character primitive/mapping and generator retain the hashes inspected
in the first character review. Its independent six-output byte-identical
regeneration remains applicable; asset generation was not unnecessarily repeated.

## 5. Accepted snapshot and inclusive-UX re-confirmation

New combined current snapshot:
`docs/reviews/marshal-character-accepted.sha256`.

It pins the corrected EntryFlow and catalogue hook, character code/assets/tool,
both features' active acceptance manifests and prior reviewed source/configuration.
The acceptance manifests transitively pin the actual specs/tests/preparation.

The earlier `docs/reviews/inclusive-ux-accepted.sha256` remains a historical
snapshot. Do not rewrite it to hide the expected EntryFlow mismatch. This review
**reconfirms the affected inclusive-UX code/browser scope on the new integration**,
using source inspection, all prior regressions and the corrected catalogue
boundary. Unchanged accepted paths need no reset.

Restore 007's affected combined-review box and tick 008's independent-review box.
These are scoped feature approvals, not automatic completion of canonical F/I/R
tasks, final issuance or a field-release decision.

## 6. Remaining gates and scope limits

- Actual gate-device rear camera, gloves/stylus, field glare and representative
  user comprehension remain pending under their existing gates.
- Local capture is still not server-backed issuance. No receipt, numbering or
  final submission is accepted by this review.
- Language/help-route and optional inactivity-warning work remains separately
  scoped as already recorded.
- Any later source, acceptance, asset or animation change invalidates the affected
  portion of this accepted snapshot and requires its appropriate verification.

No production fix was applied by this reviewer. Earlier review reports and frozen
manifests remain preserved.
