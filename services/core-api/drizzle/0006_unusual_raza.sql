CREATE TYPE "public"."payout_status" AS ENUM('requested', 'paid', 'rejected');--> statement-breakpoint
CREATE TABLE "rider_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"amount_satang" integer NOT NULL,
	"status" "payout_status" DEFAULT 'requested' NOT NULL,
	"rejection_reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "rider_payouts_amount_positive" CHECK ("rider_payouts"."amount_satang" > 0),
	CONSTRAINT "rider_payouts_decided_has_time" CHECK (
      ("rider_payouts"."status" = 'requested' and "rider_payouts"."decided_at" is null)
      or ("rider_payouts"."status" <> 'requested' and "rider_payouts"."decided_at" is not null)
    ),
	CONSTRAINT "rider_payouts_rejected_has_reason" CHECK (
      "rider_payouts"."status" <> 'rejected' or "rider_payouts"."rejection_reason" is not null
    )
);
-- > statement-breakpoint
ALTER TABLE "rider_payouts" ADD CONSTRAINT "rider_payouts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rider_payouts_one_pending" ON "rider_payouts" USING btree ("account_id") WHERE "rider_payouts"."status" = 'requested';--> statement-breakpoint
CREATE INDEX "rider_payouts_account_idx" ON "rider_payouts" USING btree ("account_id");