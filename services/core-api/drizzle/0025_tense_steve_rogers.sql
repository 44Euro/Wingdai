ALTER TABLE "phone_verifications" ADD COLUMN "purpose" text DEFAULT 'phone_verify' NOT NULL;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD COLUMN "ticket_id" text;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_purpose_known" CHECK ("phone_verifications"."purpose" in ('phone_verify', 'password_reset'));