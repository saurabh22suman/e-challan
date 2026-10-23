# Marshal character — prepared acceptance (008)

Prepared: 2026-10-19, before implementation. Source: owner brief 2026-10-19,
feature `specs/008-marshal-character/spec.md`, reviewed inclusive-UX baseline
`docs/reviews/inclusive-ux-corrections.md` (accepted hashes
`docs/reviews/inclusive-ux-accepted.sha256`, verified 35/35 at preparation).

This record defines the acceptance baseline. It approves nothing; independent
review remains separate. Per the owner brief, preparation and implementation
were requested as one continuous session; the independent review gate is
unchanged and no self-approval is claimed.

Preparation normalisations (both disclosed for reviewer confirmation):

1. The main e2e spec was run through the repository Prettier after the recorded
   RED evidence run. Only whitespace/wrapping changed; assertions, selectors and
   test names are identical.
2. `specs/008-marshal-character/tasks.md` is deliberately **not** part of the
   frozen manifest: its implementer-owned boxes are ticked after verification and
   would otherwise invalidate the baseline. The manifest pins the executable
   acceptance, the feature spec and this preparation record. The final tasks.md
   is still hash-listed in `docs/handoffs/marshal-character.md` for review.

## Assets and mapping

Originals in `assets/` are preserved (six 1254×1254 RGBA PNGs). Derivatives are
transparent WebP under `apps/tablet/public/characters/`:

| State | Source | Derivative | Display |
| --- | --- | --- | --- |
| Welcome (full body) | Friendly Hi-Vis Safety Worker Mascot.png | `welcome-full.webp` 640×640, 35,418 B | form idle |
| Check details (waist-up, checklist) | Friendly Safety Inspector with Checklist.png | `check-details.webp` 480×480, 27,228 B | summary guidance |
| Processing (waist-up, clipboard) | Safety Inspector with Clipboard.png | `processing.webp` 480×480, 25,870 B | real pending request |
| Success (waist-up, thumbs up) | Cheerful Construction Worker Thumbs Up.png | `success.webp` 480×480, 26,860 B | local acknowledgement |
| Error (waist-up, explaining) | Concerned Safety Inspector Explaining.png | `error.webp` 480×480, 25,970 B | correctable validation |
| Connection (waist-up, crossed Wi-Fi) | Confused Technician with Tablet.png | `connection.webp` 480×480, 36,794 B | real fetch failure |

Crops preserve face, hands and the identifying prop; the welcome derivative
keeps the full body. No stretching: derivatives are fitted into transparent
squares with 6% breathing margin. Only the welcome derivative is initial.

## Acceptance prepared

| File | Covers |
| --- | --- |
| `apps/tablet/src/__tests__/marshal-character.test.tsx` | Decorative `alt=""`, eager welcome vs lazy compact, 640/480 reserved dimensions, kind→asset mapping, crossfade lifetime, callout text/action usable after image error |
| `apps/tablet/e2e/marshal-character.spec.ts` | Welcome guidance, initial-only asset loading, keyboard focus action, layout stability while the welcome image loads, image-failure resilience at 390 px, pending processing + progressbar + restrained motion, summary guidance, error illustration vs 422 server errors, real connection failure + retry recovery, camera-permission exclusion, reduced motion |
| `apps/tablet/e2e/marshal-character-media.spec.ts` | Synthetic camera: photo-captured vs signature-confirmed local wording, singular success emphasis, explicit “No challan has been submitted”, no issued/receipt language |

## Recorded expectations before implementation

- Unit suite: `marshal-character.test.tsx` fails to resolve
  `../features/character/MarshalCharacter` — expected module RED for a new
  feature; the meaningful RED is the browser suite.
- Browser suite: MC tests fail because no character exists (welcome/processing/
  error/connection/acknowledgement test ids absent), while the existing app
  still works. This is the behavioural RED.
- Change-detector expectation: introducing the defect “render the connection
  illustration for validation errors” must fail
  `MC-04/MC-06: validation errors use the concerned illustration, never the
  network one`.

## Exact focused commands

```bash
pnpm --filter @echallan/tablet exec vitest run src/__tests__/marshal-character.test.tsx
pnpm db:up
pnpm run build:packages
pnpm exec playwright test apps/tablet/e2e/marshal-character.spec.ts apps/tablet/e2e/marshal-character-media.spec.ts
```

Regression after GREEN uses the published root scripts: `format:check`, `lint`,
`typecheck`, `test`, `test:integration`, `test:e2e`, `build`, `check:tablet-size`,
`test:foundation`.

## Non-goals and pending gates

- No final submission, issued challan, receipt, offline issuance, API/contract
  change or new runtime dependency.
- Synthetic camera proves application flow only; real rear camera, gloves,
  stylus, glare and representative-user comprehension remain pending.
