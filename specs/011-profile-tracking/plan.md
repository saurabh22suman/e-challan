# Profile and tracking implementation plan

Authority: `specs/011-profile-tracking/spec.md`. Additive to 009/010.

## Phase 1 — Contracts and acceptance

1. Add `packages/contracts/src/profile.ts`, export it, and extend the challan
   detail contract with `issuedBy`.
2. Add tests:
   - `apps/api/tests/integration/profile.test.ts`;
   - `apps/admin/src/__tests__/profile.test.tsx`;
   - `apps/tablet/src/__tests__/profile.test.tsx`;
   - `apps/admin/e2e/profile.spec.ts`;
   - `apps/tablet/e2e/profile.spec.ts`;
   - extend the 009 integration/component assertions for issuer/tracking.
3. Record `docs/handoffs/011-profile-tracking-tests.sha256`.

## Phase 2 — API

4. Add `GET /profile` using the session and stored user/location rows.
5. Join `users` as issuer in challan detail; return `issuedBy`.
6. Do not expose password material or evidence binaries.

## Phase 3 — Clients

7. Admin operations client `getProfile`; Profile tab/panel with loading/error.
8. Tablet session exposes the token; Profile dialog fetches on open.
9. Challan detail shows Issued by and Tracking history with the issuance entry.
10. Preserve existing headings, tabs, labels and responsive layout.

## Phase 4 — Verification

Run format, lint, typecheck, contracts, API unit/integration, admin/tablet
components, builds, tablet budget and full e2e. Failure sensitivity in a
disposable copy: return a password field in the profile response and show the
leak test fails; remove the issuer join and show the detail test fails. Restore,
rerun, remove the copy. Record evidence in
`docs/handoffs/011-profile-tracking.md`; leave review boxes unchecked.
