-- กติกาที่เขียนเป็น schema ไม่ได้ ต้องบังคับด้วย trigger

-- 0. PostGIS + ใส่ SRID ให้คอลัมน์พิกัด
alter table zones       alter column center   type geometry(Point, 4326) using st_setsrid(center, 4326);
alter table restaurants alter column location type geometry(Point, 4326) using st_setsrid(location, 4326);
alter table addresses   alter column location type geometry(Point, 4326) using st_setsrid(location, 4326);

create index if not exists restaurants_location_gix on restaurants using gist (location);
create index if not exists addresses_location_gix   on addresses   using gist (location);

-- 1. ledger เขียนอย่างเดียว (product-spec §6.2)
create or replace function ledger_is_append_only() returns trigger as $$
begin
  raise exception 'ledger_entries เขียนอย่างเดียว — แก้ยอดผิดด้วยการเขียนรายการกลับทาง ไม่ใช่ % แถวเดิม', tg_op;
end;
$$ language plpgsql;

drop trigger if exists ledger_entries_no_update on ledger_entries;
create trigger ledger_entries_no_update
  before update on ledger_entries
  for each row execute function ledger_is_append_only();

drop trigger if exists ledger_entries_no_delete on ledger_entries;
create trigger ledger_entries_no_delete
  before delete on ledger_entries
  for each row execute function ledger_is_append_only();

-- 2. ทุกกลุ่มรายการต้องบาลานซ์ (product-spec §6.2)
-- เช็คตอน COMMIT เท่านั้น เพราะระหว่างเขียนทีละแถวยอดยังไม่เท่ากันเป็นเรื่องปกติ
create or replace function ledger_group_must_balance() returns trigger as $$
declare
  total_debit  bigint;
  total_credit bigint;
begin
  select coalesce(sum(debit_satang), 0), coalesce(sum(credit_satang), 0)
    into total_debit, total_credit
    from ledger_entries
   where entry_group_id = new.entry_group_id;

  if total_debit <> total_credit then
    raise exception
      'ledger กลุ่ม % ไม่บาลานซ์: เดบิต % สตางค์ เครดิต % สตางค์',
      new.entry_group_id, total_debit, total_credit;
  end if;

  return null;
end;
$$ language plpgsql;

drop trigger if exists ledger_entries_balanced on ledger_entries;
create constraint trigger ledger_entries_balanced
  after insert on ledger_entries
  deferrable initially deferred
  for each row execute function ledger_group_must_balance();

-- 3. ห้ามสั่งอาหารจากร้านตัวเอง (product-spec §4.3)
-- CHECK อ้างข้ามตารางไม่ได้ จึงต้องเป็น trigger
create or replace function orders_no_self_order() returns trigger as $$
declare
  owner uuid;
begin
  select owner_user_id into owner from restaurants where id = new.restaurant_id;

  if owner = new.customer_id then
    raise exception 'สั่งอาหารจากร้านของตัวเองไม่ได้ (บัญชี %)', new.customer_id;
  end if;

  if new.rider_id is not null and new.rider_id = owner then
    raise exception 'ไรเดอร์รับงานส่งอาหารจากร้านของตัวเองไม่ได้ (บัญชี %)', new.rider_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_self_order_guard on orders;
create trigger orders_self_order_guard
  before insert or update of restaurant_id, customer_id, rider_id on orders
  for each row execute function orders_no_self_order();

-- 4. ค่าคอมมิชชันต้องตรงกับอัตราที่ออร์เดอร์ใบนั้นบันทึกไว้ (product-spec §6.1)
alter table orders drop constraint if exists orders_commission_is_15_percent;
alter table orders drop constraint if exists orders_commission_matches_rate;
alter table orders
  add constraint orders_commission_matches_rate
  check (commission_satang = floor(food_total_satang * commission_rate_bp / 10000));

-- 5. มีได้แค่โปรไฟล์ไรเดอร์ของบัญชีที่เป็นไรเดอร์จริง ๆ
create or replace function rider_profile_requires_rider_account() returns trigger as $$
begin
  if (select account_type from accounts where id = new.account_id) <> 'rider' then
    raise exception 'บัญชี % ไม่ใช่ประเภทไรเดอร์ จึงมีโปรไฟล์ไรเดอร์ไม่ได้', new.account_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists rider_profiles_account_type_guard on rider_profiles;
create trigger rider_profiles_account_type_guard
  before insert or update of account_id on rider_profiles
  for each row execute function rider_profile_requires_rider_account();

-- 6. ร้านต้องเป็นของบัญชีประเภท user เท่านั้น (product-spec §4.3 §7)
-- merchant ไม่ใช่ประเภทบัญชี แต่เป็นความสามารถที่งอกบนบัญชี user
create or replace function restaurant_owner_must_be_user() returns trigger as $$
begin
  if (select account_type from accounts where id = new.owner_user_id) <> 'user' then
    raise exception 'เจ้าของร้านต้องเป็นบัญชีประเภท user เท่านั้น (บัญชี %)', new.owner_user_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists restaurants_owner_type_guard on restaurants;
create trigger restaurants_owner_type_guard
  before insert or update of owner_user_id on restaurants
  for each row execute function restaurant_owner_must_be_user();

-- 7. audit_log เขียนอย่างเดียว (design SA5)
create or replace function audit_is_append_only() returns trigger as $$
begin
  raise exception 'audit_log เขียนอย่างเดียว — บันทึกสิ่งที่เกิดขึ้นจริงเพิ่มเข้าไป ไม่ใช่ % แถวเดิม', tg_op;
end;
$$ language plpgsql;

drop trigger if exists audit_log_no_update on audit_log;
create trigger audit_log_no_update
  before update on audit_log
  for each row execute function audit_is_append_only();

drop trigger if exists audit_log_no_delete on audit_log;
create trigger audit_log_no_delete
  before delete on audit_log
  for each row execute function audit_is_append_only();
