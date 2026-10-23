# Representative-user scenarios

Status: **not executed**. Formative discovery sample, not statistical
certification. Use synthetic records only; never real drivers or violations.

## Participants (5–8)

| Band | Count | Recruitment by |
| --- | --- | --- |
| Limited reading or digital confidence | 2–3 | Work experience and comfort; never label people “uneducated” |
| Experienced gate marshals | 2–3 | Current/former gate role |
| Supervisor or senior marshal | 1 | Supervisory experience |

If only 5 participants: 2 limited-confidence, 2 experienced, 1 supervisor.
Record the band, preferred reading language, glasses/glove/stylus use and device
experience at the top of each sheet. A participant who cannot read the interface
language is a language-barrier finding, not a failed participant.

## Setup

- Accepted build over trusted HTTPS on the target tablet, synthetic demo data.
- Consenting driver role-player for signature/refusal scenarios.
- Facilitator reads instructions aloud if preferred; no interface answers or
  coaching during the measured task.
- Start each scenario from a clean sign-in. Reset with the demo seed or by
  signing out and discarding the draft; never reuse another participant's entry.
- Times: record active work separately from setup and permission delays.

## Synthetic records (from `docs/demo-data.json`)

| Use | Values |
| --- | --- |
| Zero-history autofill | Vehicle `GJ05JP6207`, pass `DEMO-GP-0010`, driver **Kavita Joshi**, Logistics, Demo Unity Engineering Works, Car |
| Repeat/occurrence | Vehicle `GJ05DS4821`, pass `DEMO-GP-0001`, driver **Ramesh Kumar** (occurrence and recommendation come from the API) |
| One-off manual | Any unused valid plate, e.g. `GJ99XX9999`; no registry record is created |
| “Other” recovery | Department **Other** with no Remarks, then add Remarks |
| Refusal role-play | Reason “Driver left the scene”, witness **S. Iyer**, staff ID `DEMO-EMP-007` (synthetic) |

Recorded reachability limit: the single demo marshal is bound to the main post,
so the dispatch-location shared truck (`MH12RT7306`, two drivers) and the expired
pass are **not** offered here. Exercise the multi-driver choice only if the owner
provides a dispatch post account; otherwise mark it not reachable, not failed.

## Scenarios

Each scenario: **task** (read aloud), **watch for**, **pass criteria**,
**critical flag**. Record unassisted / with-help / abandoned, time, mis-taps,
backtracks and the participant's own explanation.

### S1 — Sign in and orient

- Task: sign in with the account given; say what this tablet is for and what you
  would do first.
- Watch for: sign-in comprehension, post/shift prompt (only if the API returns
  ambiguity), finding the vehicle field, the welcome message.
- Pass: signs in without help; can say the next step is the vehicle number or
  gate pass.
- Critical: cannot reach the form with help; believes signing in issues something.

### S2 — Registered vehicle, autofill and one correction

- Task: find `GJ05JP6207`, check the filled details, change the driver name
  slightly, choose “Not wearing a seat belt”, then Check details.
- Watch for: 3-character search, choosing the right suggestion, which fields
  autofill, editing a known field, the summary showing the edited value.
- Pass: selects the correct driver; edits one field; reaches the summary; can say
  the details are checked with the driver before signing.
- Critical: confirms the wrong driver; cannot recover from the search.

### S3 — Manual entry and registry truthfulness

- Task: enter a vehicle that is not in the list, complete the details, reach the
  summary, and explain whether it was added to the registry.
- Watch for: “Manual entry” honesty, no false “not in registry” claim for a
  carried plate, values retained.
- Pass: completes the entry; correctly says it is for this challan only and was
  not added to the registry.
- Critical: believes the manual entry changed the registry.

### S4 — “Other” and missing Remarks

- Task: choose Department “Other”, try to continue, then recover.
- Watch for: the plain Remarks requirement, the linked error, the counter,
  focus moving to the right field.
- Pass: explains why Remarks is needed; fixes it without help.
- Critical: abandons; cannot find the missing input.

### S5 — Repeat/duplicate notice

- Task: enter `GJ05DS4821` / `DEMO-GP-0001` / Ramesh Kumar, check details, and
  explain what the notice means and what happens next.
- Watch for: occurrence text, recommended action, “recommendation only — no
  action has been taken yet”, duplicate acknowledgement if it appears.
- Pass: can explain the notice in their own words; does not believe an action or
  challan already happened.
- Critical: believes a penalty was already applied or submitted.

### S6 — Photo capture, retake and permission recovery

- Task: capture one photo, retake it, then (conductor) deny camera permission and
  recover, then capture again.
- Watch for: start camera, rear camera, count, thumbnail, retake invalidation of
  the signature, denial message, permission restore.
- Pass: captures and retakes without help; explains the denial message and can
  restore access.
- Critical: a false photo appears; camera cannot work after permission is
  restored; privacy indicator stays on after stopping.

### S7 — Check details with the driver, sign and re-sign

- Task: role-play the driver check; ask the driver to sign; confirm; then change a
  detail and return to the signature step.
- Watch for: read-aloud guidance, draw with finger/glove/stylus, confirmed badge,
  invalidation after a detail change, re-sign requirement, rotation during
  signing if the device rotates.
- Pass: completes sign and re-sign; explains that changing details invalidates
  the old signature.
- Critical: an old signature stays confirmed after a change; a blank canvas is
  confirmed.

### S8 — Witnessed refusal

- Task: choose “Driver refuses to sign”; try to confirm blank; fill reason and
  witness; confirm.
- Watch for: linked blank-field errors, focus, witness name/ID, mutual
  exclusivity with signature, local-only wording.
- Pass: recovers from the blank fields without help; explains that the refusal is
  recorded locally with a witness.
- Critical: a fake witness is recorded; a challan is believed issued.

### S9 — Local capture is not a submitted challan

- Task: after S7 or S8, ask: “Has a challan been issued or sent?”
- Watch for: the participant's own words; expectation of a receipt, number or
  green commit action; the “No challan has been submitted.” wording.
- Pass: says no; understands it is only on the tablet; does not expect a receipt.
- Critical: believes the challan was issued, submitted or numbered.

### S10 — Inactivity expiry and next-operator privacy

- Task: leave the tablet on the entry step idle for 10 minutes, then try to
  continue; the next participant signs in.
- Watch for: return to sign-in, discarded unsent entry, no visible photo/
  signature/entry to the next operator, no optional warning expected.
- Pass: the next operator sees a clean sign-in and no previous data.
- Critical: previous entry, photo or signature visible; session still active.

## Character comprehension probes (during S1–S9)

Show each state as it naturally appears (do not force errors). Ask: “What is the
picture telling you? What would you do?” Do not name the state first.

| State | Expected plain meaning | Pass |
| --- | --- | --- |
| Welcome | Start with the vehicle/gate pass | Says start here |
| Check details | Check the details with the driver | Says read/check with driver |
| Processing | A real check is running; wait | Says wait, does not retry blindly |
| Error | Something needs correcting | Uses the linked list / fixes it |
| Success | A local step succeeded | Does not claim issuance |
| Connection | The connection is lost | Says network/connection, not “wrong details” |

Pass target: every participant gives the correct meaning for Welcome, Error and
Connection; all participants distinguish success/local from issuance. Record
verbatim quotes and any wrong interpretation with the state name.

## Scenario result fields (see `observation-template.md`)

Unassisted (Y/N) · with help (Y/N) · abandoned (Y/N) · active time · incorrect
selection · mis-taps · backtracks · validation recovery (Y/N) · explanation quote
· critical flag · severity · follow-up owner.
