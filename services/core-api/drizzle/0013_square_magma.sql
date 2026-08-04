CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
-- > statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_account_id" uuid
);
-- > statement-breakpoint
CREATE TABLE "platform_pricing" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"commission_rate_bp" integer DEFAULT 1500 NOT NULL,
	"delivery_base_satang" integer DEFAULT 1500 NOT NULL,
	"delivery_per_km_satang" integer DEFAULT 600 NOT NULL,
	"service_fee_satang" integer DEFAULT 500 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_account_id" uuid,
	CONSTRAINT "platform_pricing_single_row" CHECK ("platform_pricing"."singleton" = true),
	CONSTRAINT "platform_pricing_commission_sane" CHECK ("platform_pricing"."commission_rate_bp" between 100 and 3000),
	CONSTRAINT "platform_pricing_fees_sane" CHECK (
      "platform_pricing"."delivery_base_satang" >= 0 and "platform_pricing"."delivery_per_km_satang" >= 0 and "platform_pricing"."service_fee_satang" >= 0
    )
);
-- > statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_account_id_accounts_id_fk" FOREIGN KEY ("updated_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_pricing" ADD CONSTRAINT "platform_pricing_updated_by_account_id_accounts_id_fk" FOREIGN KEY ("updated_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_account_id");