# F-02 implementation plan — revision 3 (correction batch)

Use addendum A (`docs/eChallan_replacement_spec_v0.2.md`) as the authority for
authentication, `docs/eChallan_replacement_spec.md` v0.1 for everything else, and this
feature's spec/tasks for the wiring. Preserve every F-01 file, migration and baseline.
No dependency install is expected: the foundation tools and `@testing-library/*`,
`user-event`, `jsdom` and Playwright are already installed and pinned.

Revision 3 responds to two reviews:

- `docs/reviews/F-02-preparation-revision-2.md` — Q1–Q4 (preparation defects).
- `docs/reviews/F-02.md` — R1–R5 (implementation returned CHANGES_REQUIRED).

The acceptance baseline is `docs/handoffs/F-02-tests.sha256` **revision 3**; revision 2
is archived byte-for-byte at `docs/handoffs/F-02-tests-rev2.sha256` (its own SHA-256
matches the manifest the independent review inspected, so the archive is provably the
reviewed revision). No new owner product decision is required.

1. Verify the revision-3 manifest and the S-01/F-01/F-01-corrections baselines; inspect
   the reviewed F-02 snapshot (`docs/reviews/F-02-inspected.sha256`).
2. **Q1 — factory seam.** `createApp` must not read `process.env` implicitly. It takes
   explicit `credentials`; omitted means no configured accounts and every login fails
   closed. `server.ts` remains the only `loadDemoCredentials(process.env)` caller and
   keeps failing fast.
3. **Q2 — foundation preconditions.** The revised foundation component suites sign in
   through the real form against a stub that **requires the issued token** on session
   lookup. Keep every label, touch-target, health-contract, invalid-payload and
   lazy-route assertion; clear client storage between tests.
4. **Q3 — unknown-ID acceptance.** The integration case must inject `/challans/:id` and
   prove a known-record read succeeds before asserting the unknown UUID is a controlled
   404 from the handler.
5. **Q4 — role-mismatch acceptance.** Distinct configured usernames, a valid control,
   and the documented `role_mismatch` refusal asserted by code — never an unrelated
   configuration error or a generic status.
6. **R1 — role boundary.** Both clients enforce the approved interface boundary
   (Marshal ↔ tablet; Supervisor/Admin ↔ dashboard) on fresh login **and** on restored
   sessions, with visible feedback, no protected content, and revocation of the session
   the client refuses. API role/scope enforcement stays independently in force.
7. **R2 — transition ordering.** Order client transitions so a delayed `/auth/session`
   restoration cannot erase a newer successful login, and cannot resurrect protected
   content after logout. Rejected or malformed restoration bodies count as "no session".
8. **R3 — required context.** A Marshal login with no compatible active shift is refused
   (`403 forbidden_context`); an ambiguous post or shift step is refused `422
   ambiguous_context` with **exactly** the stored, active, authorised candidates
   (nothing fabricated, nothing from another location, nothing incompatible; the shift
   list is empty while the post itself is ambiguous); an explicitly supplied authorised
   selection always succeeds. The tablet sign-in screen renders labelled native
   `Post`/`Shift` selects containing exactly those options plus an empty placeholder,
   pre-selects nothing, preserves the entered credentials, and resubmits with the chosen
   ids. No default, no guess, no invented option.
9. **R4 — malformed ID.** Validate `:id` before querying; a non-UUID reaches neither
   PostgreSQL nor the error log and returns the controlled `404 not_found` body with no
   SQL, parameters or driver detail. Unexpected API errors never serialise internals.
10. **RED → GREEN.** Run the focused suites before the fixes and record genuine
    behavioural RED (not missing modules, not absent routes). Then implement and obtain
    GREEN on the unchanged revision-3 acceptance.
11. **Regressions and sensitivity.** Run the gate order below. In a disposable copy,
    bypass in turn: the factory fail-closed seam, the password comparison, the role
    boundary, the stored-role guard, the stale-response ordering, the zero-shift
    refusal, the location scope, the idle window and the ID validation — show the
    specific acceptance case fails for each, restore, and rerun cleanly. Never mutate
    the user's repository.
12. **Evidence.** Update `docs/handoffs/F-02.md` without replacing the historical
    record: append the correction-batch evidence, correct the four documentation
    inaccuracies listed in review R5, and leave the prior sections as history. Record
    exact commands, counts, migration/seed effects and limitations. Tick
    implementation only when acceptance holds; stop before independent review.

## Focused commands

```bash
sha256sum -c docs/handoffs/F-02-tests.sha256          # revision 3, 24/24
sha256sum -c docs/handoffs/S-01-tests.sha256
sha256sum -c docs/handoffs/F-01-tests.sha256
sha256sum -c docs/handoffs/F-01-corrections-tests.sha256
pnpm build:packages
pnpm db:up
pnpm --filter @echallan/api exec vitest run --project unit \
  tests/unit/f02-auth-config.test.ts
pnpm --filter @echallan/api exec vitest run --project integration \
  tests/integration/f02-auth.test.ts
pnpm --filter @echallan/tablet run test
pnpm --filter @echallan/admin run test
pnpm run test:e2e
```

Existing regression commands: `pnpm test:foundation`, `pnpm run format:check`,
`pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run test:integration`,
`pnpm run build`, `pnpm run check:tablet-size`.

## Boundaries

Planner-owned acceptance files, `docs/eChallan_replacement_spec*.md`,
`docs/handoffs/demo-env-login-decision.md` and every SHA-256 manifest are read-only.
Applied F-01 migrations are not editable. `.env.example` gains empty
`DEMO_*_USERNAME`/`DEMO_*_PASSWORD` placeholders only; no working secret is committed,
and `.env` is operator-supplied. Production startup validation stays strict, and the
injected factory must **not** regain a hidden environment fallback.

The approved scope and deferrals are unchanged: AUTH-01–AUTH-05 (AUTH-03 scoped,
AUTH-04 tablet-only idle), AUTH-06 out of scope, production credential management,
refresh tokens, per-person attribution and SSO deferred as recorded in addendum A §4
and `docs/decisions.md`/addendum §5a.

New and corrected planner acceptance is RED against the current implementation except
where noted in the prepared handoff. This does not negate the historical F-01
acceptance result.
