-- รหัสยืนยันส่งสี่หลัก (design R11)
ALTER TABLE "orders" ADD COLUMN "delivery_pin" char(4);--> statement-breakpoint
UPDATE "orders" SET "delivery_pin" = lpad((floor(random() * 10000))::int::text, 4, '0') WHERE "delivery_pin" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_pin" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_pin_format" CHECK ("orders"."delivery_pin" ~ '^[0-9]{4}$');
