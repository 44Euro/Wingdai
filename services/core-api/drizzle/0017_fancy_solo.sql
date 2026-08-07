CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"author_account_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"rider_account_id" uuid,
	"restaurant_rating" integer NOT NULL,
	"rider_rating" integer,
	"comment" text,
	"photo_paths" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_one_per_order" UNIQUE("order_id"),
	CONSTRAINT "reviews_restaurant_rating_range" CHECK ("reviews"."restaurant_rating" between 1 and 5),
	CONSTRAINT "reviews_rider_rating_range" CHECK ("reviews"."rider_rating" is null or "reviews"."rider_rating" between 1 and 5)
);
-- > statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_account_id_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rider_account_id_accounts_id_fk" FOREIGN KEY ("rider_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_restaurant_idx" ON "reviews" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "reviews_rider_idx" ON "reviews" USING btree ("rider_account_id");