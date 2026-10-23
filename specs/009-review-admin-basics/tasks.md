# Review and user administration slice — tasks

Implementation boxes only. Independent review remains a separate session and is
not requested by ticking these boxes. Parent R-01/R-03/R-05 boxes stay unchecked.

## Preparation

- [x] T901 Add the operations contracts and the `invalid_transition` code.
- [x] T902 Add contract, password, real-DB API, component and browser acceptance.
- [x] T903 Reconcile the F-04 empty-state assertions with the real workspace.
- [x] T904 Record the planner test manifest and hashes.

## API and storage

- [x] T911 Add the nullable `users.password_hash` and the additive migration.
- [x] T912 Implement Argon2id hash/verify and the stored-hash login path.
- [x] T913 Add the scoped challan list and extend detail with violations/history.
- [x] T914 Add transactional review transitions and audit rows.
- [x] T915 Add the Admin user list and reset endpoints with session revocation.

## Dashboard

- [x] T921 Expose the session token to authenticated API calls.
- [x] T922 Add the contract-parsed operations client.
- [x] T923 Build the role-aware challan list, filter and detail/history.
- [x] T924 Build the review action forms and Admin reopen form.
- [x] T925 Build the Admin user list and reset dialog.
- [x] T926 Preserve the existing heading, sign-in line and logout behavior.

## Verification

- [x] T931 Run format, lint, typecheck, unit, integration, component, builds and
  browser suites; record actual counts.
- [x] T932 Run the disposable-copy failure-sensitivity checks and rerun clean.
- [x] T933 Write the implementation handoff and request independent review.
