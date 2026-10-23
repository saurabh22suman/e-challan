# Review — owner UI revision round 2 (2026-10-17)

Implementer-led review round 2 on the frozen post-round-1 state. This is not
the independent review required by the workflow; the reviewer checkbox remains
open for a separate session.

## Re-verified on the frozen state

| Gate | Result |
| ---- | ------ |
| `pnpm run format:check` | Pass (`.playwright-mcp/` tooling artifacts added to `.prettierignore`) |
| `pnpm run lint` | Pass (0 errors; one pre-existing warning in SignaturePad) |
| `pnpm run typecheck` | Pass (all workspaces + e2e tsconfig) |
| `pnpm run test` | Pass — contracts 42, api unit 101, admin 14, tablet 69 |
| `pnpm run test:integration` | Pass — 103 (real PostgreSQL) |
| `pnpm run build` | Pass |
| `pnpm run check:tablet-size` | Pass — 149247 B gzip initial (threshold 250000) |
| `pnpm run test:e2e` | Pass — 38 (tablet, admin, api-proxy) against real API + DB |

## Round-2 browser checks

- 1024×768 landscape: no horizontal overflow; dropdown panel 894px wide
  anchored under the input; option rows 84px tall; step strip fits.
- Keyboard: ArrowDown opens the dropdown list; Escape closes it.
- Hover/click selection and the "Enter a new vehicle" footer verified at
  1280×800 in round 1; screenshots in `.playwright-mcp/r2-1024-dropdown.png`
  and `.playwright-mcp/r1-*.png`.

## Round-2 additional fix

F1 (Medium, round 1) was only partially effective: `NativeSelect` always
renders the standard underlined `Input` internally, and the first fix put
`variant` on the wrong level, so the master selects still looked underlined at
review. The final fix injects `input={<OutlinedInput />}` on `NativeSelect` and
gives the select a fixed border-box height (56px tablet / 40px desktop) so its
measured height matches the text fields at 57px. Browser re-check: all six
entry fields outlined, consistent, >=56px; screenshots
`.playwright-mcp/final-entry6.png`. Gates re-run green after the fix.

## Page-completion pass (same day)

After the owner asked whether *all* pages were redesigned: the capture-step
internals and secondary states had only received token-level touches, so this
pass redesigned them properly:

- `PhotoCapture`: "Evidence photos" header with a count chip; a viewfinder
  placeholder (camera icon, guidance, primary Start camera) when off; live video
  with Take photo / Stop camera when streaming; framed thumbnail cards; the
  required-photos caption. Pinned texts (`Photos: n of 4 (minimum 1 required)`)
  and every data-testid are unchanged.
- `SignaturePad`: instruction caption, "Stroke captured — confirm to apply"
  chip, framed canvas, primary-sized Confirm; developer-only revision/resize
  readouts are now hidden diagnostics.
- `RefusalForm`: the raw-JSON "Refusal audit" card is gone (hidden diagnostics
  node keeps the pinned testid); clean labelled layout and a primary-sized
  Confirm refusal.
- Loading states (master data, entry form, camera, signature, refusal) use a
  centred progress panel.
- Tablet sign-in's ambiguous-context Post/Shift selects match the outlined
  fields.
- Baseline revision: `preview-binding.spec.ts` and `signature-probe.spec.ts`
  scroll the canvas into view before measuring raw mouse geometry (the taller
  viewfinder can start it below the 720px fold); no assertion changed.

Final gates on this state: format, lint, typecheck, unit (42/101/14/69),
integration 103, e2e 38, build, tablet-size 149348 B gzip — all pass. Screens:
`final-entry6.png`, `final-capture.png`, `final-capture-active.png`,
`final-refusal.png`.

## Observations recorded, not defects

- `testTimeout` for the tablet component suite was raised to 15s because the
  dropdown renders per debounced keystroke in jsdom; assertions are unchanged.
- Full arrow-key roving within the dropdown option list is not implemented;
  options are tabbable buttons, ArrowDown opens, Escape closes. Recorded as a
  follow-up candidate, not a claimed capability.
- The camera flow in browser acceptance uses the fake video device; the
  real-device rear-camera gate (B-03/V-03) remains open and unclaimed.

## Verdict

No open defects from either review round. Independent review still required
before any checkbox is ticked; see `docs/review-requests/owner-ui-revision.md`.
