# Marshal character guidance: independent review

Date: 2026-10-19 (browser artifacts use UTC 2026-10-18).

**Verdict: CHANGES_REQUIRED. One medium-priority state-mapping correction.**

Scope: `docs/review-requests/marshal-character.md`, feature 008, its frozen
acceptance, derivatives/generator, character component/CSS and EntryFlow
integration. Reviewer did not implement this feature or its acceptance. No
production or frozen acceptance was changed during review.

The illustrations, crops, compression and restrained whole-image motion are a
useful addition. Standard gates pass and the prior R1–R7 regression suite remains
green. One untested failure class shows the connection character for a server
response, violating the feature's connection-only meaning.

## 1. Required correction: CHAR-01 — HTTP failures mislabelled as lost connection

Priority: **Medium**, MC-06 honesty/state mapping. Owner: production correction
to implementer; missing negative-control acceptance to planner first.

Locations:

- `apps/tablet/src/routes/EntryFlow.tsx:835–865`, especially the connection
  callout selected from `catalogues.state.reason === 'network'`.
- `apps/tablet/src/features/issuance/useCatalogues.ts:49–56,94–97,116–121`:
  every non-success HTTP response except 401/403 is classified as network.

The hook's broad classification predates this feature, but the new consumer now
turns it into a specific crossed-out-Wi-Fi illustration and asserts the tablet
cannot reach the server. An HTTP 500 response proves a server response arrived;
checking Wi-Fi is not an accurate explanation of that failure.

### Independent reproduction

1. Sign in using the synthetic marshal account.
2. In the review browser, fulfil `/api/masters/departments` with status 500 and a
   JSON server-error body. Leave the remaining real API requests unchanged.
3. Reload and await the catalogue error state.
4. Inspect the character, title and recovery instruction.

Observed twice:

```json
{
  "httpStatusInjected": 500,
  "character": "connection",
  "title": "The tablet can't reach the server\n\nCouldn't load departments. Check the network connection, then try again.\n\nRetry"
}
```

Screenshot: `.playwright-mcp/review-marshal-http500.png`.

### Required behaviour and acceptance

- Separate rejected/failed transport from an HTTP service failure when loading
  catalogues. Keep 401/403/session refusal and invalid-contract handling distinct.
- A genuine transport rejection may show the crossed-Wi-Fi character and
  connection recovery.
- An HTTP 500/503 response must show an honest server/service-unavailable message
  with Retry, without the network illustration or the claim that the server
  cannot be reached. A neutral/concerned illustration or existing Notice is fine.
- Add deterministic browser/component controls for rejected fetch, HTTP 500/503,
  auth refusal and malformed successful response. Retry must still recover with
  the real catalogue; do not hide the failure or fabricate master choices.
- Current MC-06 tests cover client validation, draft 422, aborted validation and
  camera denial, but never this catalogue HTTP-response boundary. Preserve those
  tests and prepare the missing control under a documented baseline revision.

This is a bounded client error-state correction. It needs no new API policy,
media contract, database change or asset regeneration.

## 2. Verification actually rerun

| Command/check | Result |
| --- | --- |
| `sha256sum -c docs/handoffs/marshal-character-tests.sha256` | PASS, 5/5 |
| `sha256sum -c docs/reviews/inclusive-ux-accepted.sha256` | Exactly one expected mismatch: EntryFlow.tsx; other recorded paths match |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | Exit 0, 124-file boundary pass; one pre-existing SignaturePad.tsx:248 unused eslint-disable warning |
| `pnpm run typecheck` | PASS, packages/apps/e2e |
| `pnpm run test` | PASS, 236: 42 contracts, 101 API, 14 admin, 79 tablet |
| `pnpm db:up` | PASS, demo/test containers healthy |
| `pnpm run test:integration` | PASS, 103 real-PostgreSQL tests |
| `pnpm run test:e2e` | PASS, 65, about 1.7 minutes |
| `pnpm run build` | PASS, shared packages/API/both clients |
| `pnpm run check:tablet-size` | PASS, 153081 B gzip across 2 initial assets, <250000 B |
| `pnpm run test:foundation` | PASS, 27 in one run, 106.453 seconds |
| Independent derivative regeneration into temporary output | Six byte-identical WebP outputs; temporary directory cleaned |

Initial hash verification and the inclusive-UX check were chained; the expected
EntryFlow mismatch stopped that first command before formatting. Formatting and
all remaining gates were then explicitly run successfully in subsequent commands.

No independent rerun of the disposable fault-mutation script was performed. Its
source and recorded RED/restored-GREEN evidence were inspected; those are
implementer-supplied evidence, not reviewer executions.

The current build emits EntryFlow JS about 52.56 kB (15.61 kB gzip) and character
CSS about 1.43 kB (0.46 kB gzip). The handoff's earlier lazy-chunk/CSS figures and
tasks.md's 153083 B line are stale; the measured 153081 B initial-JS total is the
current gate result. These small reporting differences are not the rejection.

## 3. Assets and visual inspection

Read every original illustration earlier in the owner session and all six current
derivatives during this review. The full-body welcome and compact crops retain
the face, hands and identifying props; no stretching was observed.

Ran the actual preparation function through `runpy` with only its OUT global
redirected to a `TemporaryDirectory` under `/tmp/opencode`. Production assets and
originals were not overwritten. Compared SHA-256 for every generated derivative
against the workspace and decoded dimensions/mode with Pillow.

| Asset | Dimensions | Bytes | Regenerated identically |
| --- | --- | --- | --- |
| welcome-full.webp | 640×640 RGBA | 35418 | Yes |
| check-details.webp | 480×480 RGBA | 27228 | Yes |
| processing.webp | 480×480 RGBA | 25870 | Yes |
| success.webp | 480×480 RGBA | 26860 | Yes |
| error.webp | 480×480 RGBA | 25970 | Yes |
| connection.webp | 480×480 RGBA | 36794 | Yes |

Total derivative transfer: **178140 B**, separately from JS. The current browser
acceptance confirms only welcome loads initially and other assets are requested
on demand. Reproducibility is confirmed in this installed Pillow/WebP environment;
the script does not pin a universal cross-version encoder output.

Live welcome inspected at 768×1024; screenshot
`.playwright-mcp/review-marshal-welcome-768.png`. The character is subordinate to
text/actions and does not replace labels. App-controlled state, not an animation
timer, governs completion. No articulated limb animation or final issuance is
implied.

## 4. Live state, motion and regression probes

- A real held validation response showed the processing character and a named
  progressbar. Under reduced motion, the illustration's computed animation name
  was `none` while the status/action text remained visible.
- Edited Driver name while that response was held: Check details became usable;
  released the stale response and performed a fresh Check. Summary showed the
  edited value and checklist guidance, preserving R1 recovery.
- Invalid empty entry showed the concerned character and focused error summary.
  Full existing acceptance also passed edit-time error retention, every error
  link, keyboard picker dismissal, manual-entry honesty, signature restoration,
  delete-last-photo invalidation, canvas naming/separation and session wording.
- The nine new browser tests passed image-load failure, reserved image geometry,
  actual pending processing, abort/retry, validation/422 exclusion, camera-denial
  exclusion, reduced motion and distinct local photo/signature acknowledgement.
- No issued receipt, server number or false submission success was observed in
  the new acknowledgement paths; explicit local-only text is preserved.
- One first reviewer pending-response probe unregistered a still-held route too
  soon and produced `Route is already handled`. That was review harness cleanup,
  not an application defect. Reran with explicit handler-ready/fulfilment/
  response-finished synchronisation; the probe passed as described above.

No physical-camera, gloves/stylus, field-glare or representative-user acceptance
is claimed. These remain pending, not reasons for the current rejection.

## 5. Acceptance revisions and inclusive-UX snapshot impact

- Excluding mutable `specs/008-marshal-character/tasks.md` from the test manifest
  is appropriate and consistent with the preceding feature. Its completion state
  is reviewed separately; the executable acceptance, spec and preparation remain
  pinned.
- Current formatted acceptance has meaningful assertions and the pinned hashes
  verify. The recorded Prettier-only correction is acceptable for the present
  content/intent. There is no archived pre-normalisation source proving a raw
  whitespace-only historical diff; this review does not fabricate that evidence.
- The unit missing-module RED is only wiring evidence. The browser's behavioural
  RED and fault-sensitivity record supply the disclosed meaningful feature RED.
- EntryFlow changed from the inclusive-UX accepted hash `ea5303c7…` to
  `b87064f7…`; the old approval is a historical snapshot, not current coverage
  automatically inherited by the new file. Keep its manifest unchanged.
- R1–R7 regressions pass on the new file, but the integration has CHAR-01.
  Therefore **do not issue a new accepted EntryFlow/inclusive-UX snapshot yet**.
  Reconfirm the affected scope when the new mapping correction and acceptance
  pass independent review. Other unchanged accepted files need no blanket reset.

Inspected hashes: `docs/reviews/marshal-character-inspected.sha256`. These are
rejected inspected-state hashes, not an accepted snapshot.

## 6. Disposition

- Return CHAR-01 acceptance preparation to the planner and production correction
  to the implementer, then request a focused independent re-review.
- Return 008 MC-03 integration and MC-05 acceptance completion to unchecked;
  leave its independent review unchecked. Other implementation boxes remain
  implementation claims, not combined approval.
- In 007, invalidate the affected combined-review checkbox for the current
  EntryFlow integration, preserving the historical PASS report and unchanged
  implementation completion. Do not tick canonical F/I/R or release gates.
- Preserve all originals, derivatives, frozen tests and previous acceptance
  manifests. No production fixes were applied by this reviewer.
