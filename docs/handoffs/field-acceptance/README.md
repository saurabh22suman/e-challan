# Real-device and representative-user acceptance pack

Prepared: 2026-10-19. Status: **prepared, not executed**. No representative-user
or physical-device acceptance is claimed by this pack or by any Playwright run.

Sources: `docs/handoffs/inclusive-ux-revamp-plan.md` §9–§10 (UXA-30–32,
FIELD-01/03/04, B-03), `docs/development-workflow.md` (phase exits),
`docs/implementation-plan.md` V-03, `docs/test-cases.md` FIELD-01–FIELD-04 and
the accepted code/browser snapshots
`docs/reviews/marshal-character-accepted.sha256` and
`docs/reviews/inclusive-ux-corrections.md`. The accepted snapshot passes 51/51
on 2026-10-19; verify it again before the sessions.

Scope: tablet real-device checks and a formative representative-user round for
the current build. The current build stops at local capture; it has no final
submission, receipt or challan number. The pack never asks a participant to
expect one.

## Pack map

| File | Use |
| --- | --- |
| `README.md` | Prerequisites, conductor instructions, session flow, executed vs pending checks |
| `tools/preflight-field-acceptance.mjs` | Executable lab preflight (network/API/catalogue/assets). Run against the target origin before sessions |
| `preflight-local.txt` | Recorded preflight output against the local dev stack (executed 2026-10-19) |
| `device-checklist.md` | Physical/device checklist: HTTPS, camera, sunlight, gloves/stylus, rotation, media, refusal, recovery, expiry, character comprehension |
| `scenarios.md` | 10 simple scenarios for 5–8 representative staff, with synthetic records and pass criteria |
| `observation-template.md` | Per-participant observation/results sheet |
| `results-summary.md` | Aggregate results, pass/fail decision and sign-off |
| `owner-inputs.md` | Missing owner decisions that block or limit the sessions |

## What is already executed (code/browser) and what this pack adds

Executed and independently reviewed (do **not** re-claim as device/user evidence):

- Automated unit/integration/browser suites, reduced motion, image-failure
  resilience, connection vs server-error mapping, fault sensitivity.
- Bundle gate: initial tablet JS 153,084 B gzip, below 250,000 B.
- Character assets: six transparent WebP derivatives, 178,140 B total, 35,418 B
  initial; `tools/prepare-character-assets.py` reproduces them.
- Playwright screenshots and state probes (desktop 1280, tablet 1024/768,
  narrow 390).

Pending, and only satisfiable by this pack:

- Real rear camera, trusted HTTPS on the target network, camera permission on
  the device, sunlight readability, gloves/stylus feel, touch accuracy.
- Device rotation during signature, witnessed-refusal role-play, 10-minute
  inactivity expiry on the device, real network loss.
- Representative staff completing scenarios and explaining the character poses,
  the messages and the local-capture (not submitted) status.

**Playwright, fake-camera streams and screenshots are not device or user
acceptance.** The automated suite proves application flow only.

## Prerequisites (all required before a session)

1. **Owner inputs** in `owner-inputs.md` answered, especially B-03 device details
   and the preferred reading language.
2. **Reviewed build**: `sha256sum -c docs/reviews/marshal-character-accepted.sha256`
   passes. Any later source/test change invalidates the accepted scope; stop and
   re-review before sessions.
3. **Target environment**: the accepted build deployed over trusted HTTPS on the
   plant network with the synthetic demo data seeded. No production data.
4. **Device**: the owner-named target tablet, charger, stand, screen cloth, a
   stylus, and gloves of the type used at the gate.
5. **People**: 5–8 representative staff (see `scenarios.md`), a facilitator, a
   note-taker and one consenting driver role-player. Sessions must not use real
   drivers, real violations or disciplinary events.
6. **Consent and privacy**: explain the purpose, that participation is voluntary,
   that no performance record is kept, and what (if anything) is recorded. Do not
   record video/audio without explicit consent. Use participant codes, never names
   in the results sheet.

## Preflight (run before every session round)

From the repository root:

```bash
sha256sum -c docs/reviews/marshal-character-accepted.sha256
pnpm run check:tablet-size
node tools/preflight-field-acceptance.mjs --base https://<target-origin>
```

- `tools/preflight-field-acceptance.mjs` checks reachability, secure-context suitability, `/api/health`
  and `/api/health/ready`, a synthetic marshal login, session identity, all six
  catalogue endpoints and the six character assets. It prints PASS/WARN/FAIL and
  exits non-zero on FAIL.
- Use `--base http://127.0.0.1:5173` only for the local lab run. Localhost is a
  browser secure context, but it is not trusted HTTPS on a real network and is
  **not** device acceptance.
- `preflight-local.txt` records the executed local run. Re-run it if the local
  stack changes.
- The preflight cannot check the camera, gloves, sunlight or comprehension.
  Those are in `device-checklist.md` and `scenarios.md`.

## Session flow (about 60 minutes per participant)

1. Welcome, consent, language preference, glasses/glove/stylus note.
2. Give a one-line context: “This tablet is for recording a safety violation at
   the gate. Nothing you do today is sent anywhere; it is a practice record.”
3. Run the scenarios in order. Read instructions aloud if preferred, but do not
   read interface answers or coach during the measured task.
4. After each scenario, ask the participant to explain what happened in their own
   words. Record quotes verbatim.
5. For comprehension probes, show each character state and ask what it means and
   what they would do next. Never ask “is this the Wi-Fi one?”.
6. Finish with the local-status question: “Has a challan been issued or sent?”
   The correct answer is no; a local record only.
7. Thank the participant and remind them that no performance record is kept.

## Pass/fail and disposition

- Use the per-scenario criteria in `scenarios.md` and the rules in
  `results-summary.md`.
- Provisional formative target: at least 80% unassisted completion across core
  scenarios (report numerator/denominator, not only percentages). The owner must
  confirm the release target; without it, report results and leave the pass/fail
  decision open.
- Any critical failure (wrong driver confirmed, participant believes a challan was
  issued/sent, cross-session data visible to the next operator, destructive
  mis-tap, target-device camera unusable, unreadable in sunlight) fails the round
  and triggers a correction and another focused round.
- Smaller issues get an owner and a follow-up; the round is not “passed” while a
  blocking issue is unresolved.

## Data handling

- Synthetic records only: `docs/demo-data.json` and the committed demo accounts.
  Never enter real names, vehicle numbers, phone numbers or violation events.
- Delete any captured practice photos/signatures from the device at the end of
  the session; they are local-only test data.
- Store completed sheets under `docs/handoffs/field-acceptance/results/` using
  participant codes (for example `round-2026-11-P1.md`), or keep them offline
  with only the aggregate copied here.
- This pack does not authorise production data, a pilot start or deployment.
