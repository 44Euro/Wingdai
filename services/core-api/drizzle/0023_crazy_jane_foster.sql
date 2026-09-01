CREATE TABLE "merchant_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"amount_satang" integer NOT NULL,
	"status" "payout_status" DEFAULT 'requested' NOT NULL,
	"rejection_reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "merchant_payouts_amount_positive" CHECK ("merchant_payouts"."amount_satang" > 0),
	CONSTRAINT "merchant_payouts_decided_has_time" CHECK (
      ("merchant_payouts"."status" = 'requested' and "merchant_payouts"."decided_at" is null)
      or ("merchant_payouts"."status" <> 'requested' and "merchant_payouts"."decided_at" is not null)
    ),
	CONSTRAINT "merchant_payouts_rejected_has_reason" CHECK (
      "merchant_payouts"."status" <> 'rejected' or "merchant_payouts"."rejection_reason" is not null
    )
);
--> statement-breakpoint
ALTER TABLE "merchant_payouts" ADD CONSTRAINT "merchant_payouts_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_payouts_one_pending" ON "merchant_payouts" USING btree ("restaurant_id") WHERE "merchant_payouts"."status" = 'requested';--> statement-breakpoint
CREATE INDEX "merchant_payouts_restaurant_idx" ON "merchant_payouts" USING btree ("restaurant_id");