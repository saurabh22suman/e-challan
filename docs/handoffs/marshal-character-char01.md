# CHAR-01 correction — implementation evidence (008, revision 2)

Date: 2026-10-19. Source: `docs/reviews/marshal-character.md` §1 CHAR-01 and §6
disposition. Feature: `specs/008-marshal-character/`. Prepared acceptance:
`docs/handoffs/marshal-character-char01-prepared.md`; active frozen manifest
`docs/handoffs/marshal-character-tests.sha256` revision 2 (9/9 OK at start and
handoff); revision 1 preserved as
`docs/handoffs/marshal-character-tests-rev1.sha256`.

Scope: distinguish a rejected catalogue transport from an HTTP service response.
The crossed-Wi-Fi character is used only for a rejected transport. HTTP 500/503
show an honest server-error callout with Retry. 401/403 session refusal and
malformed successful bodies remain distinct and character-free. No API, contract,
database, asset, animation or R1–R7 change.

## Changed files and hashes

| File | SHA-256 |
| --- | --- |
| `apps/tablet/src/features/issuance/useCatalogues.ts` | `1748f3543394efd7c4f1ef0b1458bb1d503a1d407621a0a546ac87a2ed8f6381` |
| `apps/tablet/src/routes/EntryFlow.tsx` | `72f730eb1ba2eb40c877805ff3f8a9c169d2c2737d2b2a20f0e14be3e51078ff` |
| `apps/tablet/src/__tests__/catalogue-errors.test.tsx` | `af79f671c5fe9d8d0fd6d5d8a39a1ae09d7dcbda7cf090bd0af2d5c6a7414fca` |
| `apps/tablet/e2e/marshal-catalogue-errors.spec.ts` | `bbcf618ea49b92d729da19a4e34b77a2159843db41cc6dd8ce2cabb85a8e0e2e` |
| `specs/008-marshal-character/spec.md` | `ba3926e90589ef998fefbe41f45417a6c52850fe9ee6fbb72ed833241bb85142` |
| `docs/handoffs/marshal-character-char01-prepared.md` | `dbb732615049fbe8dc45fdb649659d7dd1857412a94c958bb70db34997b0bc21` |
| `docs/handoffs/marshal-character-tests.sha256` (rev 2) | `6c09bf617bb7ae56ec804de3006762f8312ebc6d11c001279b8c4580248d44eb` |
| `docs/handoffs/marshal-character-tests-rev1.sha256` | `af32fcc532e9fb149c0b9f4a901f05d984fb4bf1934116adc4f92d6661f11a01` |
| `docs/handoffs/marshal-character-char01-fault-sensitivity.sh` | `a1d1c25b15395d0c1b4450dabebb052f7d91d4a48ed4dc9a77e45aedd4caf861` |
| `docs/handoffs/marshal-character-char01-fault-sensitivity.txt` | `3d71f774f13c420d5160391a96d8961930fbd59d121f0760cc924019812c2bce` |
| `specs/008-marshal-character/tasks.md` | `99695632849beb407f1dc96bddf6d0210c091b9deeed92043f1bdbbb8a368100` |

`specs/008-marshal-character/tasks.md` remains excluded from the frozen manifest
because its implementer boxes change after verification (reviewer-confirmed
correction). Assets, `MarshalCharacter`, CSS and the existing 008 acceptance are
byte-unchanged.

## Behaviour implemented

- `CatalogueState` gains `reason: 'service_error'`; `loadCatalogue` returns
  `{kind:'service_error', status}` for any non-2xx/401/403 HTTP response.
  Precedence: unauthenticated → invalid contract → service error → network.
- HTTP 500/503 render `marshal-service-error`: concerned illustration, title
  “The server returned an error”, body `Couldn't load <kind>. The server
  returned an error (HTTP <status>). The tablet reached the server; the lists
  could not be loaded. Retry, or ask your supervisor if it continues.` and a
  Retry action. No connection illustration or “can't reach” claim.
- A rejected transport still renders `marshal-connection` with the crossed-Wi-Fi
  character and network recovery copy.
- 401/403 keeps the existing session message; malformed 200 keeps the contract
  message; both stay character-free with Retry where already present.

## RED evidence

| Command | Result |
| --- | --- |
| `pnpm --filter @echallan/tablet exec vitest run src/__tests__/catalogue-errors.test.tsx` | 3 failed / 5 passed: HTTP 500, HTTP 503 and the 500-retry case returned `reason: 'network'` instead of `service_error` |
| `pnpm exec playwright test apps/tablet/e2e/marshal-catalogue-errors.spec.ts --project=tablet` | 3 failed / 4 passed: HTTP 500, HTTP 503 and 500-retry failed because `marshal-service-error` did not exist and the connection callout was shown |

Transport rejection, 401 refusal, malformed 200 and transport-retry passed
before the change (already correct); they are retained as negative controls.

## GREEN and gates (final bytes)

| Command | Result |
| --- | --- |
| Focused component suite (2 files) | PASS, 13/13 |
| Focused CHAR-01 browser spec | PASS, 7/7 |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | Exit 0, 126-file boundary pass; one pre-existing unused eslint-disable warning at `SignaturePad.tsx:248` |
| `pnpm run typecheck` | PASS, packages/apps/e2e |
| `pnpm run test` | PASS, 244: 42 contracts, 101 API, 14 admin, 87 tablet |
| `pnpm run test:integration` | PASS, 103 real-PostgreSQL tests |
| `pnpm run test:e2e` | PASS, 72 browser cases (65 previous + 7 CHAR-01) |
| `pnpm run build` | PASS, shared packages, API and both clients |
| `pnpm run check:tablet-size` | PASS, 153084 B gzip across 2 initial assets, <250000 B |
| `pnpm run test:foundation` | PASS, 27 in one run |

All previous 008 and inclusive-UX/R1–R7 cases remain in the 72-case browser run;
no existing test was edited or skipped.

## Fault sensitivity

`docs/handoffs/marshal-character-char01-fault-sensitivity.sh` (disposable copy
of `apps/tablet` with symlinked `node_modules`; workspace untouched; record
`docs/handoffs/marshal-character-char01-fault-sensitivity.txt`):

- Fault: HTTP failures classified as `network` (the pre-correction behaviour).
- RED: `vitest run ... -t "HTTP 500"` fails with
  `expected 'network' to be 'service_error'`.
- Reverted in the same copy: the same command passes 1/1.

## Screenshots

`test-results/marshal-character-screens/char01-connection-transport-1024.png`,
`char01-server-error-500-1024.png`, `char01-server-error-503-1024.png`
(Playwright against the real dev API with intercepted catalogue responses;
`test-results/` is ignored).

## Disclosures

- Preparation correction before the RED run: the two retry browser controls
  hold the failure until the test releases it, because React StrictMode runs the
  catalogue effect twice in development. The first version consumed its one-shot
  failure on the first mount; the revision is recorded in
  `docs/handoffs/marshal-character-char01-prepared.md`.
- No production fix was applied by the reviewer; this correction is the
  implementer response to CHAR-01.
- Real-camera, gloves/stylus, glare and representative-user acceptance remain
  pending and are not claimed.

## Review request

See `docs/review-requests/marshal-character-char01.md`. MC-03/MC-05 are re-ticked
on the CHAR-01 evidence; the independent review box remains unchecked.
