CREATE TYPE "public"."account_type" AS ENUM('user', 'rider', 'admin');--> statement-breakpoint
CREATE TYPE "public"."cuisine_category" AS ENUM('rice', 'noodle', 'somtam', 'drink', 'dessert');--> statement-breakpoint
CREATE TYPE "public"."ledger_account" AS ENUM('cash', 'restaurant_payable', 'rider_payable', 'rider_cash_held', 'payment_fee_expense', 'platform_revenue', 'refund_expense');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('created', 'accepted', 'preparing', 'picked_up', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('promptpay', 'cash', 'card');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."refund_fault" AS ENUM('restaurant', 'rider', 'platform');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('open', 'auto_verified', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."rider_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."zone_type" AS ENUM('university', 'condo_cluster', 'office_district', 'mixed');--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "zone_type" NOT NULL,
	"boundary_geojson" jsonb NOT NULL,
	"center" geometry(point) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"demand_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_type" "account_type" NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	CONSTRAINT "accounts_phone_format" CHECK ("accounts"."phone" ~ '^0[689][0-9]{8}$')
);
--> statement-breakpoint
CREATE TABLE "rider_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"storage_path" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rider_profiles" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"approval" "rider_approval_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_account_id" uuid,
	"rejection_reason" text,
	"national_id" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"vehicle_registration" text NOT NULL,
	"licence_expiry" date NOT NULL,
	"compulsory_insurance_expiry" date NOT NULL,
	"bank_name" text NOT NULL,
	"bank_account_number" text NOT NULL,
	"bank_account_name" text NOT NULL,
	"emergency_contact_name" text NOT NULL,
	"emergency_contact_phone" text NOT NULL,
	"preferred_zone_id" uuid,
	"contract_signed_at" timestamp with time zone,
	"pdpa_consent_at" timestamp with time zone,
	"cash_held_satang" integer DEFAULT 0 NOT NULL,
	"cash_limit_satang" integer DEFAULT 150000 NOT NULL,
	CONSTRAINT "rider_profiles_cash_held_non_negative" CHECK ("rider_profiles"."cash_held_satang" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_satang" integer NOT NULL,
	"category" "cuisine_category" NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"photo_path" text,
	"option_groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_items_price_positive" CHECK ("menu_items"."price_satang" > 0)
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cuisine" "cuisine_category" NOT NULL,
	"address_text" text NOT NULL,
	"location" geometry(point) NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp with time zone,
	"is_open" boolean DEFAULT false NOT NULL,
	"prep_time_minutes" integer NOT NULL,
	"opening_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"storefront_photo_path" text,
	"business_doc_path" text,
	"bank_name" text,
	"bank_account_number" text,
	"bank_account_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurants_prep_time_sane" CHECK ("restaurants"."prep_time_minutes" between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"label" text NOT NULL,
	"address_text" text NOT NULL,
	"note" text,
	"location" geometry(point) NOT NULL,
	"zone_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid,
	"name" text NOT NULL,
	"unit_price_satang" integer NOT NULL,
	"quantity" integer NOT NULL,
	"selected_choices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_price_positive" CHECK ("order_items"."unit_price_satang" > 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"rider_id" uuid,
	"zone_id" uuid NOT NULL,
	"delivery_address_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'created' NOT NULL,
	"food_total_satang" integer NOT NULL,
	"delivery_fee_satang" integer NOT NULL,
	"service_fee_satang" integer NOT NULL,
	"commission_satang" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"predicted_ready_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"delivery_photo_path" text,
	CONSTRAINT "orders_amounts_non_negative" CHECK (
      "orders"."food_total_satang" > 0
      and "orders"."delivery_fee_satang" >= 0
      and "orders"."service_fee_satang" >= 0
      and "orders"."commission_satang" >= 0
    ),
	CONSTRAINT "orders_rider_is_not_customer" CHECK ("orders"."rider_id" is null or "orders"."rider_id" <> "orders"."customer_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_group_id" uuid NOT NULL,
	"account" "ledger_account" NOT NULL,
	"debit_satang" integer DEFAULT 0 NOT NULL,
	"credit_satang" integer DEFAULT 0 NOT NULL,
	"order_id" uuid,
	"counterparty_account_id" uuid,
	"reason" text NOT NULL,
	"reverses_entry_group_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_one_side_only" CHECK (
      ("ledger_entries"."debit_satang" > 0 and "ledger_entries"."credit_satang" = 0)
      or ("ledger_entries"."credit_satang" > 0 and "ledger_entries"."debit_satang" = 0)
    )
);
--> statement-breakpoint
CREATE TABLE "refund_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"reported_by_account_id" uuid NOT NULL,
	"status" "refund_status" DEFAULT 'open' NOT NULL,
	"customer_reason" text NOT NULL,
	"evidence_photo_path" text,
	"auto_verdict" text,
	"auto_reasoning" text,
	"suggested_amount_satang" integer,
	"fault" "refund_fault",
	"approved_amount_satang" integer,
	"decided_by_account_id" uuid,
	"decided_at" timestamp with time zone,
	"ledger_entry_group_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rider_documents" ADD CONSTRAINT "rider_documents_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_profiles" ADD CONSTRAINT "rider_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_profiles" ADD CONSTRAINT "rider_profiles_approved_by_account_id_accounts_id_fk" FOREIGN KEY ("approved_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_profiles" ADD CONSTRAINT "rider_profiles_preferred_zone_id_zones_id_fk" FOREIGN KEY ("preferred_zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_owner_user_id_accounts_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_accounts_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_rider_id_accounts_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_id_addresses_id_fk" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."addresses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_counterparty_account_id_accounts_id_fk" FOREIGN KEY ("counterparty_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_cases" ADD CONSTRAINT "refund_cases_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_cases" ADD CONSTRAINT "refund_cases_reported_by_account_id_accounts_id_fk" FOREIGN KEY ("reported_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_cases" ADD CONSTRAINT "refund_cases_decided_by_account_id_accounts_id_fk" FOREIGN KEY ("decided_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_username_key" ON "accounts" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_phone_key" ON "accounts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "accounts_email_idx" ON "accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "rider_documents_account_kind_key" ON "rider_documents" USING btree ("account_id","kind");--> statement-breakpoint
CREATE INDEX "rider_profiles_approval_idx" ON "rider_profiles" USING btree ("approval");--> statement-breakpoint
CREATE INDEX "menu_items_restaurant_idx" ON "menu_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "restaurants_owner_idx" ON "restaurants" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "restaurants_zone_idx" ON "restaurants" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "addresses_account_idx" ON "addresses" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_restaurant_status_idx" ON "orders" USING btree ("restaurant_id","status");--> statement-breakpoint
CREATE INDEX "orders_rider_idx" ON "orders" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX "orders_zone_created_idx" ON "orders" USING btree ("zone_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference_key" ON "orders" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "ledger_entries_group_idx" ON "ledger_entries" USING btree ("entry_group_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_order_idx" ON "ledger_entries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_created_idx" ON "ledger_entries" USING btree ("account","created_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_counterparty_idx" ON "ledger_entries" USING btree ("counterparty_account_id");--> statement-breakpoint
CREATE INDEX "refund_cases_status_idx" ON "refund_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refund_cases_order_idx" ON "refund_cases" USING btree ("order_id");