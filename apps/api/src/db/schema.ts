import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * FOUNDATION HARNESS TABLE - NOT AN APPROVED PRODUCTION DOMAIN SCHEMA.
 *
 * S-01 only proves that migrations, the guarded test database and JSONB
 * round-tripping work. The single table below exists purely so a synthetic demo
 * payload (`docs/demo-data.json`, see `docs/demo-data.md`) has somewhere to live.
 *
 * It deliberately models nothing from the PRD: no challan, driver, vehicle,
 * staff, gate, master, evidence, audit or status concepts are defined or implied
 * here, and no business rule, status value, severity or escalation behaviour is
 * invented. The approved domain schema arrives with the F-01 contracts and the
 * decisions recorded in `docs/decisions.md`; this table will be replaced, not
 * extended into, that schema.
 *
 * Columns map 1:1 to the S-01 task requirement
 * (id text primary key, source text, payload jsonb, loaded_at timestamptz).
 */
export const foundationDemoFixture = pgTable('foundation_demo_fixture', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  payload: jsonb('payload').notNull(),
  loadedAt: timestamp('loaded_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ========================================================================== */
/* F-01 APPROVED DEMO DOMAIN SCHEMA                                            */
/* ========================================================================== */

/**
 * Authority: `docs/eChallan_replacement_spec.md` v0.1 (owner-approved
 * 2026-10-02), as recorded in `docs/decisions.md`. This is the SYNTHETIC DEMO
 * domain, not an approved production schema; production gate-pass sourcing,
 * hosting and real-device acceptance remain later gates.
 *
 * Field dictionary and relationship decisions (spec section 4/6/7):
 *
 *  - **Identity.** Every table uses an opaque UUID primary key, independent of
 *    any display number. `demo_source_id` preserves the synthetic fixture's own
 *    identifier for traceability; fixture IDs are never treated as approved
 *    UUIDs. Seeded UUIDs are derived deterministically from `demo_source_id`
 *    so a repeated seed never changes a row identity.
 *  - **Timestamps.** Server-observed instants are stored as `timestamptz` (UTC
 *    instants). Site-day boundaries, the 90-day window and the 15-minute window
 *    are evaluated in `Asia/Kolkata`. PostgreSQL preserves the instant; it does
 *    not preserve the original textual offset, and nothing here claims it does.
 *  - **Attribution (B-04).** A challan records the issuing user, the post,
 *    the shift, the gate and the location as separate columns so post/shift/
 *    session attribution is auditable rather than inferred. Roles live on
 *    `users`; the API authorises them. Marshals issue only at authorised posts.
 *  - **Masters (B-05).** Issued rows keep *both* the master reference (for
 *    provenance) and immutable snapshots of the label, severity and default
 *    action. Later master edits or deactivation therefore cannot change the
 *    meaning of an issued record. A reference to a mutable master alone would
 *    be insufficient.
 *  - **Deletion.** Every foreign key onto a master or identity table is
 *    NO ACTION/RESTRICT, so deleting a master is refused rather than cascading
 *    away historical challans. Only pure child rows (violation selections,
 *    evidence references, signatures, refusals, action history and audit events)
 *    cascade with their challan.
 *  - **Registry (B-06).** `gate_pass_records` holds the synthetic local
 *    registry. One registry pass has one unique normalised pass number and one
 *    driver/vehicle association; several pass records may share a vehicle or a
 *    driver. `gate_pass_locations` records which locations may see a pass. The
 *    actual issuance location always comes from the authorised post and is never
 *    copied from the pass.
 *  - **Evidence.** `evidence` stores object *references* only. The synthetic
 *    fixture's photo counts and signature states are display metadata, so the
 *    seed adapter does not manufacture rows for them; real captured blobs arrive
 *    through the validated media flow in I-02-I-06 with their byte budgets.
 *  - **Audit.** `audit_events` records creation, status change, cancellation,
 *    reopening, evidence view and export events. Its append-only *enforcement* is
 *    not in place at F-01; see the table comment for the exact boundary.
 *
 * Nothing in this schema encodes an unapproved business rule: severity
 * derivation, occurrence counting, the recommendation tiers, numbering and
 * transition legality are pure helpers or later services, not database
 * conveniences.
 */

/** Approved severity vocabulary (spec section 5). */
export const SEVERITY_VALUES = ['Minor', 'Major', 'Critical'] as const;
/** Approved challan status vocabulary (spec section 6). */
export const CHALLAN_STATUS_VALUES = ['Issued', 'Under Review', 'Resolved', 'Cancelled'] as const;
/** Approved role vocabulary (spec section 8). */
export const ROLE_VALUES = ['Marshal', 'Supervisor', 'Admin'] as const;
/** Approved resolution action codes (spec section 6). */
export const RESOLUTION_ACTION_VALUES = [
  'warning_issued',
  'safety_counselling_completed',
  'referred_to_department_contractor',
  'custom',
] as const;

/** Staff accounts. Admin-created only; no self-registration (E1.4). */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    username: text('username').notNull(),
    /** Role is a controlled vocabulary; there is no free-text role. */
    role: text('role').notNull().$type<(typeof ROLE_VALUES)[number]>(),
    displayName: text('display_name').notNull(),
    employeeId: text('employee_id'),
    /** Deactivation replaces deletion (E5.3). */
    isActive: boolean('is_active').notNull().default(true),
    /**
     * Argon2id hash set by an Admin reset (PRD E1.5). Null keeps the F-02
     * env-backed demo credential for that account; a non-null hash takes
     * precedence at sign-in. No cleartext password is ever stored here.
     */
    passwordHash: text('password_hash'),
    demoSourceId: text('demo_source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('users_username_unique').on(table.username),
    check('users_role_check', sql`${table.role} IN ('Marshal','Supervisor','Admin')`),
  ],
);

/**
 * Master: deactivation indicator rather than deletion.
 *
 * The label column is a **literal** key, not a computed one: a computed key makes
 * TypeScript treat every column access as possibly `undefined`, which defeats the
 * typed query builder for F-03's master service. The SQL is unchanged — the column
 * is always named `label`.
 */
function masterTable(name: string) {
  return pgTable(
    name,
    {
      id: uuid('id').primaryKey(),
      label: text('label').notNull(),
      isActive: boolean('is_active').notNull().default(true),
      demoSourceId: text('demo_source_id'),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index(`${name}_active_idx`).on(table.isActive)],
  );
}

export const locations = masterTable('locations');
export const departments = masterTable('departments');
export const contractors = masterTable('contractors');
export const vehicleTypes = masterTable('vehicle_types');

export const gates = pgTable(
  'gates',
  {
    id: uuid('id').primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    label: text('label').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    demoSourceId: text('demo_source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Composite target for the post->gate->location consistency constraint below, so
    // "a post and its gate sit at the same location" is DB-owned rather than a
    // convention the API must remember to check.
    unique('gates_id_location_id_unique').on(table.id, table.locationId),
  ],
);

/**
 * A tablet post belongs to a location and is where a marshal may issue.
 *
 * The approved model resolves the actual issuance location and gate from the
 * authorised post (replacement specification section 4), so the post holds the
 * authoritative gate reference rather than relying on location matching. `gateId`
 * is backfilled by corrective migration 0003 from the unambiguous gate at the
 * post's location, and migration 0004 then makes it NOT NULL.
 *
 * Approved cardinality: each post resolves exactly one gate, and **several posts may
 * serve the same gate** (two tablets at one gate). The approved specification
 * constrains post -> gate only; it says nothing about how many posts a gate may
 * serve, so an earlier UNIQUE(gate_id) constraint was an unapproved extra
 * restriction and corrective migration 0005 removes it.
 */
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    gateId: uuid('gate_id')
      .notNull()
      .references(() => gates.id),
    label: text('label').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    demoSourceId: text('demo_source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Composite target proving a challan's post and gate agree.
    unique('posts_id_gate_id_unique').on(table.id, table.gateId),
    foreignKey({
      columns: [table.gateId, table.locationId],
      foreignColumns: [gates.id, gates.locationId],
      name: 'posts_gate_location_fk',
    }),
  ],
);

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey(),
  gateId: uuid('gate_id')
    .notNull()
    .references(() => gates.id),
  label: text('label').notNull(),
  /** Named individual attribution; per-shift tablet use does not replace it. */
  marshalUserId: uuid('marshal_user_id')
    .notNull()
    .references(() => users.id),
  supervisorUserId: uuid('supervisor_user_id')
    .notNull()
    .references(() => users.id),
  isActive: boolean('is_active').notNull().default(true),
  demoSourceId: text('demo_source_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Which locations a user may see and act across (spec section 8). */
export const userLocations = pgTable(
  'user_locations',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
  },
  (table) => [primaryKey({ columns: [table.userId, table.locationId] })],
);

export const violationTypes = pgTable(
  'violation_types',
  {
    id: uuid('id').primaryKey(),
    label: text('label').notNull(),
    /** One master severity per violation type (spec section 4/5). */
    severity: text('severity').notNull().$type<(typeof SEVERITY_VALUES)[number]>(),
    /** Master default action stays a separate reference from the issuance recommendation. */
    defaultAction: text('default_action').$type<(typeof RESOLUTION_ACTION_VALUES)[number]>(),
    isActive: boolean('is_active').notNull().default(true),
    demoSourceId: text('demo_source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A selectable master always has an approved severity: NULL is not a member of
    // Minor/Major/Critical and no "Unknown" severity is invented for this demo.
    check('violation_types_severity_check', sql`${table.severity} IN ('Minor','Major','Critical')`),
  ],
);

/** Driver names are deliberately not unique: two people may share a name. */
export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    gatePassNumber: text('gate_pass_number'),
    demoSourceId: text('demo_source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('drivers_name_idx').on(table.name)],
);

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey(),
    /** Normalised uppercase registration; unique across the demo site. */
    registrationNumber: text('registration_number').notNull(),
    vehicleTypeId: uuid('vehicle_type_id').references(() => vehicleTypes.id),
    demoSourceId: text('demo_source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('vehicles_registration_number_unique').on(table.registrationNumber),
    // The stored registration must already be canonical: uppercase with all
    // whitespace removed. Combined with the unique constraint this makes identity
    // unique by canonical value, not by raw text, so a case/whitespace variant can
    // never create a second logical vehicle.
    check(
      'vehicles_registration_canonical_check',
      sql`${table.registrationNumber} = upper(regexp_replace(${table.registrationNumber}, '\\s', '', 'g'))`,
    ),
  ],
);

export const gatePassRecords = pgTable(
  'gate_pass_records',
  {
    id: uuid('id').primaryKey(),
    /** One registry pass has one unique normalised pass number. */
    gatePassNumber: text('gate_pass_number').notNull(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.id),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    departmentId: uuid('department_id').references(() => departments.id),
    contractorId: uuid('contractor_id').references(() => contractors.id),
    /** Registry validity window; an expired pass may still be displayed/used with a notice. */
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    /** Display status of the synthetic registry record, not an issuance rule. */
    registryStatus: text('registry_status').notNull().default('Active'),
    demoSourceId: text('demo_source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('gate_pass_records_gate_pass_number_unique').on(table.gatePassNumber),
    // Canonical gate-pass form: uppercase, trimmed, and with no internal
    // whitespace. Internal whitespace is *invalid* under the approved rule rather
    // than silently stripped, so it is refused instead of normalised away.
    check(
      'gate_pass_records_canonical_check',
      sql`${table.gatePassNumber} = upper(${table.gatePassNumber}) AND ${table.gatePassNumber} !~ '\\s'`,
    ),
    index('gate_pass_records_vehicle_idx').on(table.vehicleId),
    index('gate_pass_records_driver_idx').on(table.driverId),
  ],
);

/** Which locations may see a given registry pass. */
export const gatePassLocations = pgTable(
  'gate_pass_locations',
  {
    gatePassRecordId: uuid('gate_pass_record_id')
      .notNull()
      .references(() => gatePassRecords.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
  },
  (table) => [primaryKey({ columns: [table.gatePassRecordId, table.locationId] })],
);

export const challans = pgTable(
  'challans',
  {
    id: uuid('id').primaryKey(),
    /** Server-assigned display number, globally unique; cancelled numbers are never reused. */
    challanNumber: text('challan_number').notNull(),
    /**
     * Issued snapshots of the identity the marshal submitted, so the record keeps
     * its meaning even if the registry later changes (spec section 7).
     */
    gatePassNumber: text('gate_pass_number').notNull(),
    vehicleRegistrationNumber: text('vehicle_registration_number').notNull(),
    driverName: text('driver_name').notNull(),
    /** Optional registry provenance; manual issuance leaves these null. */
    gatePassRecordId: uuid('gate_pass_record_id').references(() => gatePassRecords.id),

    /** Master references retained for provenance alongside the snapshots below. */
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    departmentLabelSnapshot: text('department_label_snapshot').notNull(),
    contractorId: uuid('contractor_id').references(() => contractors.id),
    contractorLabelSnapshot: text('contractor_label_snapshot'),
    vehicleTypeId: uuid('vehicle_type_id')
      .notNull()
      .references(() => vehicleTypes.id),
    vehicleTypeLabelSnapshot: text('vehicle_type_label_snapshot').notNull(),

    /** Attribution: authorised post determines the actual location and gate. */
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    gateId: uuid('gate_id')
      .notNull()
      .references(() => gates.id),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id),
    issuedByUserId: uuid('issued_by_user_id')
      .notNull()
      .references(() => users.id),

    status: text('status')
      .notNull()
      .$type<(typeof CHALLAN_STATUS_VALUES)[number]>()
      .default('Issued'),
    /** Derived highest-of-set severity, stored with the issued record. */
    severity: text('severity').notNull().$type<(typeof SEVERITY_VALUES)[number]>(),
    /** Occurrence and recommendation as issued; cancellation never rewrites them. */
    occurrenceNumber: integer('occurrence_number').notNull(),
    recommendedAction: text('recommended_action')
      .notNull()
      .$type<(typeof RESOLUTION_ACTION_VALUES)[number]>(),

    remarks: text('remarks'),
    /** Timing: entry start records issuance duration; issuedAt is the commit instant. */
    entryStartedAt: timestamp('entry_started_at', { withTimezone: true }),
    /** I-06 idempotency key from the issuing client operation. */
    operationId: text('operation_id'),
    /** Hash of the full commit payload; the same key with a different payload conflicts. */
    operationHash: text('operation_hash'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    /** Cancellation retains the record and never deletes it (E3.5). */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id),
    cancellationReason: text('cancellation_reason'),
    /** Set by an Admin reopening a Resolved record. */
    reopenedAt: timestamp('reopened_at', { withTimezone: true }),
    reopenedByUserId: uuid('reopened_by_user_id').references(() => users.id),
    reopeningReason: text('reopening_reason'),

    demoSourceId: text('demo_source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('challans_challan_number_unique').on(table.challanNumber),
    unique('challans_operation_id_unique').on(table.operationId),
    check(
      'challans_status_check',
      sql`${table.status} IN ('Issued','Under Review','Resolved','Cancelled')`,
    ),
    check('challans_occurrence_check', sql`${table.occurrenceNumber} >= 1`),
    // Attribution consistency is DB-owned: a challan's post and gate must agree,
    // and its gate and location must agree. Separate single-column foreign keys
    // could each point at an existing row while describing an impossible pairing.
    foreignKey({
      columns: [table.postId, table.gateId],
      foreignColumns: [posts.id, posts.gateId],
      name: 'challans_post_gate_fk',
    }),
    foreignKey({
      columns: [table.gateId, table.locationId],
      foreignColumns: [gates.id, gates.locationId],
      name: 'challans_gate_location_fk',
    }),
    // Repeat counting is keyed on the normalised pass and windowed on issued_at.
    index('challans_repeat_window_idx').on(table.gatePassNumber, table.issuedAt),
    // The 15-minute duplicate check is independent of repeat identity.
    index('challans_duplicate_window_idx').on(
      table.vehicleRegistrationNumber,
      table.locationId,
      table.issuedAt,
    ),
    index('challans_status_idx').on(table.status),
  ],
);

export const challanViolations = pgTable(
  'challan_violations',
  {
    challanId: uuid('challan_id')
      .notNull()
      .references(() => challans.id, { onDelete: 'cascade' }),
    violationTypeId: uuid('violation_type_id')
      .notNull()
      .references(() => violationTypes.id),
    /** Immutable issued snapshots; later master edits cannot change these. */
    labelSnapshot: text('label_snapshot').notNull(),
    severitySnapshot: text('severity_snapshot').notNull().$type<(typeof SEVERITY_VALUES)[number]>(),
    defaultActionSnapshot:
      text('default_action_snapshot').$type<(typeof RESOLUTION_ACTION_VALUES)[number]>(),
  },
  (table) => [
    primaryKey({ columns: [table.challanId, table.violationTypeId] }),
    check(
      'challan_violations_severity_snapshot_check',
      sql`${table.severitySnapshot} IN ('Minor','Major','Critical')`,
    ),
  ],
);

/**
 * Evidence holds object *references* only; the database stores object keys, not
 * binaries, and the API serves them through an authenticated, logged route.
 */
export const evidence = pgTable(
  'evidence',
  {
    id: uuid('id').primaryKey(),
    challanId: uuid('challan_id')
      .notNull()
      .references(() => challans.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    mediaKind: text('media_kind').notNull().default('photo'),
    /** 1-4 per challan. Byte budgets and hard limits arrive with I-02/I-04. */
    ordinal: integer('ordinal').notNull(),
    byteSize: integer('byte_size'),
    contentType: text('content_type'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('evidence_challan_ordinal_unique').on(table.challanId, table.ordinal),
    check('evidence_ordinal_check', sql`${table.ordinal} BETWEEN 1 AND 4`),
  ],
);

export const signatures = pgTable('signatures', {
  id: uuid('id').primaryKey(),
  challanId: uuid('challan_id')
    .notNull()
    .references(() => challans.id, { onDelete: 'cascade' }),
  objectKey: text('object_key').notNull(),
  contentType: text('content_type'),
  byteSize: integer('byte_size'),
  /** Binds the signature to the summary the driver actually acknowledged. */
  acknowledgedPayloadHash: text('acknowledged_payload_hash'),
  signedAt: timestamp('signed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A refusal and a signature are mutually exclusive acknowledgement modes
 * (E2.15). Both witness identity fields are mandatory (E2.14).
 */
export const refusals = pgTable('refusals', {
  id: uuid('id').primaryKey(),
  challanId: uuid('challan_id')
    .notNull()
    .references(() => challans.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  witnessName: text('witness_name').notNull(),
  witnessStaffId: text('witness_staff_id').notNull(),
  recordedByUserId: uuid('recorded_by_user_id')
    .notNull()
    .references(() => users.id),
  refusedAt: timestamp('refused_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Review history is append-only: each transition appends a new record and never
 * overwrites a previous one (spec section 6).
 */
export const challanActions = pgTable(
  'challan_actions',
  {
    id: uuid('id').primaryKey(),
    challanId: uuid('challan_id')
      .notNull()
      .references(() => challans.id, { onDelete: 'cascade' }),
    /** The status this action moved the record to. */
    toStatus: text('to_status').notNull().$type<(typeof CHALLAN_STATUS_VALUES)[number]>(),
    action: text('action').$type<(typeof RESOLUTION_ACTION_VALUES)[number]>(),
    remarks: text('remarks'),
    /** Mandatory on a resolution; also the cancellation/reopening reason holder. */
    reason: text('reason'),
    performerUserId: uuid('performer_user_id')
      .notNull()
      .references(() => users.id),
    /** Transition legality and role scope are enforced by the API, not here. */
    demoSourceId: text('demo_source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'challan_actions_to_status_check',
      sql`${table.toStatus} IN ('Issued','Under Review','Resolved','Cancelled')`,
    ),
    index('challan_actions_challan_idx').on(table.challanId),
  ],
);

/**
 * Audit trail storage (E6.1/E6.2).
 *
 * **Honest scope boundary:** this establishes the audit *storage shape* only.
 * Append-only behaviour is NOT yet enforced: F-01 adds no database trigger or
 * privilege that prevents UPDATE or DELETE, and the challan foreign key still
 * cascades so a challan and its audit history are removed together. Actual
 * append-only enforcement, and the audit-trail survival requirement across
 * cancellation, arrive with the review/audit feature (R-06). Nothing here should
 * be read as satisfying E6.2 today.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey(),
    challanId: uuid('challan_id').references(() => challans.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    eventType: text('event_type').notNull(),
    /** Where the action came from, e.g. `tablet`, `admin`, `seed:synthetic`. */
    source: text('source').notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('audit_events_event_type_check', sql`length(${table.eventType}) > 0`),
    index('audit_events_challan_idx').on(table.challanId),
    index('audit_events_created_idx').on(table.createdAt),
  ],
);

/* ========================================================================== */
/* F-02 DEMO AUTHENTICATION SESSIONS                                           */
/* ========================================================================== */

/**
 * Server-side demo sessions (addendum A v0.2 section 2.2).
 *
 *  - **Tokens are stored hashed.** Only the SHA-256 hex digest of the opaque
 *    token is persisted, in a unique column, so a database dump cannot yield a
 *    usable session. The raw token exists exactly once, in the login response.
 *  - **A session binds its context.** `user_id`, `role` and, where applicable,
 *    `post_id`/`shift_id` are fixed at login. That is what stops a client from
 *    re-pointing a live session at another post or shift, and it is the stable
 *    attribution for issuance.
 *  - **Both expiries are stored per row**, so a later policy change cannot
 *    retroactively reinterpret an existing session. `last_seen_at` is refreshed
 *    by every accepted request; `idle_timeout_seconds` is the approved idle
 *    window for that session's role. `absolute_expires_at` in the past is a
 *    normal *expired* state, not invalid data, so no constraint forbids it: the
 *    session is simply refused.
 *  - **Revocation is retained, not deleted.** `revoked_at` records the logout so
 *    the history of the session survives while the token stops working.
 *
 * Sessions never store password material. The only password storage in this
 * schema is the nullable `users.password_hash` written by an Admin reset
 * (Argon2id); accounts without a reset keep the F-02 env-backed demo path.
 * User creation/disable remain out of scope for this bounded slice.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** SHA-256 hex digest of the token; the raw token is never persisted. */
    tokenHash: text('token_hash').notNull(),
    /** The role resolved at login from the matched credential and stored user. */
    role: text('role').notNull().$type<(typeof ROLE_VALUES)[number]>(),
    postId: uuid('post_id').references(() => posts.id),
    shiftId: uuid('shift_id').references(() => shifts.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    /** Approved idle window for this session's role, stored rather than assumed. */
    idleTimeoutSeconds: integer('idle_timeout_seconds').notNull(),
    /** Hard upper bound on the session lifetime, independent of activity. */
    absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(),
    /** Set by logout. A revoked token must never regain access. */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    unique('sessions_token_hash_unique').on(table.tokenHash),
    check('sessions_role_check', sql`${table.role} IN ('Marshal','Supervisor','Admin')`),
    check('sessions_idle_timeout_check', sql`${table.idleTimeoutSeconds} > 0`),
    index('sessions_user_idx').on(table.userId),
    index('sessions_active_idx').on(table.revokedAt, table.absoluteExpiresAt),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type User = typeof users.$inferSelect;
export type Challan = typeof challans.$inferSelect;
export type ChallanViolation = typeof challanViolations.$inferSelect;
export type GatePassRecord = typeof gatePassRecords.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type ChallanAction = typeof challanActions.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
