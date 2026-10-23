# Safety Violation e-Challan — Product Requirements Document

**Version:** 1.0
**Companion document:** Functional Specification v0.2 (authoritative for business rules, data fields and open decisions)
**Scope of this PRD:** Pilot release

---

## 1. Problem

Traffic Marshals at DMD gates record safety violations on paper. The consequences compound:

- A challan exists as one piece of paper. Lose it and the violation never happened.
- Evidence lives separately from the record, if it exists at all. A disputed challan comes down to recollection.
- Producing a monthly summary means someone physically sorting a stack of forms.
- Nobody can answer "has this driver done this before?" at the moment it matters — at the gate, with the driver present.

The last point is the real cost. A violation system that cannot identify repeat offenders is a record-keeping exercise, not a safety intervention.

## 2. Goals

**Primary.** Every violation at pilot gates issued digitally, with photo evidence and a signature, and retrievable in seconds.

**Secondary.** Make repeat violations visible to the marshal at the point of issue, so escalation happens by rule rather than by memory.

**Non-goal.** This is not an enforcement or penalty-collection system. It records violations and the action taken. Penalties, if any, remain an HR and contractor-management process outside this product.

### Success metrics (12-week pilot)

| Metric | Target | Measured by |
|---|---|---|
| Violations issued digitally at pilot gates | 100% | Paper challan book unused |
| Median time to issue a challan | Under 3 minutes | Server timestamps, draft start to submit |
| Records lost or unrecoverable | 0 | Reconciliation against marshal shift logs |
| Time to produce the monthly report | Under 15 minutes | Compared against current effort |
| Repeat offenders correctly flagged at issue | Above 90% | Audit sample of 50 challans |

A pilot that hits the first four and misses the fifth has built a filing system. The fifth is the one that justifies the project.

## 3. Users

**Ravi — Traffic Marshal.** Standing at a gate, outdoors, often in strong sunlight. Possibly gloved. A driver is waiting and may be annoyed. He has a tablet, moderate comfort with smartphones, and no patience for a form that fights him. He needs to complete a challan in under three minutes without looking anything up.

**Sunil — Shift In-charge.** Reviews the shift's challans, records what action was taken, closes them. Works from a desk, on a laptop. Needs to see what is outstanding and what is overdue.

**Meera — Security Admin.** Owns the numbers. Needs filters, trends, the repeat-offender list, and an Excel file she can attach to a monthly report without reformatting it.

## 4. Requirements

Requirements are grouped by epic. Each carries a priority: **P0** ships in the pilot, **P1** ships if time allows, **P2** is Phase 2.

### E1 — Authentication and session

| ID | Requirement | Priority |
|---|---|---|
| E1.1 | User logs in with username and password; role determines the interface loaded | P0 |
| E1.2 | Tablet sessions are per-shift, not per-person; tablets belong to posts | P0 |
| E1.3 | Session expires after 10 minutes idle on the tablet, immediately returning to login | P0 |
| E1.4 | Admin creates, disables and resets users; no self-registration | P0 |
| E1.5 | Passwords stored using a modern password hash; never recoverable, only resettable | P0 |
| E1.6 | SSO against corporate identity | P2 |

### E2 — Issue a challan

| ID | Requirement | Priority |
|---|---|---|
| E2.1 | Marshal creates a challan through a stepped flow, one task per screen | P0 |
| E2.2 | Vehicle number input auto-uppercases, strips spaces, validates Indian registration format | P0 |
| E2.3 | Vehicle number, gate pass number and driver name offer autocomplete from prior records after 3 characters | P0 |
| E2.4 | Selecting a suggestion fills known fields, all of which remain editable | P0 |
| E2.5 | Department, vehicle type, violation type and location are selected from master lists, never typed | P0 |
| E2.6 | Selecting "Other" for any controlled field makes the remark mandatory | P0 |
| E2.7 | Violation type is multi-select; severity is derived from the master and is not editable by the marshal | P0 |
| E2.8 | Between 1 and 4 photos captured from the device camera; gallery upload is not offered | P0 |
| E2.9 | Photos are resized and compressed on-device to approximately 300 KB before upload | P0 |
| E2.10 | Marshal can review and delete a photo before submitting | P0 |
| E2.11 | If the gate pass number matches prior challans within 90 days, the occurrence number and prescribed action are shown before submission | P0 |
| E2.12 | Driver is shown a plain-language summary of the violation before the signature screen | P0 |
| E2.13 | Driver signs on a full-width canvas; signature can be cleared and redrawn | P0 |
| E2.14 | If the driver refuses to sign, marshal records a reason and a witnessing supervisor's name and ID, both mandatory | P0 |
| E2.15 | Submission is blocked unless at least one photo exists and either a signature or a recorded refusal exists | P0 |
| E2.16 | On submission the server assigns the challan number and returns it for display | P0 |
| E2.17 | If the same vehicle number was challaned at the same location within 15 minutes, a warning appears which the marshal can acknowledge and proceed past | P0 |
| E2.18 | A draft survives app backgrounding or accidental navigation and can be resumed | P1 |
| E2.19 | Challan can be created without connectivity and synced later | P2 — blocked on D1 |

### E3 — Review and close

| ID | Requirement | Priority |
|---|---|---|
| E3.1 | Supervisor sees all challans for their location, filterable by status | P0 |
| E3.2 | Supervisor opens a challan and views all fields, photos and signature | P0 |
| E3.3 | Supervisor moves a challan to Under Review and then to Resolved, recording the action taken and who performed it | P0 |
| E3.4 | Issued challans cannot be edited by anyone, in any role | P0 |
| E3.5 | Cancellation requires a reason and Admin approval; the record is retained, never deleted | P0 |
| E3.6 | A cancelled challan and its replacement are linked and both visible | P1 |

### E4 — Dashboard and reporting

| ID | Requirement | Priority |
|---|---|---|
| E4.1 | Summary tiles: total, issued today, pending, resolved, repeat offenders in the last 90 days | P0 |
| E4.2 | Filters: date range, location, violation type, severity, status, department, vehicle number, gate pass number, issuing marshal | P0 |
| E4.3 | Results table is sortable and paginated, and opens a challan detail view | P0 |
| E4.4 | Excel export of the current filtered set, with every field except image binaries | P0 |
| E4.5 | Each export is logged with user, timestamp, filters applied and row count | P0 |
| E4.6 | Violation-type breakdown and month-on-month trend charts | P1 |
| E4.7 | Repeat-offender list with occurrence counts and prescribed next action | P1 |
| E4.8 | Near-duplicate driver records surfaced with a merge action | P1 |
| E4.9 | Scheduled monthly summary emailed to Security HOD | P2 |

### E5 — Master data

| ID | Requirement | Priority |
|---|---|---|
| E5.1 | Admin manages violation types with severity and default action | P0 |
| E5.2 | Admin manages departments and contractors, locations and gates, vehicle types | P0 |
| E5.3 | Master entries are deactivated, never deleted, so historical challans keep their meaning | P0 |
| E5.4 | Admin reviews entries recorded as "Other" and promotes recurring ones into the master | P1 |

### E6 — Audit

| ID | Requirement | Priority |
|---|---|---|
| E6.1 | Every create, status change, cancellation, evidence view and export is logged with user, timestamp and source | P0 |
| E6.2 | The audit log is append-only and not editable through the application | P0 |
| E6.3 | Admin can view the audit trail for an individual challan | P1 |

## 5. Technical Design

### 5.1 Stack

| Layer | Choice | Reasoning |
|---|---|---|
| API | Node 22 LTS, Fastify, TypeScript | Small, fast, minimal middleware overhead; the API is mostly CRUD with rules |
| ORM | Drizzle | Generates SQL close to what you would write; no heavy runtime, migrations are plain SQL files |
| Database | PostgreSQL 16 | Relational data with real constraints; audit log and filtering both want SQL |
| Validation | Zod, shared between client and server | One schema definition, two consumers — validation cannot drift |
| Frontend | React 18, Vite, TypeScript | Fast builds, small output, no server-rendering requirement |
| UI | MUI v9 | Client preference; mature accessibility, strong form components |
| Server state | TanStack Query | Caching, retry and stale handling without hand-rolled state |
| Routing | React Router | Sufficient; no framework router needed |
| Signature | `signature_pad` | Around 10 KB, handles touch and pointer events and high-DPI scaling correctly |
| Image compression | Canvas API, no library | Resize and re-encode in a dozen lines; avoids a dependency |
| Excel | ExcelJS, server-side | Export must respect server-side filters and be logged; generating client-side bypasses both |
| Auth | JWT access token plus refresh token, Argon2id password hashing | Stateless API, no session store to run |
| Reverse proxy | Caddy | Automatic TLS, which the camera API requires |
| Deployment | Docker Compose | One command to stand up; matches a single-VM target |

### 5.2 Repository structure

A single repository with pnpm workspaces. Module boundaries are preserved as packages; they simply are not spread across separate repositories.

```
echallan/
├── apps/
│   ├── api/          Fastify service, Drizzle migrations, storage
│   │                 adapters, Excel generation, seed scripts
│   ├── tablet/       Marshal PWA. Curated MUI subset, strict budget
│   └── admin/        Dashboard SPA. Full MUI, data grid, charts
├── packages/
│   ├── contracts/    Zod schemas, TypeScript types, shared enums
│   └── theme/        MUI theme factory and design tokens
├── deploy/
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── .env.example
├── pnpm-workspace.yaml
└── package.json
```

`contracts` is consumed as `workspace:*`, so there is no publishing step and no version pinning to keep in sync. A change to a schema and both of its consumers lands in one commit, and CI type-checks the whole graph against it — which is the main reason to prefer this arrangement at pilot scale.

**One repository does not mean one deployable.** The build still produces three independent artifacts: an API container, and two static bundles. The tablet's weight budget in Section 5.4 is per-application and is unaffected by this change.

Two disciplines keep the boundaries real rather than nominal:

- **No cross-boundary imports.** Apps import from `packages/`, never from each other or from another app's internals. Enforce with an ESLint restricted-paths rule so it fails in CI rather than in review.
- **Scoped CI.** Run only the affected workspace's tests and builds on a given change. Without this, every one-line change runs the full pipeline and people start skipping it.

Turborepo is worth adding if build times become annoying, but pnpm workspaces alone are sufficient for three applications. Do not add it on day one.

The API stays a standalone Fastify service rather than collapsing into API routes inside one of the frontends. Both clients consume it, and a plain HTTP service is considerably easier to hand over to Reliance IT at rollout than a framework application with server-side routing baked in.

### 5.3 Storage

Images are written through a `StorageAdapter` interface with two implementations: `LocalDiskAdapter` for the pilot and `S3Adapter` for later. The database stores object keys only.

Evidence is served through an authenticated API route, never a public URL, so every view is authorised and logged.

### 5.4 Weight budget

The tablet application is the constraint. It loads on modest hardware over plant Wi-Fi, possibly several times a shift.

| Budget | Target |
|---|---|
| Initial JS, gzipped | Under 250 KB |
| Time to interactive on mid-range tablet | Under 3 seconds |
| Challan submit, excluding upload | Under 1 second |
| Photo upload per image | Under 3 seconds on plant Wi-Fi |

MUI works against this, so the rules are not optional:

- Import from exact paths — `@mui/material/Button`, never `from '@mui/material'`. Barrel imports defeat tree-shaking and pull the entire library.
- Same for icons: `@mui/icons-material/Camera`, never the barrel.
- No data grid, charts or date pickers in the tablet app. Those belong to the admin bundle only.
- Code-split by route.
- Enforce the budget in CI with `rollup-plugin-visualizer` or `size-limit`. A budget nobody measures is a wish.

If the tablet bundle cannot be brought under budget, the fallback is to drop MUI from the tablet app specifically and build its handful of screens with plain components against the same design tokens. The admin dashboard keeps MUI regardless — that is where its form and table components genuinely earn their weight.

## 6. Release Plan

| Milestone | Contents |
|---|---|
| M1 — Demo | Seeded data, tablet flow end to end, dashboard with filters and export. Synthetic data only |
| M2 — Pilot build | All P0 requirements, audit log, master data admin, backup and tested restore |
| M3 — Pilot | One or two gates, 12 weeks, metrics from Section 2 collected weekly |
| M4 — Review | Decide on offline (D1), integration, and plant-wide rollout |

## 7. Risks

| Risk | Mitigation |
|---|---|
| Typed gate pass numbers are inconsistent, breaking repeat tracking | Autocomplete, format validation, near-duplicate merge tooling, weekly data-quality review during the pilot |
| Marshals revert to paper under time pressure | Measure issue time from day one; if it exceeds 3 minutes, cut fields rather than train harder |
| Drivers routinely refuse to sign | Track refusal rate as a pilot metric; a high rate is a process and communication problem, not a product one |
| Tablet unusable in direct sunlight | Test on the actual device at the actual gate before M2, not in an office |
| Single host failure stops issuance entirely | Documented paper fallback for the pilot; redundancy required before rollout |
| "Resolved" never gets defined, so status data is meaningless | Blocking decision D3 — build does not start without it |

## 8. Dependencies on Open Decisions

D1 (offline), D3 (definition of Resolved), D5 (escalation matrix) and D8 (hosting and ownership) all block parts of the pilot build. D3 and D5 block the most, because E2.11 and E3.3 cannot be specified without them. See Functional Specification v0.2, Section 11.
