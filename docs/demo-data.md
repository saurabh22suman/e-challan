# Synthetic Indian demo dataset

Data: `docs/demo-data.json`. This is a portable, framework-independent fixture
for the future demo UI and test/seed adapter, not an API request or production DB
dump. It contains 10 drivers, 9 vehicles, 10 explicit gate-pass records, 5 staff,
2 gate locations and 14 challans.

Indian names and vehicle-registration-style examples are illustrative. All events
and associations are fictional; this is not a demographic sample or real violation
history. Contractors/site/staff identifiers are explicitly demo data. No passwords,
phone numbers, Aadhaar numbers or other identity-document data are needed here.

## Useful examples

- Ramesh Kumar, `DEMO-GP-0001`, car **GJ05DS4821**: multiple records using exactly
  the same registration and gate pass; includes recent history and a record older
  than 90 days.
- Truck **MH12RT7306**: used by Imran Shaikh and Sanjay Patil with different gate
  passes. A shared vehicle does not mean a shared driver identity.
- Two **Ramesh Kumar** driver records: different gate passes; autocomplete can show
  both, but name matching must not merge them.
- At fixed reference time **1 October 2026, 12:00 IST**, GJ05DS4821 has a main-gate
  record at 11:50 and a dispatch-gate record at 11:58. These support same-location
  duplicate-warning and location-filter examples.
- Signed/refused states, one/four-photo counts, multiple violations, Other remarks,
  cancelled display state and historical inactive masters are represented.

## How the implementing model should use it

### Vehicle-number lookup and form autofill

`gatePassRecords` explicitly links a driver, vehicle, gate-pass number, department,
contractor and demo location scope. Join to `vehicles` for registration/type and
to `drivers` for name. The same vehicle can have multiple gate-pass/driver records.
`lookupExamples` records expected matches for demo searches.

Recommended interaction: after 3 characters, show matching vehicle/pass suggestions.
Normalise vehicle queries by uppercasing and removing spaces. Choosing a suggestion
fills **vehicle number, driver name, gate-pass number, department, contractor and
vehicle type**; known fields remain editable per PRD E2.4. Multiple matches show
name and gate-pass number so the marshal chooses the correct driver. Do not
autofill location from the pass: the current post/session determines the actual
issuance location. Never fill violation, remarks, evidence or signature from history.

Examples:
- `GJ05DS4821` → Ramesh Kumar / DEMO-GP-0001 / Logistics / Demo Western Freight Services / Car.
- `MH12RT7306` → Imran Shaikh or Sanjay Patil; selection required.
- `GJ05JP6207` → Kavita Joshi / DEMO-GP-0010 / Plant operations / Demo Unity Engineering Works / Car,
  even though she has no previous challans.

The expired pass provides a status-display fixture, not an approved admission or
issuance rule. Do not silently fill inactive master options. Production source,
refresh and expiry handling are recorded as B-06 in `decisions.md`; no external
gate-pass-system connection exists yet.

### Seed adapter

1. Read metadata and use `referenceNow` with a fixed test clock. Display timestamps
   using `Asia/Kolkata`; preserve stored offsets/instants. Do not silently refresh
   timestamps on every launch. An optional demo adapter may shift all timestamps
   together while preserving relative intervals, but tests keep the fixed clock.
2. Join IDs to driver, vehicle, staff and master records. The vehicle is not tied
   permanently to one driver. Department/contractor fields here are driver fixture
   defaults; production issued records need approved historical snapshots/references.
3. Map the fixture to the approved F-01 contracts once they exist. Do not make
   these fictional numbers, statuses, severities or master entries production rules.
4. `demoStatus` permits dashboard mockups; Resolved/Cancelled examples do not claim
   completed operational transitions or approved action data. D3 must define that.
   Escalation actions and repeat KPI expectations are intentionally not invented.
5. Media descriptions contain **no actual photo/signature files**. Show an honest
   demo-media state; do not pass these metadata counts as valid evidence to issuance.
   E2E issuance tests must capture/generate actual test blobs through the media flow.
6. Seed only an explicitly isolated demo/test environment. A future adapter must
   refuse production targets, be repeatable, and respect API/DB invariants. No
   database or seed command currently exists.

Invalid payload, exact 90-day/15-minute boundaries and permission failures remain
separate acceptance-test fixtures. Avoid mixing invalid records into the normal
demo dataset merely to exercise validation.
