# Pilot acceptance-test catalogue

These are case specifications, not executed or executable tests. The planner
writes runnable checks before each behavioural task after S-01 provides the
harness. Cases derived from proposed engineering decisions remain conditional
until those decisions are agreed. Unknown business boundaries must not be
silently replaced with guesses. Task mapping is in `implementation-plan.md`.

Levels: **Smoke** executable setup checks; **Unit** pure contracts/rules;
**API** real Fastify/PostgreSQL integration; **UI** component interactions;
**E2E** browser against real API/database; **Device** actual tablet/gate;
**Ops** deployment/restore drill.

## Foundation

| ID | Level | Scenario and observable expected result |
|---|---|---|
| SET-01 | Smoke | Clean checkout/env setup: install pinned dependencies, start test DB, migrate/seed and run documented checks without undocumented global packages. |
| SET-02 | Smoke | A focused sample contract, API persistence and browser smoke check all run and fail on deliberately wrong expected values; relevant test counts are nonzero. |
| SET-03 | Smoke | An app importing another app, or tablet importing forbidden admin widgets/MUI barrels, fails lint; allowed shared-package imports pass. |
| SET-04 | Smoke | CI runs actual typechecks/tests/builds and bundle measurement; a deliberately over-budget tablet fixture fails the size gate. |
| DOM-01 | Unit/API | Approved required fields, formats, enums and invalid payloads agree between shared schemas and API; multi-violation/aggregate severity follows approved policy. |
| DOM-02 | API | Migrations apply to an empty DB and upgrade the previous supported schema; seeds are repeatable without duplicate masters/users. |
| DOM-03 | API | FK and uniqueness constraints reject invalid references/duplicate identifiers; transaction rollback leaves no partial record. |
| AUTH-01 | API/E2E | Valid credentials load the correct role UI; wrong credentials do not issue usable tokens and do not expose password hashes. |
| AUTH-02 | API | Anonymous and wrong-role callers cannot access protected actions; supervisor cannot fetch another location's challan/evidence by guessed ID. |
| AUTH-03 | API | Expired/invalid tokens fail; valid refresh follows approved policy; logout and disabled users cannot regain access using old session credentials. |
| AUTH-04 | UI/E2E | With a controlled clock, tablet at 10 minutes of inactivity returns to login; allowed activity resets idle time; unsaved data follows B-04. |
| AUTH-05 | API/E2E | Post/shift/session/marshal attribution follows B-04; switching shifts cannot silently attribute new records to the previous shift. |
| AUTH-06 | API | Admin creates/disables/resets users; other roles cannot; password is Argon2id hashed, not stored or returned as plaintext. |
| MST-01 | API | Admin CRUD/deactivation works for each required master; non-admin attempts fail without side effects. |
| MST-02 | API/UI | Deactivated master cannot be selected for a new record but remains interpretable on historical challans. |
| MST-03 | API | Edit a master after issuance: historical labels/severity/action remain correct under approved B-05 policy. |
| UI-01 | UI/Device | All fields have visible/programmatically associated labels; tablet inputs/options >=56px, commit >=64px, icon controls >=56x56 and adjacent targets separated >=12px. |
| UI-02 | UI | Commit is the only solid-green action; status/severity labelled; focus visible; fonts self-hosted, identifiers mono, body-text contrast >=7:1, disabled values readable, decorative icons aria-hidden and thumbnails meaningfully labelled. |
| UI-03 | UI/E2E | Role navigation and responsive shells work; tablet lazy routes do not load admin grids/charts/date pickers. |

## Issuance

| ID | Level | Scenario and observable expected result |
|---|---|---|
| ENT-01 | Unit/UI | Plate uppercases and strips spaces; valid/invalid Indian registrations follow B-01 examples, with specific errors. |
| ENT-02 | API/UI | Fewer than 3 typed chars do not request suggestions; 3+ yields authorised results for plate/gate pass/name; selection fills known fields that remain editable. |
| ENT-03 | API/UI | Controlled fields accept current master IDs only; stale/deactivated/forged options rejected on server. |
| ENT-04 | Unit/API/UI | Multiple violation selections derive non-editable severity; Other in each applicable controlled field (department, vehicle type, violation, location) requires nonblank remarks in UI and API; tampered severity rejected. |
| ENT-05 | E2E | Approved entry steps preserve current values during in-flow Back/Next, prevent invalid advance and place driver summary before signature. No P1 persistent draft implied. |
| ENT-06 | API/UI/E2E | Vehicle lookup uses gate-pass source even without prior challans (GJ05JP6207); chosen match fills driver/name/pass/department/contractor/type and stays editable. MH12RT7306 shows both drivers for choice; actual location stays tied to post, not copied from pass. Missing/stale matches and expiry follow B-06; inactive masters are not silently selected. |
| CAM-01 | UI/E2E/Device | Camera button requests video only, shows live preview and prefers rear camera; capture adds a real frame thumbnail and no gallery selector is offered. |
| CAM-02 | UI | Capture 1 and 4 photos succeeds; fifth blocked; zero/deleting last photo makes evidence step invalid. Actual commit rejection belongs to SUB-02/SUB-06. |
| CAM-03 | Unit/Device | Representative frames are correctly oriented/resized/re-encoded; approximately 300 KB target and agreed limits met without making evidence unreadable. |
| CAM-04 | UI/Device | Denied/ignored permission, missing/busy camera, insecure context and failed encoding display recoverable states; no false capture success. |
| CAM-05 | UI/Device | Closing capture, switching camera, route leave or logout stops tracks and releases preview URLs; reopening works. |
| SIG-01 | E2E/Device | Plain-language summary appears first; full-width canvas accepts finger/stylus strokes without scrolling the page; saved PNG contains visible strokes. |
| SIG-02 | UI/E2E | Blank signature cannot satisfy submission; clear removes strokes and invalidates signature; redraw enables acknowledgement. |
| SIG-03 | UI/Device | Rotation/resize/high DPI preserves visible strokes and matching signature state, or explicitly requires re-signing; never stores blank as signed. |
| SIG-04 | Unit/UI | Shared acknowledgement schema and UI require nonblank refusal reason plus witness name and ID; complete refusal substitutes for signature in entry state; accessible path needs no drawing. Real commit acceptance/rejection is SUB-01/SUB-02. |
| SIG-05 | UI | Per E-03, changing acknowledged summary data invalidates prior acknowledgement in entry state. Server binding to final data is checked in SUB-06. |
| MED-01 | API/Ops | Real local adapter stores files and DB keys, not public URLs or base64 DB blobs; permitted retrieval returns matching bytes. |
| MED-02 | API | Bad MIME/content, oversized/corrupt data and another session's upload references rejected; path traversal cannot escape evidence root. Limits follow E-02/E-03. |
| MED-03 | API | Authorised evidence read logs viewer/time/source; anonymous or cross-location access fails; static routes expose no evidence files. |
| MED-04 | API/Ops | Inject adapter write failure: upload cannot claim success; cleanup deletes only unreferenced expired uploads. Commit atomicity with missing evidence is checked in SUB-04/SUB-06. |
| REP-01 | Unit/API | Gate-pass matches inside/outside/exactly at 90-day boundary follow D5; different gate-pass records do not merge merely because names match. |
| REP-02 | Unit/API | Approved occurrence/escalation matrix matches all supported severities/counts, cancellations and multi-violation records. |
| REP-03 | API/UI | Same vehicle+location within 15 minutes warns; different vehicle/location does not; exact boundary follows B-01; acknowledgement allows proceeding. |
| REP-04 | API | Seed a new matching record after preflight: recheck service returns updated occurrence/action and acknowledgement requirement; service-level count tests follow approved concurrency policy. Full commit integration is SUB-06. |
| REP-05 | UI/E2E | Repeat notice visibly shows occurrence number and prescribed action before signature/submission, not just a transient toast; summary reflects current repeat information. |
| SUB-01 | API/E2E | Submit valid signed and refused cases; persisted fields/photos/acknowledgement and returned server number match detail view and audit event. |
| SUB-02 | API | Direct request with no photos, invalid signature/refusal, forged references or missing required fields is rejected even if UI validation is bypassed. |
| SUB-03 | API/E2E | Per E-01, double tap and retry after lost response produce one challan/number/create event; same key with altered payload rejected. |
| SUB-04 | API | Concurrent issuance gets unique numbers; DB/finalisation failure leaves no partially issued record; safe retry follows agreed transaction/storage design. |
| SUB-05 | API/E2E | Issued fields/evidence cannot be edited/deleted by any role, including admin; failure state never claims issuance before server confirmation. |
| SUB-06 | API/E2E | Integrated commit rechecks uploaded-photo counts/ownership, acknowledgement binding and repeat counts after preflight; new repeat data requires renewed acknowledgement; file failure cannot leave issued record without evidence. |
| SUB-07 | API/E2E | Entry start and commit have server timestamps; persisted duration feeds weekly median, not client wall-clock or upload-only timing; idempotent retry does not reset start or duplicate samples. |

## Supervisor and admin

| ID | Level | Scenario and observable expected result |
|---|---|---|
| REV-01 | API/E2E | Supervisor lists their location, filters by status, opens all permitted detail fields/photos/signature; cannot reach another location by URL/API. |
| REV-02 | API/E2E | Approved Issued/Under Review/Resolved transitions require action/performer data and audit; invalid/out-of-order transitions rejected according to D3. |
| REV-03 | API | Concurrent status changes cannot overwrite intervening actions silently; original issued data remains unchanged. |
| CAN-01 | API/E2E | Reason and admin approval required; other roles cannot approve; successful cancellation retains original record and creates audit history. |
| CAN-02 | API | Cancelled record remains retrievable; repeat counts and dashboard totals follow D3/D5; repeated requests do not create conflicting approvals. |
| DASH-01 | API/UI | Seeded total/today/pending/resolved/repeat tiles match agreed timezone/status/cancellation/occurrence semantics. |
| DASH-02 | API/E2E | Each E4.2 filter and a combined set matches independently seeded expected records; no matches provides a clear-filters action. |
| DASH-03 | API/E2E | Stable sorting/pagination has no duplicate/omitted rows across a fixed dataset; row opens correct detail; all results remain permission-scoped. |
| EXP-01 | API | Filtered export contains every matching authorised row, including beyond first page, all agreed fields and no image binaries; workbook opens/parses. |
| EXP-02 | API | Export audit records user/time/actual filters/row count; count matches workbook; failed export has no false successful-export event. |
| EXP-03 | API | Untrusted text remains text, not executable spreadsheet formulas; unauthorised export cannot expose another location's records. |
| ADM-01 | API/E2E | Admin user create/disable/reset screens use real API; disabled user loses access; marshal/supervisor cannot invoke same endpoints. |
| ADM-02 | API/E2E | All required masters editable/deactivatable; historical references survive; inactive values absent from new-entry choices. |
| AUD-01 | API | Create/status/cancel/evidence view/export each generate required user/time/source events with correct record references and no secrets. |
| AUD-02 | API/Ops | Application DB role cannot update/delete audit rows; status and its audit entry commit together; normal application audit append remains possible. |

## Gate readiness

| ID | Level | Scenario and observable expected result |
|---|---|---|
| DEMO-01 | Ops/Device | Reviewed demo is reachable on approved VPS/domain over trusted HTTPS; tablet camera and signature work, gate-pass autofill uses synthetic dataset, dashboard and filtered export work against deployed API. |
| DEMO-02 | Ops | Demo DB/evidence survive container restart; env/secrets stay off client bundles, application has role access, seed only targets isolated demo DB, update/rollback and health checks documented. Existing VPS services remain functional. |
| OPS-01 | Ops | Approved deployment starts from documented env/migration order; restarts retain DB/evidence; no default production password; health failures observable. |
| OPS-02 | Ops/Device | Tablet reaches approved host over trusted HTTPS; API/media reachable under actual plant policy; camera permission works without certificate exceptions. |
| OPS-03 | Ops | Restore matching DB+evidence backup into separate environment and verify sampled challans, signatures/refusals, photos, masters and audit. Record duration and owner. |
| OPS-04 | Ops | Staff/owner exercise documented paper fallback and subsequent reconciliation; no offline-sync capability is claimed. |
| FIELD-01 | Device | Gate staff complete signed/refused flows on target tablet in sunlight/gloves, including retake and correction; labels remain readable and destructive controls separated. |
| FIELD-02 | Device/E2E | At 200% zoom controls remain reachable; keyboard flow/focus, labels/alt text and no-drawing refusal route work; reduced-motion removes transitions and no decorative load animations/shimmer appear. |
| FIELD-03 | Device/Smoke | Initial JS <250 KB gzipped; interactive <3s, submit excluding upload <1s, photo upload <3s on representative plant Wi-Fi. Document measurement method and samples. |
| FIELD-04 | Device/E2E | Connection drops during upload/commit, app backgrounds, permission denied and idle expiry: no false success/duplicate issuance or leak into next session. Persistent resumable drafts not asserted. |
| PILOT-01 | E2E/Ops | All P0 acceptance suites pass on release baseline; no unresolved blocking findings; restore/device reports and operating owner present. |
| PILOT-02 | Ops | Weekly measurement can establish digital issuance, under-3-minute median, zero unrecoverable records, <15-minute reports and >90% repeat-detection accuracy per PRD. Pilot targets are outcomes, not pre-launch claims. |

## Fixtures and proof

Use synthetic roles at two locations, active/inactive masters, 0/1/4-photo
records, signed/refused records, cancelled records and time-boundary examples.
Use deterministic clocks and an isolated DB per suite/worker; controlled API
failures for writes/commits/lost responses, and browser fake video for CI camera
flows. Do not replace real-device checks with screenshots from fake cameras.

Planner handoffs add exact fixtures, expected values, test files, commands and
failure-sensitivity evidence. Each case is NOT RUN until that evidence exists.
