# Headed Chrome role walkthrough — 2026-10-25

Read-only UI walkthrough in **headed installed Google Chrome**, using an isolated
temporary Chrome profile. No source edits, user-profile changes, credential/
permission changes or operational-data writes were made. No challan was issued.

## Browser setup

- `chromium.launchPersistentContext('/tmp/opencode/headed-role-profile-…', { headless: false, channel: 'chrome', viewport: { width: 1440, height: 900 }, args: ['--no-sandbox', '--no-first-run', '--window-size=1440,900'] })`
- A separate isolated profile was used so the human owner's normal Chrome profile
  was not opened, modified or cleared.
- The profile had no service-worker registration or prior app state. This proves
  the application works in headed Chrome in a clean profile; it does **not** prove
  the connected persistent-profile failure is resolved. See
  `chrome-discrepancy-diagnosis.md`.

## Admin (EMP-1042)

- Sign-in and all five destinations rendered: Challans, Trend, Users, Masters,
  Profile.
- Challans: open filter drawer, filter to Under Review, apply and open a detail;
  resolution form is present. `Cancel this challan` is hidden initially; clicking
  it reveals the cancellation reason; `Keep record` hides it. Closed without
  submission.
- Trend: switched to 90 days and View as table; table rendered.
- Users: Create user, Reset password and Deactivate dialogs opened and were
  cancelled. No account was changed.
- Masters: all six category buttons changed the list; Add violation type dialog
  opened and was cancelled.
- Profile opened; logged out.
- Screenshots: `headed-admin-*.png`.

## Supervisor (EMP-2217)

- Only Challans, Trend and Profile tabs rendered; Users and Masters were absent.
- Scoped queue rendered. Opened an Under Review record: resolution form present,
  Admin cancellation control absent.
- Trend chart rendered; Profile rendered; logged out.
- Screenshots: `headed-supervisor-*.png`.

## Marshal (EMP-3106)

- Normal sign-in at `/` handed off to the tablet and rendered the entry flow.
- Recent vehicle `GJ05DS4821` autofilled; selected `Not wearing a seat belt`;
  reached Driver summary.
- At 390x844, driver, vehicle and violation were all fully visible on the first
  summary screen: driver 438–464px, vehicle 502–528px, violation 567–592px.
- Opened evidence/signature: signature canvas rendered; drew and confirmed a
  synthetic signature; commit remained disabled because no evidence photo exists.
- Opened refusal, entered synthetic reason/witness data and confirmed; refusal
  status rendered and commit remained disabled because no photo exists.
- Profile dialog opened; no challan was issued and no camera permission/evidence
  was collected.
- Network observed only read-only `POST /api/challans/validate` and
  `/api/challans/preview`; no commit or administrative write was sent. Console
  errors: none. Two logout requests were aborted only as the isolated context
  closed.
- Screenshots: `headed-marshal-*.png`.

## Result

Headed Chrome clean-profile walkthrough passed for Admin, Supervisor and Marshal
read/navigation flows and the local media/signature/refusal draft flow. The
persistent connected-Chrome tablet failure remains a separate unresolved
environment/profile issue and is not claimed as fixed by this walkthrough.
