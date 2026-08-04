CREATE TYPE "public"."rider_issue_kind" AS ENUM('cannot_reach_customer', 'bad_address', 'accident');--> statement-breakpoint
CREATE TABLE "rider_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"rider_id" uuid NOT NULL,
	"kind" "rider_issue_kind" NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	CONSTRAINT "rider_issues_resolved_has_actor" CHECK (("rider_issues"."resolved_at" is null) = ("rider_issues"."resolved_by" is null))
);
-- > statement-breakpoint
ALTER TABLE "rider_issues" ADD CONSTRAINT "rider_issues_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_issues" ADD CONSTRAINT "rider_issues_rider_id_accounts_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_issues" ADD CONSTRAINT "rider_issues_resolved_by_accounts_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rider_issues_order_idx" ON "rider_issues" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "rider_issues_open_idx" ON "rider_issues" USING btree ("created_at") WHERE resolved_at is null;