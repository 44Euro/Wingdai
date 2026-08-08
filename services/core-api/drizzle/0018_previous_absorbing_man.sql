ALTER TABLE "orders" DROP CONSTRAINT "orders_amounts_non_negative";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tip_satang" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_non_negative" CHECK (
      "orders"."food_total_satang" > 0
      and "orders"."delivery_fee_satang" >= 0
      and "orders"."service_fee_satang" >= 0
      and "orders"."commission_satang" >= 0
      and "orders"."tip_satang" >= 0
    );