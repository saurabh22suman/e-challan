ALTER TABLE "challan_violations" ADD CONSTRAINT "challan_violations_challan_id_violation_type_id_pk" PRIMARY KEY("challan_id","violation_type_id");--> statement-breakpoint
ALTER TABLE "gate_pass_locations" ADD CONSTRAINT "gate_pass_locations_gate_pass_record_id_location_id_pk" PRIMARY KEY("gate_pass_record_id","location_id");--> statement-breakpoint
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_location_id_pk" PRIMARY KEY("user_id","location_id");--> statement-breakpoint
CREATE INDEX "audit_events_challan_idx" ON "audit_events" USING btree ("challan_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "challan_actions_challan_idx" ON "challan_actions" USING btree ("challan_id");--> statement-breakpoint
CREATE INDEX "challans_repeat_window_idx" ON "challans" USING btree ("gate_pass_number","issued_at");--> statement-breakpoint
CREATE INDEX "challans_duplicate_window_idx" ON "challans" USING btree ("vehicle_registration_number","location_id","issued_at");--> statement-breakpoint
CREATE INDEX "challans_status_idx" ON "challans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contractors_active_idx" ON "contractors" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "departments_active_idx" ON "departments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "drivers_name_idx" ON "drivers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "gate_pass_records_vehicle_idx" ON "gate_pass_records" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "gate_pass_records_driver_idx" ON "gate_pass_records" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "locations_active_idx" ON "locations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "vehicle_types_active_idx" ON "vehicle_types" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_challan_number_unique" UNIQUE("challan_number");--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_challan_ordinal_unique" UNIQUE("challan_id","ordinal");--> statement-breakpoint
ALTER TABLE "gate_pass_records" ADD CONSTRAINT "gate_pass_records_gate_pass_number_unique" UNIQUE("gate_pass_number");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_registration_number_unique" UNIQUE("registration_number");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_event_type_check" CHECK (length("audit_events"."event_type") > 0);--> statement-breakpoint
ALTER TABLE "challan_actions" ADD CONSTRAINT "challan_actions_to_status_check" CHECK ("challan_actions"."to_status" IN ('Issued','Under Review','Resolved','Cancelled'));--> statement-breakpoint
ALTER TABLE "challan_violations" ADD CONSTRAINT "challan_violations_severity_snapshot_check" CHECK ("challan_violations"."severity_snapshot" IN ('Minor','Major','Critical'));--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_status_check" CHECK ("challans"."status" IN ('Issued','Under Review','Resolved','Cancelled'));--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_occurrence_check" CHECK ("challans"."occurrence_number" >= 1);--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_ordinal_check" CHECK ("evidence"."ordinal" BETWEEN 1 AND 4);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('Marshal','Supervisor','Admin'));--> statement-breakpoint
ALTER TABLE "violation_types" ADD CONSTRAINT "violation_types_severity_check" CHECK ("violation_types"."severity" IS NULL OR "violation_types"."severity" IN ('Minor','Major','Critical'));