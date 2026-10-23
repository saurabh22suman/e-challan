# Similar-app benchmark — e-Challan UI and functionality opportunities

**Date:** 2026-10-22  
**Scope:** Public product documentation and help material for comparable field-enforcement,
inspection, parking-enforcement and gate-pass products, mapped to the current
post-remediation e-Challan app.  
**Method:** Desk research against public vendor/NIC material. No competitor
authenticated UI, account, or private demo was used. This is a pattern benchmark,
not a pixel-for-pixel competitor review.

---

## 1. Verdict

The current app already matches the **field-inspection baseline**: offline-shaped
form design, permanent labels, large targets, photo/signature evidence, review
states, master data, audit history, reporting and export. It is closer to a
modern inspection app than to an older government e-Challan client.

The biggest remaining opportunities are not more screens. They are:

1. **Cut seconds out of the gate interaction** with recent-vehicle shortcuts,
   QR/barcode or plate scanning, a stronger camera guide and a printable/QR
   receipt.
2. **Turn the Admin dashboard into a triage tool**, not only a filterable table:
   global search, saved views, “needs attention” queues, assignment/SLA, and
   faster detail navigation.
3. **Make evidence legally and operationally stronger**: timestamp/GPS context,
   annotations, hash/chain-of-custody metadata, zoom/compare and redaction.
4. **Add an honest offline/queue story** only if D1/P2 is approved; competitors
   treat offline as a core workflow, not a retry button.
5. **Add assisted data capture** (QR/OCR/ALPR) without letting a model become the
   authority for a plate or gate pass.

Do **not** copy payment, Vahan/Sarathi, fixed ANPR/CCTV, thermal-printer or
hotlist features just because competitors have them. Several require decisions,
integrations, hardware or legal review and are outside the current P0 pilot.

---

## 2. Products reviewed

| Product / category | Public material reviewed | Patterns relevant to e-Challan |
|---|---|---|
| **NIC eChallan** (India) | Official NIC user manual and eChallan brochure | Offline/online mobile issuance with local DB sync; geo-tagged photos; Vahan/Sarathi lookup; thermal receipt with QR; SMS/email; bilingual English/Hindi; officer work schedules; evidence/impounded-document images. |
| **Gujarat eChallan / ITMS** | NIC Informatics eChallan page | ANPR/CCTV/RISK integration; time-stamped evidence; multi-channel notifications; dynamic QR/UPI; virtual-court escalation; central dashboard. |
| **T2 Systems Mobile Enforcement** | Product page and mobile-enforcement brochure | Offline-first citation issuance; multiple photos/notes/GPS breadcrumbs; LPR hits; scofflaw/hotlist checks; supervisor void/waive and audit; weatherproof citation printing. |
| **Genetec AutoVu / Plate Finder** | Product and help documentation | Mobile ALPR from a phone camera; GPS zone context; hotlists; encrypted mobile query; last-25-reads session history; evidence-report confirmation of OCR against the image. |
| **SafetyCulture / Mitti (formerly iAuditor)** | Product page and getting-started material | Offline inspections and background sync; QR/barcode scanning; photo/video attachments; issues/actions with assignee, due date and priority; scheduled inspections; instant PDF/Word/CSV reports; live analytics. |
| **Fulcrum** | Mobile data collection and field reporting pages | Offline forms with local storage and automatic sync; required fields; conditional logic; barcode/GPS/photo/signature; auto timestamps; photo annotation; face blurring; reports and GIS/BI integrations. |
| **Gate-pass suites** (GateX, Odoo Gate Pass, QR Desk, Niyuk, Vizitor) | Public feature pages | Pre-approved QR passes; vehicle/driver/material identity; approval matrix; entry/exit time windows; duplicate-data detection; returnable tracking; gate-specific validation; printable pass with barcode; audit trail. |

### Source links

- NIC eChallan user manual: <https://parivahan.gov.in/sites/default/files/FAQDOCS/Echallan/echallan-user-manual.pdf>
- NIC eChallan brochure: <https://parivahan.gov.in/sites/default/files/FAQDOCS/Echallan/eChallan-brochure-ver-1.0.pdf>
- Gujarat eChallan / ITMS: <https://informatics.nic.in/files/websites/april-2025/echallan.php>
- T2 Mobile Enforcement: <https://www.t2systems.com/parking-enforcement-software/>
- UPsafety mobile enforcement data sheet: <https://www.t2systems.com/wp-content/uploads/2022/07/UPsafety-Mobile-Enforcement-Data-Sheet-V1.pdf>
- Genetec AutoVu Plate Finder: <https://www.genetec.com/product-releases/plate-finder>
- Genetec mobile ALPR: <https://techdocs.genetec.com/r/en-US/Genetec-PatrollerTM-Administrator-Guide-7.0/About-AutoVu-mobile-ALPR>
- SafetyCulture/Mitti: <https://mitti.com/iauditor>
- Fulcrum mobile: <https://www.fulcrumapp.com/apps/mobile-data-collection-app/>
- Fulcrum field reporting: <https://www.fulcrumapp.com/apps/field-reporting-app/>
- GateX: <https://technomindlabs.com/products/gatex/>
- Odoo Gate Pass: <https://apps.odoo.com/apps/modules/19.0/gate_pass_management>
- QR Desk vehicle entry: <https://www.qrdesk.co/features/vehicle-entry-exit>
- Niyuk gate pass: <https://niyuk.ai/gatepass/>
- Vizitor gate pass: <https://www.vizitorapp.com/gate-pass-management-system/>

---

## 3. UI improvements

### 3.1 Gate-side speed — “the driver is waiting” mode

The benchmark products consistently reduce taps before identity and evidence.
NIC eChallan uses vehicle/document lookup, camera capture and print; T2 and
Genetec use plate/LPR-assisted lookup; inspection apps use barcode/QR and
guided forms.

**Recommended**

- **Recent vehicles / repeat entry** on the first screen, scoped to the current
  post and shift, with a short, privacy-aware history. One tap should prefill the
  known gate pass/driver/vehicle and retain the existing editable fields.
- **Scan instead of type**: QR/barcode scan for gate pass, vehicle pass or
  driver credential. Show “scan” next to the relevant field; do not replace
  manual fallback.
- **Camera plate guide** with a rectangular overlay, focus/exposure lock, and
  optional on-device plate OCR suggestion. Always show the raw photo and require
  the marshal to confirm/correct the OCR text.
- **Guided evidence set** rather than four anonymous photos: label/guide shots
  such as “vehicle & plate”, “violation context”, “document/other”. Keep the
  1–4 limit and the existing retake.
- **Photo annotation** (circle/arrow) and a **timestamp + GPS footer** rendered
  on the evidence image or stored alongside it. Fulcrum and NIC both use
  geo/time context; T2 explicitly records GPS breadcrumbs.
- **Capture quality feedback** before encoding: “too dark / too blurry / plate
  not detected” with a retake. Do not silently accept unreadable evidence.
- **Full-screen signature** mode in landscape, with a large stroke area and a
  clear “Confirm signature” separate from “Clear”.
- **Visible save/sync state** at the top: “Saved on this device”, “Sending…”,
  “Sent”, or a queued count. Gate staff should never wonder whether the
  challan exists.

### 3.2 Success receipt

Current success screen shows the number and details; competitors add a
transaction artifact.

**Recommended**

- **QR-coded receipt** containing a verification reference, not sensitive
  personal data. NIC’s receipt QR is used for later lookup/payment; for this
  pilot the QR should resolve to an authorised status page.
- **Print / PDF / share** action. The admin/desk can print a clean driver copy;
  the tablet can hand over a PDF where hardware allows.
- **Driver-facing plain-language copy**: what happens next, who to contact,
  appeal/refusal process, and how to quote the number.
- **Offline/queued receipt state** if offline issuance is ever approved: a
  clearly provisional receipt with a queue reference until the server confirms.
- **Next action** choices: “Create another”, “Print”, “Return to list” (where
  the role has a list).

### 3.3 Admin as a triage console

The benchmark tools emphasize queues, assignments, reports and audit, not just
CRUD tables.

**Recommended**

- **Global search/command palette**: challan number, vehicle, gate pass, driver,
  location, user. Keyboard shortcut (`/` or `Ctrl+K`) on desktop.
- **Saved views** and **active filter chips**: “My location — overdue”,
  “Critical issued today”, “Awaiting review > 24h”. Put filters and sort/page in
  the URL so a view is shareable and survives refresh.
- **Priority cards**, not only totals: “Overdue review”, “High severity today”,
  “Duplicate warnings”, “Draft/queued”, “Repeat offenders last 90 days”.
- **Triage queue actions**: assign reviewer, set due date/SLA, add comment,
  bulk export, next/previous record within the filtered queue.
- **Evidence-first detail**: large photo viewer with zoom, side-by-side
  photo/signature, metadata strip (time, source, hash), annotation notes,
  redaction, and “open full size”. The current viewer is a good start but still
  thumbnail-sized for disputes.
- **Context on status changes**: timeline with actor, time, action/reason,
  linked cancellation/replacement record, and a clear “immutable issued data”
  section.
- **User/master administration at scale**: search, active/inactive filters,
  pagination, last login, bulk deactivate, master import/export and a safe
  reactivation policy.

### 3.4 Layout and visual system

Current post-remediation UI already has coherent theme/tokens, focus, contrast
and responsive card tables. Next refinements are mostly density and context:

- Sticky table header and sticky first/action column; optional density toggle.
- Filter bar as a compact popover or a collapsible panel at desktop widths too;
  do not let ten filters push the table fully below the fold.
- Keep primary actions visible (sticky detail footer); avoid long evidence
  dialogs with only “Close” at the bottom.
- Add a visible “network/queue” indicator in the tablet app bar.
- Use quiet, consistent icons for status transitions, but keep the existing
  icon-plus-text rule; never rely on colour alone.
- Add a “field mode” high-contrast setting and 200% zoom testing on a real
  tablet.
- Add Hindi/Gujarati/Marathi copy for the driver-facing receipt and critical
  field labels; keep the interface language selectable and consistent. NIC’s
  current app is English/Hindi; state-language support is a known gap.

### 3.5 Onboarding and recovery

- First-use hint card for scanner/camera permission and what to do if camera
  fails; no modal tour that blocks the driver.
- “What happens if I lose connectivity?” help text and a visible draft/queue
  state.
- Inline field help for gate pass format, vehicle registration and refusal
  witness requirements.
- Keyboard shortcuts help for Admin (search, next/previous, close, export).
- Empty states always offer a next action; the current Users and filtered
  Challans states now do this.

---

## 4. Functionality improvements

### 4.1 Highest-value, near-term

| Capability | Why it matters | Notes |
|---|---|---|
| QR/barcode scan for gate pass/vehicle | Removes typing errors and seconds per entry | Manual fallback stays mandatory; scanning a pass must still resolve the same server-side registry. |
| Recent-vehicle shortcuts | Repeat traffic at a gate is common | Scope by post/shift; do not leak another location’s data. |
| Plate OCR suggestion | Faster lookup for poor/obstructed passes | Show image plus OCR; require marshal confirmation; server remains validation authority. |
| Evidence annotations + geo/time metadata | Dispute defensibility and reviewer context | Store original bytes plus annotation sidecar; never overwrite the original. |
| Printable/QR receipt | Driver needs proof; duty desk needs a record | QR should resolve to an authorised reference, not public PII. |
| Admin global search/saved views | The current table is good for 14 rows, not 10,000 | Put filters/page/sort in URL; add “needs attention” views. |
| Evidence zoom/compare/redaction | Reviewer cannot decide from thumbnails | Add full-size viewer; log each view. |
| User/master search and bulk operations | Admin scale | Add last login, role/status filters, bulk deactivation; keep deactivation history. |

### 4.2 Workflow and compliance

- **Device/installation identity**: register and attest the tablet/browser
  installation used for issuance; display device ID/session and allow Admin
  revocation. This supports evidence integrity and mirrors regulated enforcement
  expectations.
- **Tamper-evident evidence certificate**: store SHA-256 of each evidence file,
  capture time, location (if approved), uploader, and audit access. A print/export
  should include a concise evidence manifest, not just the image.
- **Supervisor review queue**: assignment, due date/SLA, comments, “return for
  correction” (without editing issued fields), and escalation. The status
  transitions alone are not a complete review workflow.
- **Cancellation/replacement linkage**: the current cancellation is correct and
  terminal; add a clearly linked replacement record for P1 E3.6.
- **Repeat offender/watchlist panel**: occurrence history, prior actions,
  prescribed next action, and (where legally approved) a watchlist/hotlist for
  security. Do not invent an escalation matrix; use the approved D5 tiers.
- **Notifications**: driver SMS/email/WhatsApp status link (privacy-scoped),
  supervisor review alerts, SLA reminders, failed-export alerts. Gate-pass
  vendors treat notification as part of the record, not an add-on.
- **Audit export**: filter by actor/action/challan/time and download an
  append-only extract; show evidence access events, not just status changes.

> **Legal caution if the scope expands beyond plant safety:** an Indian court
> judgment reported in May 2026 quashed e-challans issued through personal
> smartphones, emphasizing officially authenticated devices, clear photo/plate
> evidence, date/time/place, the provision alleged and an evidence certificate
> under the then-applicable evidence law. This pilot is an internal gate-safety
> record, not statutory traffic enforcement, but the same instinct applies:
> device identity, evidence manifests and tamper-evident audit are worth
> designing before any external legal use. Source:
> <https://www.livelaw.in/news-updates/jammu-and-kashmir-srinagar-court-stick-to-electronic-enforcement-devices-only-e-challan-issued-through-personal-mobile-phone-of-police-officer-is-procedurally-defective-and-legally-infirm-533554>

### 4.3 Data quality and integrations

- Fuzzy duplicate search for drivers/vehicles/gate passes; merge/alias tooling
  should preserve history and never merge silently.
- Master-data import/export with validation preview, effective dates and an
  “Other” promotion workflow.
- Registry refresh/expiry status surfaced beside the vehicle; expired gate pass
  should remain visible and explicitly blocked/overridden by policy.
- HR/contractor/ERP/visit-management imports later; Vahan/Sarathi only if the
  pilot scope changes and the integration is approved. The current synthetic
  registry is the correct demo boundary.
- Excel/CSV/PDF templates for operations; keep the existing XLSX export and add
  a print-ready driver copy.

### 4.4 Offline and field resilience (P2 / D1 decision)

Competitors treat offline as a product mode: local queue, automatic sync,
conflict handling, local evidence, and clear status. For this pilot:

- Keep offline issuance **P2 until D1 is resolved**.
- If approved, implement an explicit local queue with:
  - operation IDs (already present), local draft/evidence store, background sync;
  - visible “queued on device” vs “issued by server” states;
  - conflict resolution for stale occurrence/duplicate/repeat data;
  - storage quota, failed-sync retry, and shift-end reconciliation;
  - no claim of a server number until confirmation.
- Add a network-quality indicator and a last-sync timestamp even while online;
  this sets honest expectations without pretending full offline support.

### 4.5 Security and account lifecycle

- MFA for Admin/Supervisor, SSO later; account lockout/rate limits; self-service
  password reset for non-demo users.
- Session/device list with revoke, last-seen time and idle/absolute expiry
  visibility; current Admin reset already revokes sessions.
- Password policy beyond length, breached-password check, and secure invitation
  flow for created users.
- CSP/security headers, evidence URL expiry/signing, malware scanning for uploads,
  EXIF/privacy policy, and audit-log immutability enforcement at DB privilege
  level. The current local disk adapter is a pilot boundary, not a hardened
  evidence service.

---

## 5. What not to copy yet

| Competitor pattern | Why not now |
|---|---|
| On-the-spot payments / UPI / wallets | This product records violations; payment and penalty collection are explicitly outside the PRD. |
| Vahan/Sarathi/ITMS/ANPR integrations | Production registry/integration source is open (B-06); only the synthetic registry is in demo scope. |
| Fixed CCTV / speed-gun / virtual court flows | Different enforcement model and legal authority. |
| Hotlists / person watchlists | Requires a legal basis, governance and retention policy; do not add as a casual “feature”. |
| Thermal printers and rugged handheld hardware | Useful later, but needs device procurement and field acceptance; QR/PDF receipt is a cheaper first step. |
| A giant “everything” dashboard | The current pilot benefits more from a focused “needs attention” queue than from charts and vanity totals. |

---

## 6. Suggested sequence

1. **Quick wins (1–2 iterations):** QR/PDF receipt, recent vehicles, scan gate
   pass/barcode, saved Admin views and filter URLs, evidence zoom + metadata,
   user/master search, sticky table header.
2. **Field quality:** annotated evidence, plate guide/OCR suggestion, geo/time
   evidence context, network/queue indicator, multilingual driver copy.
3. **Review operations:** assignment/SLA/comments, evidence manifest/hash,
   cancellation-replacement link, audit export, repeat-offender panel.
4. **Decisions/integrations:** offline queue (D1), Vahan/Sarathi, ANPR/ITMS,
   notifications, SSO/MFA, thermal printing.
5. **Device acceptance:** real tablet, gloves, sunlight, rotation, 200% zoom,
   camera permission, trusted HTTPS and battery/network scenarios.

---

## 7. Bottom line

The current UI is coherent and operationally sensible. The benchmark gap is
mostly **speed at the gate** and **decision support at the desk**, not missing
visual polish. The highest-return additions are a QR/print receipt, assisted
entry (scan/recent/OCR), a proper evidence review surface, and an Admin triage
queue. Offline sync, external registries, payments and ANPR are strategically
important but should remain behind explicit product/legal decisions.

---

## 8. Selected improvements — implementation status (2026-10-22)

Implemented the user-selected set from this benchmark:

- **Recent vehicles at the gate** — marshal-only `GET /registry/recent`, scoped to the
  signed-in post, last five non-cancelled vehicles, with one-tap form filling.
- **Admin triage** — global search, saved views, “Needs attention” queue, active
  filter chips, sticky table header, and Previous/Next review navigation. The
  report route now keeps filters while a detail record is open.
- **Evidence zoom** — photo/signature preview dialog with 25% zoom steps and reset.
- **Network and draft status** — honest online/draft/sending/sent/error strip;
  offline issuance is still not claimed or implemented.
- **High-contrast mode and multilingual driver copy** — local outdoor-mode theme,
  plus English/Hindi/Gujarati driver summary and receipt copy with a language
  selector. This is driver-facing copy, not full application localization.
- **User and master search/filters/bulk actions** — searchable user and master
  lists, status/role filters, selection, and confirmed bulk deactivation
  (user bulk reactivation is also available).

Verification and limitations are recorded in
`docs/handoffs/selected-improvements.md`. Screenshots:
`docs/audits/evidence/2026-10-22/`.
