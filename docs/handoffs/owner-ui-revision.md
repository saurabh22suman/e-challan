# Handoff — B-08/B-09 owner UI revision (2026-10-17)

## Task and scope

Owner-directed revision recorded in `docs/decisions.md` (B-08: searchable
vehicle dropdown + one-off new vehicle; B-09: full visual restyle). Prepared and
implemented in the owner-authorised planner/implementer session of 2026-10-17;
independent review is requested separately and no review box is ticked here.

Affected cases: ENT-01, ENT-02, ENT-06, UI-01–UI-03; login and shell surfaces
previously covered by foundation smoke checks (tablet and admin).

## Changed files

| Area | File | Change |
| ---- | ---- | ------ |
| Contracts | `packages/contracts/src/preIssuance.ts` | `RegistryLookupQuerySchema` accepts an empty query as list mode; `REGISTRY_LIST_LIMIT = 100`; three-character search minimum unchanged |
| API | `apps/api/src/preIssuance/service.ts` | `lookupRegistry` list mode: all scoped gate-pass records for the session location, registration-ordered, bounded |
| API | `apps/api/src/preIssuance/routes.ts` | no route change; the schema now admits `q=` (list) while 1–2 characters still fail with the 400 message |
| Tablet | `apps/tablet/src/features/issuance/useLookupController.ts` | `startList` + `request` kind; list retries re-run the same request kind |
| Tablet | `apps/tablet/src/features/issuance/VehiclePicker.tsx` | new: searchable dropdown, focus-scoped panel, client filter for 1–2 chars, "Enter a new vehicle", chevron toggle, ArrowDown/Escape |
| Tablet | `apps/tablet/src/routes/EntryFlow.tsx` | picker integration + vehicle mode, step strip, sectioned cards, summary rows, restyled notices |
| Tablet | `apps/tablet/src/App.tsx`, `routes/LoginScreen.tsx` | shell and sign-in restyle; outlined context selects; loading panel |
| Tablet | `features/photos/PhotoCapture.tsx`, `features/signature/SignaturePad.tsx`, `features/signature/RefusalForm.tsx` | page-completion pass: viewfinder with placeholder/live states, capture chip, framed thumbnails, signature instruction + framed canvas, refusal audit JSON replaced by hidden diagnostics |
| Tablet | `features/photos/PhotoCapture.tsx`, `features/signature/SignaturePad.tsx` | token-based restyle; hidden `resize-signal` diagnostics |
| Theme | `packages/theme/src/{tokens,createTheme,primitives}.ts(x)` | new palette depth, outlined selects/highlight rows, card system, primitives |
| Admin | `apps/admin/src/App.tsx`, `routes/{LoginScreen,DashboardScreen}.tsx` | restyle; honest empty state and exact texts preserved |
| Harness | `apps/tablet/vitest.config.ts` | `testTimeout` 15s (dropdown renders per keystroke in jsdom) |
| Ignore | `.prettierignore` | `.playwright-mcp/` tooling artifacts |
| Docs | `docs/decisions.md`, `docs/reviews/owner-ui-revision-round{1,2}.md`, `docs/handoffs/owner-ui-revision-tests.sha256`, `specs/005-pre-issuance/spec.md` note | decision, review rounds, revised baseline, spec revision note |

## Behaviour delivered

- The vehicle control is a dropdown over the session post's vehicles (gate-pass
  scoped, B-06). Opening lists them; typing one or two characters filters
  locally with **no** request; three or more runs the existing debounced,
  cancellable registry search; selection fills driver, gate pass, department,
  contractor and vehicle type, all editable.
- "Enter a new vehicle" switches to one-off manual entry: the draft carries
  `registry: null`, nothing is written to the registry, and the gate pass number
  remains required so D5 counting is unchanged. An unknown gate pass simply has
  no prior challans (occurrence 1). "Search the registry instead" returns with
  the list open.
- Restyle covers tablet login, entry, summary, capture/refusal and admin login
  and dashboard, keeping constitution gates: >=56px controls, static labels,
  mono identifiers, focus rings, green reserved for commit, initial JS
  149247 B gzip.

## Evidence

- RED→GREEN per fix is recorded in the review docs; the gate catch (40px input)
  is in round 1 finding 5.
- Gates on the frozen state: format, lint, typecheck, unit (42/101/14/69),
  integration 103, e2e 38, build, tablet-size — all pass.
- Browser screenshots: `.playwright-mcp/r1-login.png`, `r1-entry.png`,
  `r1-dropdown-open2.png`, `r1-summary.png`, `r1-capture.png`,
  `r1-admin-login.png`, `r1-admin-dashboard.png`, `r2-1024-dropdown.png`,
  `final-entry6.png`, `final-capture.png`, `final-capture-active.png`,
  `final-refusal.png`.

## Known issues and pending checks

- Full arrow-key roving inside the open option list is not implemented (options
  are tabbable; ArrowDown opens; Escape closes).
- Real rear-camera behaviour remains the B-03/V-03 device gate; browser proof
  uses a fake video device.
- The list mode is bounded at 100; a production registry scale review is part
  of the later B-06 production handoff.
- Test-baseline changes are recorded in
  `docs/handoffs/owner-ui-revision-tests.sha256`; reviewer confirmation of that
  correction is required.

## Review request

See `docs/review-requests/owner-ui-revision.md`. Independent review must re-run
the gates, verify the picker against the recorded scoping and new-vehicle
semantics, and confirm the revised test baseline before any checkbox is ticked.
