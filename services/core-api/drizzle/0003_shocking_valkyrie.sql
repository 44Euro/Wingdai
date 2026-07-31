CREATE TYPE "public"."offer_outcome" AS ENUM('pending', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TABLE "dispatch_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"rider_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"score" double precision NOT NULL,
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"outcome" "offer_outcome" DEFAULT 'pending' NOT NULL,
	CONSTRAINT "dispatch_offers_expires_after_offered" CHECK ("dispatch_offers"."expires_at" > "dispatch_offers"."offered_at")
);
-- > statement-breakpoint
CREATE TABLE "rider_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"zone_id" uuid,
	"online_at" timestamp with time zone DEFAULT now() NOT NULL,
	"offline_at" timestamp with time zone,
	CONSTRAINT "rider_sessions_offline_after_online" CHECK ("rider_sessions"."offline_at" is null or "rider_sessions"."offline_at" >= "rider_sessions"."online_at")
);
-- > statement-breakpoint
CREATE TABLE "rider_status" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"location" geometry(point),
	"last_ping_at" timestamp with time zone,
	"online_since" timestamp with time zone,
	"last_job_ended_at" timestamp with time zone,
	"zone_id" uuid
);
-- > statement-breakpoint
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_rider_id_accounts_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_sessions" ADD CONSTRAINT "rider_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_sessions" ADD CONSTRAINT "rider_sessions_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_status" ADD CONSTRAINT "rider_status_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_status" ADD CONSTRAINT "rider_status_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispatch_offers_rider_idx" ON "dispatch_offers" USING btree ("rider_id","outcome");--> statement-breakpoint
CREATE INDEX "dispatch_offers_order_idx" ON "dispatch_offers" USING btree ("order_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "dispatch_offers_order_rider_key" ON "dispatch_offers" USING btree ("order_id","rider_id");--> statement-breakpoint
CREATE INDEX "rider_sessions_account_idx" ON "rider_sessions" USING btree ("account_id","online_at");--> statement-breakpoint
CREATE INDEX "rider_status_online_idx" ON "rider_status" USING btree ("is_online");