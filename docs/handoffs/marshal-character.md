# Marshal character — implementation evidence (008)

Date: 2026-10-19. Feature: `specs/008-marshal-character/` (owner brief
2026-10-19). Prepared acceptance: `docs/handoffs/marshal-character-prepared.md`,
frozen manifest `docs/handoffs/marshal-character-tests.sha256` (5/5 OK at
implementation start and at handoff; tasks.md is intentionally not pinned
because its implementer boxes are ticked after verification). Reviewed dependency: inclusive-UX
correction PASS `docs/reviews/inclusive-ux-corrections.md`; accepted snapshot
`docs/reviews/inclusive-ux-accepted.sha256` verified 35/35 before the change.

Scope: six supplied illustrations integrated as whole-image states with
restrained CSS transitions, honest local-only acknowledgement and on-demand
loading. No submission, receipt, offline, API/contract or dependency change.
MC-01–MC-08 implemented; independent review remains unchecked.

## Changed files and hashes

Production:

| File | SHA-256 |
| --- | --- |
| `apps/tablet/src/routes/EntryFlow.tsx` | `b87064f7f1703381c2616d49c1e2ced12d59d6ae3fa6bcb783e002acc98cf5a5` |
| `apps/tablet/src/features/character/MarshalCharacter.tsx` | `f7f8383b79cb3efdeb833251c05723da7c92635ed0ad7ea278e5762a6dbe3550` |
| `apps/tablet/src/features/character/characterAssets.ts` | `96eca2ef4011f4ff6f458b94cadfd19e227f5aa2aed35873fdc8ffd6677092ed` |
| `apps/tablet/src/features/character/marshalCharacter.css` | `9e17fdb0f8ae45efa48616f3a6a4a51a72a03bd79da4a51eaaa3b873cb91b78d` |
| `tools/prepare-character-assets.py` | `ce4f9bd97de730e4c0018f1dcf2427017e1fa3f1eeae58b28c67ceb96c5f2eb6` |

Assets (originals in `assets/` untouched; derivatives are transparent WebP):

| Derivative | Display | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `public/characters/welcome-full.webp` | 640×640, full body, initial | 35,418 | `7845b7bc0498cc3dd9e94cf63f0058b0a650b4853e034e0cbb84dbfde3f2d7ee` |
| `public/characters/check-details.webp` | 480×480, checklist | 27,228 | `ce46e694671c9792129e3bb52f8dc6b0fabaf7968ae7969d41bacbd278cd73f9` |
| `public/characters/processing.webp` | 480×480, clipboard | 25,870 | `27258951356fbab4400aedd34b2b95f9766616a860967cff82f3528ff66eaf44` |
| `public/characters/success.webp` | 480×480, thumbs up | 26,860 | `733aa8d199db92aadeb310e124bca13763e51faab24eccc89a51315feae164c2` |
| `public/characters/error.webp` | 480×480, explaining | 25,970 | `04e502a6e870bd8776c00c9a8d1588db142517faaad73ca293ab29e55cdb468b` |
| `public/characters/connection.webp` | 480×480, crossed Wi-Fi | 36,794 | `fdf4e4385dc2e521c3442f1f57be3cd11462bd398c517bf82cc5be8279e8d73e` |

Original PNG sizes: 688,474–797,824 B each (4,323,601 B total). Derivative total
178,140 B; only 35,418 B is initial. `tools/prepare-character-assets.py`
regenerates byte-identical derivatives (`sha256sum -c` verified).

Acceptance, planning and index files:

| File | SHA-256 |
| --- | --- |
| `apps/tablet/src/__tests__/marshal-character.test.tsx` | `13c128f9b03f3a19bcc1cbeca779c61ea722cd9337b6b1e4ccc3b6127dd024e8` |
| `apps/tablet/e2e/marshal-character.spec.ts` | `579ec84fd9fa420f92d597a0a77cd3c92bfcb37570f5806e868ea9c8504fb08e` |
| `apps/tablet/e2e/marshal-character-media.spec.ts` | `1302df208cec2ce24212752e725e4ec8b932260ca36c1dd7b5a23931b2e9ed6c` |
| `specs/008-marshal-character/spec.md` | `fb5744e65dcc5a38ce58d2f045d8571f07170627eb680c39b536439ff87191ab` |
| `specs/008-marshal-character/tasks.md` | `7005f5b4f2817579898f9a418bf346d88048db4d62b70d5662ea9077e79ee024` |
| `docs/handoffs/marshal-character-prepared.md` | `0b4749d735cece31aacb2eb12052f4680d80f07b94d9d15507cf6c9fc0305408` |
| `docs/handoffs/marshal-character-tests.sha256` | `af32fcc532e9fb149c0b9f4a901f05d984fb4bf1934116adc4f92d6661f11a01` |
| `.specify/feature.json` | `ef78905f427252766599a790607181943f9928d60997b0fd89f117aca64074a8` |
| `docs/implementation-plan.md` | `646eea257ab6baccf164d464d6ca28967925d11e93ddffac5009ccb1857689c3` |
| `docs/handoffs/marshal-character-fault-sensitivity.sh` | `918a526315fefa3f6cefbf204ab59da25d8eb7f6b3abbc963d0dd357fe5548ec` |
| `docs/handoffs/marshal-character-fault-sensitivity.txt` | `a36537557c303dd5212d3771dba15bc452aa4c9be641f0dd24307669cb78744d` |

Baseline impact: `sha256sum -c docs/reviews/inclusive-ux-accepted.sha256` now
reports exactly one mismatch, `apps/tablet/src/routes/EntryFlow.tsx`
(accepted `ea5303c7…` → `b87064f7…`). No other accepted hash changed; R1–R7
behaviour is re-exercised by the full browser suite. The independent reviewer
decides whether the inclusive-UX review scope needs re-confirmation.

## Behaviour implemented

- One character slot on the form crossfades between welcome, processing,
  validation error and connection failure. No character per field, no toast.
- Welcome: full-body mascot, plain next action “Go to vehicle number” that
  focuses the field.
- Processing: clipboard mascot with a 2.6 s breathing motion and an accessible
  `role="status"` + `role="progressbar"` indicator, plus an in-button spinner
  while the real validate/preview requests are pending.
- Validation error: concerned mascot with the linked `Fix these details`
  summary; no connection illustration.
- Connection failure: crossed-Wi-Fi mascot only for a real fetch failure (form
  review and catalogue load), with a retry action and “Nothing has been
  submitted.”
- Summary: checklist mascot guiding the read-aloud check with the driver.
- Signature step: thumbs-up acknowledgement distinguishing “Photo captured”
  and “Signature confirmed locally”, always with “No challan has been
  submitted.” No issued-challan celebration or receipt exists anywhere.
- Animation: 220 ms welcome rise; 100 ms fade-out → 140 ms fade-in handoff
  (240 ms total) for state changes; one 320 ms success pulse; reduced motion
  leaves illustrations static and hides the outgoing layer.
- Accessibility: every image `alt=""`/`aria-hidden`, not focusable, explicit
  640/480 dimensions, text and actions survive image failure; status is carried
  by text and live roles, never the illustration.

## RED evidence

- Unit: `pnpm --filter @echallan/tablet exec vitest run src/__tests__/marshal-character.test.tsx`
  → failed to resolve `../features/character/MarshalCharacter` (new-module RED).
- Browser: `pnpm exec playwright test apps/tablet/e2e/marshal-character.spec.ts --project=tablet`
  → 7 failed, 1 passed. Failures were the missing `marshal-welcome`,
  `marshal-processing`, `marshal-error` and `marshal-connection` states and the
  acknowledgement, on a working pre-change app. The camera-exclusion case
  passed because it is a negative guard (no character existed yet); it remains
  meaningful against a wrong-illustration regression.

## GREEN and gates

| Command | Result |
| --- | --- |
| Focused unit (`vitest run src/__tests__/marshal-character.test.tsx`) | PASS, 5/5 |
| Focused browser (2 new specs) | PASS, 9/9 |
| `pnpm run format:check` | PASS |
| `pnpm run lint` | Exit 0, 124-file boundary pass; one pre-existing unused eslint-disable warning at `SignaturePad.tsx:248` |
| `pnpm run typecheck` | PASS, packages/apps/e2e |
| `pnpm run test` | PASS, 236: 42 contracts, 101 API, 14 admin, 79 tablet |
| `pnpm db:up` | already healthy (demo 5432, test 5433) |
| `pnpm run test:integration` | PASS, 103 real-PostgreSQL tests |
| `pnpm run test:e2e` | PASS, 65 browser cases |
| `pnpm run build` | PASS, shared packages, API and both clients |
| `pnpm run check:tablet-size` | PASS, 153081 B gzip across 2 initial assets, <250000 B |
| `pnpm run test:foundation` | PASS, 27 in one run |

Bundle detail: initial JS 153081 B gzip (accepted baseline 153070 B, +11 B). The
character code and CSS ship in the lazy `EntryFlow` chunk (52.47 kB / 15.60 kB
gzip JS, 1.10 kB / 0.41 kB gzip CSS). Image transfer is reported separately:
178,140 B total, 35,418 B initial, remaining 142,722 B on demand.

## Fault sensitivity

`docs/handoffs/marshal-character-fault-sensitivity.sh` (disposable copy, Vite on
5273, workspace API untouched; record
`docs/handoffs/marshal-character-fault-sensitivity.txt`):

- Fault: validation errors render the connection illustration.
- RED: `MC-04/MC-06: validation errors use the concerned illustration, never
  the network one` fails because `marshal-error` is not rendered.
- Reverted in the same copy: the same case passes 1/1.

## Screenshots

Captured with Playwright against the real dev API at desktop 1280, tablet 1024
and portrait 768, and narrow 390:
`test-results/marshal-character-screens/` (11 PNGs: welcome at 1280/1024/768/390,
validation error at 1024/768, processing, check-details guidance, local
acknowledgement, connection failure, image-failure narrow). `test-results/` is
ignored, so the reviewer should recapture or request copies if needed.

## Manual / device checks pending

- Real rear camera, gloves/stylus signature feel, field glare and representative
  user comprehension are not claimed (B-03/V-03, UXA-31/32 remain pending).
- The synthetic camera proves application flow and wording only.
- Reading comfort and animation taste are human judgements; the review should
  inspect the screenshots or the running build.

## Known issues and disclosures

- Prepared-baseline corrections: the main e2e spec was Prettier-normalised after
  the recorded RED run (whitespace only), and `tasks.md` is excluded from the
  frozen manifest because its implementer boxes change after verification. Both
  are disclosed in `docs/handoffs/marshal-character-prepared.md`; the reviewer
  must confirm them.
- `.specify/feature.json` now selects `specs/008-marshal-character` and
  `docs/implementation-plan.md` records this feature; no canonical task boxes
  were advanced.
- `test-results/` is a disposable output directory; the screenshots are evidence
  for this handoff, not committed fixtures.

## Review request

See `docs/review-requests/marshal-character.md`. No implementation box is
self-approved; the review box remains unchecked.
