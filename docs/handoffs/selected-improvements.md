# Selected benchmark improvements

**Date:** 2026-10-22  
**Scope:** Implement improvements 2, 6, 7 (evidence zoom), 8, 9 and 10 selected
from `docs/audits/2026-10-22-similar-apps-benchmark.md`.  
**Feature context:** Post-audit pilot enhancement set; no new business decision was
introduced. Offline issuance remains P2 and unimplemented.

## Delivered

### 1. Recent vehicles at the gate

- Added marshal-only `GET /registry/recent`, scoped to the authenticated post.
- Returns the latest five distinct vehicles issued at that post, excluding
  cancelled challans.
- Tablet form shows “Recent at this post” shortcuts that fill registry-sourced
  vehicle, driver, department, contractor and vehicle-type fields.
- Covered by `apps/api/tests/integration/recent-vehicles.test.ts`.

### 2. Admin triage

- Global search across challan number, vehicle, gate pass, driver and location.
- Server-side search support in the report query; unit integration coverage added.
- Saved views persisted in browser localStorage
  (`echallan.admin.report-views.v1`).
- “Needs attention” preset (`Under Review`, oldest issued first) and active filter
  chips.
- Sticky table header, gate-pass context in vehicle cells, and Previous/Next
  review navigation.
- `/challans/:challanId?` now uses one route element so opening a record preserves
  the current filters and order.

### 3. Evidence zoom

- Evidence photos and driver signature open in a nested preview dialog.
- Zoom out, reset (percentage button) and zoom in in 25% steps up to 400%.

### 4. Network and draft status

- Slim status strip reports online state and current draft/commit state:
  idle, saved, sending, sent or error.
- Offline copy says the draft is kept on the device and issuance needs a
  connection; it never claims an offline queue exists.

### 5. High contrast and multilingual driver copy

- Outdoor/high-contrast theme preference persisted in browser localStorage.
- Driver summary and receipt copy available in English, Hindi and Gujarati.
- Receipt has a driver-language selector; severity and status labels localize.
- Noto Devanagari/Gujarati fallback names added to the shared font stack.
- This is driver-facing copy, not full application localization.

### 6. User and master search, filters and bulk actions

- Users: search, role filter, active/inactive filter, row/card selection,
  select-all, confirmed bulk deactivate and bulk reactivate.
- Masters: search, active/inactive filter, row/card selection, select-all and
  confirmed bulk deactivation.
- Master deletion remains a deactivation with historical snapshots retained.

## Verification

Commands run from the repository root:

| Gate | Result |
|---|---|
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS; 176 files scanned, no boundary violations |
| `pnpm typecheck` | PASS, including e2e TypeScript |
| `pnpm test` | PASS: contracts 68, admin 27, API unit 104, tablet 88 |
| `pnpm test:integration` | PASS: 143 tests in 15 files |
| `pnpm build` | PASS |
| `pnpm check:tablet-size` | PASS: 177,707 B gzip initial JS (limit 250,000 B) |
| `pnpm test:foundation` | PASS: 27 tests |
| `pnpm test:e2e` | PASS: 78 Playwright tests |

Manual Chromium checks against the real API proxy:

- Tablet: recent-vehicle shortcut, filled driver details, saved-draft status,
  high-contrast canvas, offline status copy, Hindi summary, Hindi receipt and
  receipt language selector.
- Admin: report search, search chip, saved view persistence, Needs attention,
  detail opening with preserved order, Previous navigation, evidence preview at
  125%, user search/select-all, master search/bulk confirmation.

Evidence screenshots:

- `docs/audits/evidence/2026-10-22/tablet/recent-hindi-highcontrast-receipt-1366x768.png`
- `docs/audits/evidence/2026-10-22/admin/evidence-zoom-1366x900.png`
- `docs/audits/evidence/2026-10-22/admin/master-search-bulk-1366x900.png`

## Known limits and pending evidence

- Bulk deactivation is a client-side sequence of individual API calls. A failure
  can leave a partially applied selection; the UI reports the failure and reloads
  on success but there is no server-side transaction for the whole batch.
- Master entries cannot be reactivated in this pilot; users can be reactivated.
- Saved views are browser-local, not shared across admins or devices.
- Offline issuance, queueing and background sync remain out of scope (D1/P2).
- High-contrast and Hindi/Gujarati rendering still need real-tablet acceptance,
  including installed-font availability, sunlight/contrast, rotated layout and
  200% zoom. Browser checks used a fake camera and synthetic evidence.
- Real rear-camera capture, signature feel and trusted-HTTPS device testing remain
  pending.

## Review request

Changes are ready for independent review. No files were committed; this
repository has no Git metadata.
