CREATE TYPE "public"."cancel_reason" AS ENUM('out_of_stock', 'too_busy', 'closing_soon', 'other');--> statement-breakpoint
CREATE TYPE "public"."cancelled_by" AS ENUM('customer', 'restaurant', 'admin');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancel_reason" "cancel_reason";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_by" "cancelled_by";