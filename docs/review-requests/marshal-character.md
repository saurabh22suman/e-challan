# Review request: marshal character guidance (008)

Requested: 2026-10-19. Feature `specs/008-marshal-character/`; implementation
evidence `docs/handoffs/marshal-character.md`; preparation
`docs/handoffs/marshal-character-prepared.md`; frozen acceptance
`docs/handoffs/marshal-character-tests.sha256`.

## Scope to review

- Six transparent WebP derivatives and the reproducibility script
  `tools/prepare-character-assets.py` (originals preserved).
- `MarshalCharacter`/`MarshalCallout` and the EntryFlow integration for
  welcome, processing, validation, connection and local acknowledgement.
- The honesty boundary: no submission, receipt or issued-challan celebration;
  explicit “No challan has been submitted.”
- Animation restraint, reduced motion, image-failure resilience, layout
  stability, focus behaviour and preservation of R1–R7.
- The new acceptance tests and the fault-sensitivity record.

## Commands to rerun independently

```bash
sha256sum -c docs/handoffs/marshal-character-tests.sha256
pnpm run format:check && pnpm run lint && pnpm run typecheck
pnpm run test && pnpm run test:integration && pnpm run test:e2e
pnpm run build && pnpm run check:tablet-size
pnpm run test:foundation
docs/handoffs/marshal-character-fault-sensitivity.sh   # API must already be running
```

## Specific review questions

1. Does any state show the connection illustration for validation or
   camera-permission errors, or show an issued/receipt claim? (Must not.)
2. Are the transitions tasteful and restrained, and does reduced motion leave a
   usable static state without double-exposing the outgoing layer?
3. Does the acknowledgement wording keep “photo captured”, “signature confirmed
   locally” and the absence of submission distinct?
4. Is the frozen acceptance manifest intact, and are the two disclosed planner
   corrections acceptable: the Prettier-normalisation of
   `marshal-character.spec.ts` (whitespace only) and excluding `tasks.md` from
   the frozen manifest because its implementer boxes change after verification?
5. Does the changed `EntryFlow.tsx` invalidate the inclusive-UX accepted
   snapshot beyond that single file, and is re-confirmation of R1–R7 needed or
   does the full browser suite suffice?
6. Are the asset crops honest (full-body welcome, waist-up compact states
   preserving face/hands/prop) and the sizes appropriate?

No self-review is claimed. The implementation boxes were ticked only after the
recorded gates; the review box remains unchecked.
