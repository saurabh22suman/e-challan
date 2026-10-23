CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"challan_id" uuid,
	"actor_user_id" uuid,
	"event_type" text NOT NULL,
	"source" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challan_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"challan_id" uuid NOT NULL,
	"to_status" text NOT NULL,
	"action" text,
	"remarks" text,
	"reason" text,
	"performer_user_id" uuid NOT NULL,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challan_violations" (
	"challan_id" uuid NOT NULL,
	"violation_type_id" uuid NOT NULL,
	"label_snapshot" text NOT NULL,
	"severity_snapshot" text NOT NULL,
	"default_action_snapshot" text
);
--> statement-breakpoint
CREATE TABLE "challans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"challan_number" text NOT NULL,
	"gate_pass_number" text NOT NULL,
	"vehicle_registration_number" text NOT NULL,
	"driver_name" text NOT NULL,
	"gate_pass_record_id" uuid,
	"department_id" uuid NOT NULL,
	"department_label_snapshot" text NOT NULL,
	"contractor_id" uuid,
	"contractor_label_snapshot" text,
	"vehicle_type_id" uuid NOT NULL,
	"vehicle_type_label_snapshot" text NOT NULL,
	"location_id" uuid NOT NULL,
	"gate_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"issued_by_user_id" uuid NOT NULL,
	"status" text DEFAULT 'Issued' NOT NULL,
	"severity" text NOT NULL,
	"occurrence_number" integer NOT NULL,
	"recommended_action" text NOT NULL,
	"remarks" text,
	"entry_started_at" timestamp with time zone,
	"issued_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"cancellation_reason" text,
	"reopened_at" timestamp with time zone,
	"reopened_by_user_id" uuid,
	"reopening_reason" text,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"gate_pass_number" text,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"challan_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"media_kind" text DEFAULT 'photo' NOT NULL,
	"ordinal" integer NOT NULL,
	"byte_size" integer,
	"content_type" text,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gate_pass_locations" (
	"gate_pass_record_id" uuid NOT NULL,
	"location_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gate_pass_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"gate_pass_number" text NOT NULL,
	"driver_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"department_id" uuid,
	"contractor_id" uuid,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"registry_status" text DEFAULT 'Active' NOT NULL,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refusals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"challan_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"witness_name" text NOT NULL,
	"witness_staff_id" text NOT NULL,
	"recorded_by_user_id" uuid NOT NULL,
	"refused_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"gate_id" uuid NOT NULL,
	"label" text NOT NULL,
	"marshal_user_id" uuid NOT NULL,
	"supervisor_user_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"challan_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text,
	"byte_size" integer,
	"acknowledged_payload_hash" text,
	"signed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_locations" (
	"user_id" uuid NOT NULL,
	"location_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"role" text NOT NULL,
	"display_name" text NOT NULL,
	"employee_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"registration_number" text NOT NULL,
	"vehicle_type_id" uuid,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "violation_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"severity" text,
	"default_action" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"demo_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_challan_id_challans_id_fk" FOREIGN KEY ("challan_id") REFERENCES "public"."challans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challan_actions" ADD CONSTRAINT "challan_actions_challan_id_challans_id_fk" FOREIGN KEY ("challan_id") REFERENCES "public"."challans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challan_actions" ADD CONSTRAINT "challan_actions_performer_user_id_users_id_fk" FOREIGN KEY ("performer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challan_violations" ADD CONSTRAINT "challan_violations_challan_id_challans_id_fk" FOREIGN KEY ("challan_id") REFERENCES "public"."challans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challan_violations" ADD CONSTRAINT "challan_violations_violation_type_id_violation_types_id_fk" FOREIGN KEY ("violation_type_id") REFERENCES "public"."violation_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_gate_pass_record_id_gate_pass_records_id_fk" FOREIGN KEY ("gate_pass_record_id") REFERENCES "public"."gate_pass_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_vehicle_type_id_vehicle_types_id_fk" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_reopened_by_user_id_users_id_fk" FOREIGN KEY ("reopened_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_challan_id_challans_id_fk" FOREIGN KEY ("challan_id") REFERENCES "public"."challans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_pass_locations" ADD CONSTRAINT "gate_pass_locations_gate_pass_record_id_gate_pass_records_id_fk" FOREIGN KEY ("gate_pass_record_id") REFERENCES "public"."gate_pass_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_pass_locations" ADD CONSTRAINT "gate_pass_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_pass_records" ADD CONSTRAINT "gate_pass_records_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_pass_records" ADD CONSTRAINT "gate_pass_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_pass_records" ADD CONSTRAINT "gate_pass_records_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gate_pass_records" ADD CONSTRAINT "gate_pass_records_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gates" ADD CONSTRAINT "gates_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refusals" ADD CONSTRAINT "refusals_challan_id_challans_id_fk" FOREIGN KEY ("challan_id") REFERENCES "public"."challans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refusals" ADD CONSTRAINT "refusals_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."gates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_marshal_user_id_users_id_fk" FOREIGN KEY ("marshal_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_supervisor_user_id_users_id_fk" FOREIGN KEY ("supervisor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_challan_id_challans_id_fk" FOREIGN KEY ("challan_id") REFERENCES "public"."challans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_type_id_vehicle_types_id_fk" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE no action ON UPDATE no action;