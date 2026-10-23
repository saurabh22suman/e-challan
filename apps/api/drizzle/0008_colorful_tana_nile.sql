ALTER TABLE "challans" ADD COLUMN "operation_id" text;--> statement-breakpoint
ALTER TABLE "challans" ADD COLUMN "operation_hash" text;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_operation_id_unique" UNIQUE("operation_id");