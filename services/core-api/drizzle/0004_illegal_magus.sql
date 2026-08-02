ALTER TABLE "restaurants" ALTER COLUMN "zone_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "zone_id" DROP NOT NULL;