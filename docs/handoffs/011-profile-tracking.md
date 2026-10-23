# Handoff — profile and challan tracking history, 2026-10-21

Task/feature: owner-authorised follow-up `specs/011-profile-tracking`. Parent
R-01/R-05 review boxes remain unchecked; this is read-only self-service/profile
and tracking surface.

PRD/cases: AUTH-01/AUTH-02, REV-01/REV-02, UI-03. Owner request recorded in
`docs/decisions.md` (2026-10-21).

## Scope delivered

- `GET /profile` for any valid session: own username, display name, employee ID,
  role, active state, assigned locations and current session context (post,
  shift, expiry). No password/hash/token field exists in the contract.
- Admin dashboard **Profile** tab for Supervisor and Admin.
- Tablet **Profile** button/dialog for Marshal, fetched only when opened.
- Challan detail now includes `issuedBy` and a **Tracking history** starting with
  the issuance entry, followed by append-only Under Review/Resolved/Cancelled
  actions with action, remarks/reason and performer.
- No profile editing, cross-user profile read, or evidence-history UI.

## Files changed

Production:
- `packages/contracts/src/profile.ts` (new), `src/index.ts`, `src/operations.ts`
- `apps/api/src/profile/routes.ts` (new), `apps/api/src/app.ts`
- `apps/api/src/challans/service.ts`
- `apps/admin/src/api/operations.ts`
- `apps/admin/src/features/profile/ProfilePanel.tsx` (new)
- `apps/admin/src/routes/DashboardScreen.tsx`
- `apps/admin/src/features/challans/ChallanDetailDialog.tsx`
- `apps/tablet/src/auth/session.tsx`
- `apps/tablet/src/profile/api.ts` (new), `src/profile/ProfileDialog.tsx` (new)
- `apps/tablet/src/App.tsx`
- `apps/admin/vitest.config.ts` (10 s per-test budget for the multi-select journey)

Tests/planning/docs:
- `packages/contracts/test/profile.test.ts` and updated 009 contract fixture
- `apps/api/tests/integration/profile.test.ts` and updated 009 detail assertions
- `apps/admin/src/__tests__/profile.test.tsx`, updated 009 detail fixture/heading
- `apps/tablet/src/__tests__/profile.test.tsx`
- `apps/admin/e2e/profile.spec.ts`, `apps/tablet/e2e/profile.spec.ts`
- Updated `apps/admin/e2e/review-admin.spec.ts` tracking heading
- `specs/011-profile-tracking/{spec,plan,tasks}.md`
- `docs/decisions.md`, `docs/implementation-plan.md`, `README.md`
- 009 rev-3 and 011 rev-2 planner manifests
- `docs/handoffs/011-profile-tracking.md`, `...-files.sha256`

## Planner baseline corrections

- 011 rev 2: profile assertions scope duplicate username/employee-ID text; tablet
  profile fixture uses the profile session shape (not the login shape); the admin
  test checks for a password *input* rather than the word in existing copy.
- 009 rev 3: additive `issuedBy` and Tracking history require fixture/heading
  updates. No assertion was removed or weakened.

## RED evidence

| Surface | Result |
|---|---|
| Contracts profile test | 6/6 failed; profile module absent |
| API profile integration | 5/5 failed; route 404 |
| Admin profile component | 2/2 failed; Profile tab absent |
| Tablet profile component | 1/1 failed; Profile button absent |

## GREEN evidence

| Check | Result |
|---|---|
| `sha256sum -c docs/handoffs/011-profile-tracking-tests.sha256` | 9/9 OK |
| `pnpm run format:check` | pass |
| `pnpm run lint` | pass (pre-existing unused-disable warning only) |
| `pnpm run typecheck` | pass incl. e2e tsconfig |
| contracts tests | 6 files / 63 tests pass |
| API unit | 11 files / 104 tests pass |
| API integration | 12 files / 132 tests pass |
| admin components | 5 files / 26 tests pass |
| tablet components | 12 files / 88 tests pass |
| `pnpm run build` | pass |
| `pnpm run check:tablet-size` | 156,623 B gzip initial JS (limit 250,000) |
| `pnpm run test:e2e` | **78/78 pass** |

## Failure sensitivity (disposable copy)

| Fault | Observed failure |
|---|---|
| Profile response carries `passwordHash` | all profile 200 assertions fail (contract refuses the leak) |
| Challan detail omits `issuedBy` | detail/review responses fail the contract; 5 tests fail |
| Restored copy | profile + challan-review focused suites 22/22 pass |

## Browser/UI evidence

Playwright MCP screenshots verified:
- Admin Profile card: username, display name, employee ID, role, active state,
  assigned locations, session expiry.
- Tablet Profile dialog: display name, username, employee ID, role, locations,
  post/shift, session expiry; no password field.
- Challan detail: Issued by Ravi Patel (DEMO-EMP-004), Tracking history with
  Issued and Resolved entries, action, remarks, performer.

The new browser journeys cover the admin Profile tab and the Marshal Profile
dialog against the real API/DB. There is no screenshot-diff visual baseline.

**Dialog chrome correction (2026-10-21):** shared `MuiDialog*` theme overrides now
give the profile, challan-detail, create-user, reset and deactivate dialogs the
same blue header and bordered surface as the cards/form sections. The
create-user form is a responsive two-column grid, and the browser journey asserts
the dialog header colour matches the card header. Full e2e remains 78/78.

## Known limitations

- Profile is read-only; no profile editing or password self-service.
- No endpoint or UI exposes another user's profile; Admin user management remains
  the separate administrative surface.
- Tracking history shows issuance + review actions, not evidence/signature events
  or the raw audit log.
- No visual-regression snapshots; the tablet budget remains under the gate.

## Review request

Fresh reviewer session/model, please check: profile authorization and no
credential leakage; session context correctness; issuer/tracking ordering and
immutability; the additive contract changes to 009; and the updated test
baselines.
