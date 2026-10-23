# Review — owner UI revision round 1 (2026-10-17)

Implementer-led review round 1 for the B-08/B-09 revision (searchable vehicle
dropdown, one-off new vehicle, full visual restyle). This is not the independent
review required by the workflow; the reviewer checkboxes remain open for a
separate session.

## Scope inspected

- `packages/theme` (tokens, createTheme, primitives), tablet shell/login/EntryFlow,
  `VehiclePicker`, media components, admin shell/login/dashboard.
- Browser walkthrough at 1280×800: tablet login → entry form → dropdown list →
  autofill → violations → summary (Occurrence 5) → capture/signature →
  acknowledgement; new-vehicle mode; switch back to registry; admin login →
  dashboard. Screenshots in `.playwright-mcp/r1-*.png`.

## Findings and dispositions

| # | Severity | Finding | Disposition |
| - | -------- | ------- | ----------- |
| 1 | High | Native master selects (Department/Contractor/Vehicle type) rendered as bare underlined controls, inconsistent with the outlined fields and weaker in glare. | FIXED: `variant="outlined"` on NativeSelect; theme pads/labels consistent. |
| 2 | Medium | Dropdown panel overlapped the helper text (magic `calc(100% - 18px)` anchor). | FIXED: helper moved outside the anchor box; panel anchors at `top: 100%`, covering the helper like a standard combobox. |
| 3 | Medium | Chevron click race: closing via the chevron immediately re-opened the panel (root click handler fired after). | FIXED: `stopPropagation` in the chevron handler. |
| 4 | Medium | "Search the registry instead" returned to registry mode with the list closed, losing the user's context. | FIXED: `openSignal` prop re-opens and loads the list on switch-back. |
| 5 | Medium | Release gate caught the registration input at 40px after the input padding override (UI-01 measures the input element). | FIXED: tablet input padding restores >=56px; `foundation.spec.ts` passes. |
| 6 | Medium | The results panel stayed floating over later fields after focus moved on; blocked clicks underneath. | FIXED: panel visibility now requires focus inside the picker (or an explicit open). |
| 7 | Low | Stray visible `0` diagnostics (`resize-signal`) under the signature pad. | FIXED: hidden while keeping the node for probes. |
| 8 | Low | Summary duplicated driver/vehicle/violation values (prose + rows), breaking strict-text queries and reading as clutter. | FIXED: prose is now a lead-in; values appear once in labelled rows. |

## Verified after fixes

- `pnpm --filter @echallan/tablet run test` — 69 passed.
- `pnpm run test` (all workspaces) — contracts 42, api unit 101, admin 14, tablet 69.
- `pnpm run test:integration` — 103 passed (real PostgreSQL).
- `pnpm run test:e2e` — 38 passed (tablet, admin, api-proxy).
- Browser: dropdown lists exactly the five loc-main vehicles; MH12RT7306 absent;
  autofill fills driver/pass/department/contractor/type; occurrence 5 banner;
  photo + signature + acknowledgement; new-vehicle notice and switch-back.

## Round-2 targets

- 1024px and narrow-check of the picker panel and step strip.
- Re-run all gates on the frozen round-1 state.
- Confirm no regression in foundation usability spec after the select restyle.
