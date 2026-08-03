-- จุดตั้งทำงานของไรเดอร์ (design R7) แทนที่โซนที่หมดความหมายหลังเปลี่ยนเป็นโมเดลระยะ 5 กม.
ALTER TABLE "rider_status" ADD COLUMN "base_location" geometry(point);--> statement-breakpoint
ALTER TABLE "rider_status" ADD COLUMN "base_radius_km" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "rider_status" ADD CONSTRAINT "rider_status_base_radius_sane" CHECK ("rider_status"."base_radius_km" between 1 and 20);
