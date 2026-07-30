ALTER TABLE "accounts" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "google_sub" text;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_google_sub_key" ON "accounts" USING btree ("google_sub");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_has_login_method" CHECK ("accounts"."password_hash" is not null or "accounts"."google_sub" is not null);