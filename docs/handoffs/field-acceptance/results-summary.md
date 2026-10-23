# Field-acceptance results summary

Round: `round-<date>` · Conductor: `____` · Participants: `____` (P1–P__)
Build: accepted snapshot `docs/reviews/marshal-character-accepted.sha256`
(preflight output attached) · Device(s): `____`

Status: **template — not executed.** This summary does not authorise a pilot,
deployment, production data use or a release claim. It is a formative sample.

## 1. Scenario completion

Report numerator/denominator, not only percentages. “Core” scenarios are
S1–S9; S10 is the expiry/privacy check.

| Scenario | Participants | Unassisted | With help | Abandoned | Incorrect selection | Validation recovered | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 Sign in/orient | | | | | | | |
| S2 Registered + autofill | | | | | | | |
| S3 Manual entry truth | | | | | | | |
| S4 Other + Remarks | | | | | | | |
| S5 Repeat notice | | | | | | | |
| S6 Photo/retake/permission | | | | | | | |
| S7 Sign/re-sign/rotation | | | | | | | |
| S8 Witnessed refusal | | | | | | | |
| S9 Local-only status | | | | | | | |
| S10 Expiry/privacy | | | | | | | |

- Core unassisted rate: `__/__` = `__%` (provisional target ≥ 80%; owner confirms)
- Median active time for S2+S5+S7: `__ s` (context only; do not claim the PRD
  under-3-minute target from this capture-only build)

## 2. Character comprehension

| State | Correct meaning | Incorrect | Example wrong interpretation |
| --- | --- | --- | --- |
| Welcome | `__/__` | `__` | |
| Check details | `__/__` | `__` | |
| Processing | `__/__` | `__` | |
| Error | `__/__` | `__` | |
| Success | `__/__` | `__` | |
| Connection | `__/__` | `__` | |

## 3. Local capture vs submitted challan

- Participants who correctly said no challan was issued/sent: `__/__`
- Participants expecting a receipt, number or green commit action: `__`
- Any false submission belief: yes / no — if yes, the round fails.

## 4. Device checklist

Attach or summarise `device-checklist.md`. Record every Blocker failure with the
device and evidence.

| Area | Result | Blockers |
| --- | --- | --- |
| HTTPS, camera permission, rear camera | PASS/FAIL | |
| Sunlight readability | PASS/FAIL | |
| Gloves/stylus/touch accuracy | PASS/FAIL | |
| Photo capture/retake/limits | PASS/FAIL | |
| Signature/rotation/refusal | PASS/FAIL | |
| Validation recovery | PASS/FAIL | |
| Connection/server failures | PASS/FAIL | |
| Inactivity expiry/privacy | PASS/FAIL | |
| Performance samples | PASS/FAIL/NA | upload timing not measurable |

## 5. Critical failures

List every instance of: wrong driver confirmed; false submission belief;
cross-session data leak; destructive mis-tap; target-device camera unusable;
unreadable in sunlight. Each one fails the round and requires a correction and a
focused follow-up round.

| # | Participant | Scenario | Finding | Evidence | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | |

## 6. Disposition

- [ ] Device checklist: PASS / FAIL / BLOCKED (missing hardware or owner inputs)
- [ ] Representative-user round: PASS / PASS WITH FOLLOW-UPS / FAIL
- [ ] Critical failures: none / listed above
- [ ] Language limitation recorded (if participants could not read the interface
      language, the round is not a comprehension pass for that population)
- [ ] Blocking issues have owners and target dates
- [ ] No claim of final issuance, receipt or deployment

Conductor verdict: `____`
Owner acceptance: `____` (name/date) — the owner decides whether the release
target is met and whether the pilot may proceed; automated suites do not decide it.

## 7. Follow-ups

| Finding | Severity | Owner | Due | Verification |
| --- | --- | --- | --- | --- |
| | | | | |
