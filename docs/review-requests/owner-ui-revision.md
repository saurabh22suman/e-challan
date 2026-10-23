# Review request — B-08/B-09 owner UI revision (2026-10-17)

Independent review requested for the owner-authorised UI revision. Run the
review in a fresh session/model; the implementation session cannot approve it.

## What to review

1. **Picker semantics** against `docs/decisions.md` B-08 and the revised
   baseline `docs/handoffs/owner-ui-revision-tests.sha256`:
   - opening lists the session post's location vehicles only (B-06 scoping);
   - 1–2 typed characters filter locally and start no request;
   - 3+ characters run the debounced, cancellable registry search;
   - selection fills driver/gate pass/department/contractor/vehicle type and
     all stay editable;
   - "Enter a new vehicle" is one-off: `registry: null`, nothing persisted, gate
     pass still required, occurrence keys on the entered gate pass.
2. **API list mode** (`GET /registry/lookup` with an empty `q`): scoped,
   registration-ordered, bounded at `REGISTRY_LIST_LIMIT`; 1–2 characters still
   400 `invalid_request`; auth/role rules unchanged.
3. **Restyle** against the constitution gates: >=56px tablet controls, static
   labels, mono identifiers, visible focus, contrast, green-only commit,
   initial JS budget, exact-path MUI imports, no admin widgets in tablet.
4. **Test-baseline correction**: confirm the revisions in
   `docs/handoffs/owner-ui-revision-tests.sha256` are honest (no assertion
   weakened or skipped) and that the timeout change is justified.
5. **Re-run independently**: `pnpm run format:check`, `pnpm run lint`,
   `pnpm run typecheck`, `pnpm run test`, `pnpm run test:integration`
   (db containers required), `pnpm run build`, `pnpm run check:tablet-size`,
   `pnpm run test:e2e`; verify `sha256sum -c` on the baseline file.

## Evidence to inspect

- Handoff: `docs/handoffs/owner-ui-revision.md`.
- Review rounds (implementer-led, not approval): `docs/reviews/owner-ui-revision-round1.md`,
  `docs/reviews/owner-ui-revision-round2.md`.
- Screenshots: `.playwright-mcp/r1-*.png`, `.playwright-mcp/r2-1024-dropdown.png`.

## Known open items (not defects)

- No full arrow-key roving in the option list; real-device camera gate remains
  B-03/V-03; list mode bounded at 100 pending the B-06 production handoff.

Report PASS / CHANGES_REQUIRED / BLOCKED in `docs/reviews/owner-ui-revision-independent.md`.
