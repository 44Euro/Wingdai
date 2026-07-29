CREATE TABLE "phone_verifications" (
	"phone" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"send_count" integer DEFAULT 1 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "phone_verifications_phone_format" CHECK ("phone_verifications"."phone" ~ '^0[689][0-9]{8}$'),
	CONSTRAINT "phone_verifications_counters_sane" CHECK ("phone_verifications"."attempts" >= 0 and "phone_verifications"."send_count" >= 1)
);
