# Pre-issuance batch implementation plan

Authority: `specs/005-pre-issuance/spec.md`; approved replacement specification v0.1
with the auth addendum v0.2; design doc; decisions B-02/B-04/B-05/B-06/D5. Preserve
every F-01/F-02/F-03 file, migration, contract behaviour and historical baseline;
new production work is additive.

Owner-bounded batch: F-04 → I-01 → I-05 may run continuously at verified GREEN,
with independent review deferred to batch exit. This exception covers only these
three tasks and supplies no self-review or new business policy.

## Phase A — F-04 foundation and shells

1. Verify the batch manifest and every earlier baseline; inspect the accepted
   F-02/F-03 snapshot.
2. Add pinned self-hosted `@fontsource/ibm-plex-sans` and
   `@fontsource/ibm-plex-mono` (5.3.0 at preparation time) and import them from
   `packages/theme`; extend tokens (status/severity, focus ring, identifier mono,
   disabled text) without changing approved colours or the green-only commit rule.
3. Add shared primitives in `packages/theme`: statically labelled field, form
   section, validation/error summary, notice/alert and severity chip (outlined).
   Exact-path MUI/icon imports only; no new UI framework.
4. Replace the foundation chrome: tablet `EntryFlow` lazy route (phase B fills it),
   admin lazy `DashboardScreen` with an honest empty state. Preserve login/logout,
   role boundaries, context attribution, idle expiry and C1 ordering.
5. Reconcile the foundation checks: rewrite the tablet/admin foundation component
   and browser suites for the new shells, move the proxy health/readiness checks to
   `page.request`, and update the R4 lazy-route module paths. Document the S-01
   baseline delta; do not regenerate historical manifests.
6. Run UI-01–UI-03 acceptance (labels, touch targets, focus, fonts, contrast,
   responsive navigation, no admin widgets on tablet, lazy chunking, budget).

## Phase B — I-01 entry, lookup and validation

7. Add `packages/contracts/src/preIssuance.ts` exactly as specified, with pure
   window/Other helpers; keep `deriveChallanSeverity` and
   `recommendedActionForOccurrence` as the only mappings.
8. Add the API registry lookup service and route: Marshal-only, post-location
   scoped, 3+ characters, one match per pass, zero-history vehicles included,
   expired status, no inactive-master filtering of the pass itself.
9. Add the authoritative draft validation service and route: normalisation,
   active/existing masters, distinct violations, Other-remarks coupling, provenance
   consistency, session-bound location, derived severity, `422 invalid_draft`.
10. Add the tablet entry form and flow: master catalogues, autocomplete with
    debounce/cancel/sequence guard, multiple-driver choice, editable autofill,
    validation display, summary step and Back with preserved values, session-scoped
    draft cleared on logout/idle.
11. Run ENT-01–ENT-06 acceptance (contracts, API, component, browser).

## Phase C — I-05 repeat and duplicate preview

12. Add the preview service and route over `challans`: gate-pass-keyed non-cancelled
    count in `[T-90d, T)`, recommendation tier, vehicle+session-location count in
    `[T-15min, T)`, injected clock, no writes.
13. Add persistent repeat/duplicate notices and explicit acknowledgement to the
    summary step; invalidate acknowledgement and summary on material changes or a
    changed re-preview.
14. Run REP-01–REP-05 acceptance (unit boundaries, real-DB counting with exact
    boundaries and cancellations, component acknowledgement/invalidation, browser
    persistent notice).

## Verification order

`format:check` → `lint` → `typecheck` → focused contracts/unit → real-DB
integration → component suites → affected production builds → browser journeys →
tablet budget → foundation clean-artifact checks, using the verified root commands.
Disposable-copy fault sensitivity must cover at least: lookup scope, stale-response
guard, inactive-master rejection, Other-remarks coupling, each window boundary,
cancellation exclusion and duplicate vehicle/location independence. Restore and
rerun clean; never mutate the user's repository.

## Focused commands

```bash
sha256sum -c docs/handoffs/pre-issuance-tests.sha256
sha256sum -c docs/handoffs/F-02-tests.sha256
sha256sum -c docs/handoffs/F-03-tests.sha256
pnpm run build:packages
pnpm db:up
pnpm --filter @echallan/contracts exec vitest run test/pre-issuance.test.ts
pnpm --filter @echallan/api exec vitest run --project unit tests/unit/pre-issuance-rules.test.ts
pnpm --filter @echallan/api exec vitest run --project integration tests/integration/pre-issuance.test.ts
pnpm --filter @echallan/tablet run test
pnpm --filter @echallan/admin run test
pnpm run test:e2e
```

## Boundaries and ownership

- Planner-owned and frozen by the batch manifest: the new acceptance files, the
  revised foundation suites, `specs/005-pre-issuance/**`, this plan and the
  authority documents.
- Writable by the implementer: `packages/contracts/src/**`,
  `packages/theme/src/**`, `apps/**/src/**` (except frozen tests),
  `apps/api/tests/**` only if a planner correction is agreed, `package.json` and
  `pnpm-lock.yaml` for the two pinned font packages, `.env.example`,
  `playwright.config.ts`, `.github/workflows/ci.yml`.
- Read-only: `docs/decisions.md`, `docs/eChallan_replacement_spec*.md`,
  `docs/reviews/**`, every historical `*.sha256` manifest.
- Additive migrations only if genuinely required; none is planned.
