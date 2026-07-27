-- Kagu Padel — row-level security, the append-only audit guarantee, and the
-- scheduled jobs.
--
-- ⚠️ AUTHORED, NOT APPLIED.
--
-- Authorization is RLS, never application code. The capability table in
-- src/auth/guard.ts is the affordance that hides buttons; THIS is the boundary.

-- ---------------------------------------------------------------------------
-- Who is asking
-- ---------------------------------------------------------------------------

create or replace function current_staff_role()
returns staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from staff_users where auth_uid = auth.uid() and active
$$;

create or replace function current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from customers where id::text = (auth.jwt() ->> 'customer_id')
$$;

create or replace function is_staff()
returns boolean
language sql
stable
as $$
  select current_staff_role() in ('owner', 'manager', 'staff', 'coach')
$$;

create or replace function is_manager()
returns boolean
language sql
stable
as $$
  select current_staff_role() in ('owner', 'manager')
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every table. A table without RLS in this schema is a bug.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'courts','availability_templates','availability_exceptions','customers',
    'staff_users','booking_series','series_exceptions','bookings',
    'booking_participants','pricing_rules','promo_codes','cancellation_policies',
    'till_sessions','product_sales','payments','coaches','coach_availability',
    'class_sessions','class_enrolments','products','tournaments',
    'tournament_entries','audit_log','notifications'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Public reads: the things a player must see to book at all.
-- ---------------------------------------------------------------------------

create policy courts_public_read on courts
  for select using (true);

create policy templates_public_read on availability_templates
  for select using (true);

create policy exceptions_public_read on availability_exceptions
  for select using (true);

create policy pricing_public_read on pricing_rules
  for select using (active);

create policy policies_public_read on cancellation_policies
  for select using (active);

create policy products_public_read on products
  for select using (active);

create policy tournaments_public_read on tournaments
  for select using (status in ('open', 'running', 'done'));

-- ---------------------------------------------------------------------------
-- Bookings.
--
-- A player sees their own bookings, plus the OCCUPANCY of everyone else's —
-- but occupancy is served through a view that exposes no customer, no price
-- and no note, because "court 3 is busy at 21:00" is public and "Ahmed Al Nasr
-- owes AED 200" is not.
-- ---------------------------------------------------------------------------

create policy bookings_staff_all on bookings
  for all using (is_staff()) with check (is_staff());

create policy bookings_own_read on bookings
  for select using (
    customer_id = current_customer_id()
    or exists (
      select 1 from booking_participants p
      where p.booking_id = bookings.id
        and p.customer_id = current_customer_id()
    )
  );

-- Occupancy only. Security-invoker off so it can read past the row policies,
-- while exposing strictly non-identifying columns.
create view public_occupancy
with (security_invoker = off) as
  select court_id, period, operating_day, status
  from bookings
  where status in ('held', 'confirmed', 'blocked');

grant select on public_occupancy to anon, authenticated;

create policy participants_staff_all on booking_participants
  for all using (is_staff()) with check (is_staff());

create policy participants_own_read on booking_participants
  for select using (customer_id = current_customer_id());

-- Joining an open match is the one write a player may make to someone else's
-- booking, and only while seats remain.
create policy participants_join_open_match on booking_participants
  for insert to authenticated
  with check (
    customer_id = current_customer_id()
    and exists (
      select 1 from bookings b
      where b.id = booking_id
        and b.open_match
        and b.status = 'confirmed'
        and (
          select count(*) from booking_participants p where p.booking_id = b.id
        ) < b.party_size
    )
  );

-- ---------------------------------------------------------------------------
-- Customers: staff see everyone, a player sees only themselves.
-- ---------------------------------------------------------------------------

create policy customers_staff_all on customers
  for all using (is_staff()) with check (is_staff());

create policy customers_own_read on customers
  for select using (id = current_customer_id());

create policy customers_own_update on customers
  for update using (id = current_customer_id())
  with check (
    id = current_customer_id()
    -- A player may edit their own name and level. They may NOT edit their
    -- credit balance, their tier, or their blocked flag.
    and blocked = (select blocked from customers c where c.id = customers.id)
    and tier    = (select tier    from customers c where c.id = customers.id)
    and credit_balance = (select credit_balance from customers c where c.id = customers.id)
  );

-- ---------------------------------------------------------------------------
-- Money: staff only, and configuration is manager-only.
-- ---------------------------------------------------------------------------

create policy payments_staff_all on payments
  for all using (is_staff()) with check (is_staff());

create policy payments_own_read on payments
  for select using (
    exists (
      select 1 from bookings b
      where b.id = payments.booking_id and b.customer_id = current_customer_id()
    )
  );

create policy till_staff_all on till_sessions
  for all using (is_staff()) with check (is_staff());

create policy sales_staff_all on product_sales
  for all using (is_staff()) with check (is_staff());

create policy pricing_manager_write on pricing_rules
  for all using (is_manager()) with check (is_manager());

create policy promos_manager_write on promo_codes
  for all using (is_manager()) with check (is_manager());

create policy policies_manager_write on cancellation_policies
  for all using (is_manager()) with check (is_manager());

create policy courts_manager_write on courts
  for all using (is_manager()) with check (is_manager());

create policy templates_manager_write on availability_templates
  for all using (is_manager()) with check (is_manager());

create policy exceptions_manager_write on availability_exceptions
  for all using (is_manager()) with check (is_manager());

create policy staff_owner_write on staff_users
  for all using (current_staff_role() = 'owner')
  with check (current_staff_role() = 'owner');

create policy staff_self_read on staff_users
  for select using (auth_uid = auth.uid() or is_staff());

-- Remaining club tables: staff read/write, manager-only for the money-shaped
-- configuration.
create policy series_staff_all on booking_series
  for all using (is_staff()) with check (is_staff());
create policy series_own_read on booking_series
  for select using (customer_id = current_customer_id());
create policy series_ex_staff_all on series_exceptions
  for all using (is_staff()) with check (is_staff());
create policy coaches_staff_all on coaches
  for all using (is_staff()) with check (is_staff());
create policy coaches_public_read on coaches
  for select using (active);
create policy coach_avail_staff_all on coach_availability
  for all using (is_staff()) with check (is_staff());
create policy classes_staff_all on class_sessions
  for all using (is_staff()) with check (is_staff());
create policy classes_public_read on class_sessions
  for select using (true);
create policy enrolments_staff_all on class_enrolments
  for all using (is_staff()) with check (is_staff());
create policy enrolments_own on class_enrolments
  for select using (customer_id = current_customer_id());
create policy products_manager_write on products
  for all using (is_manager()) with check (is_manager());
create policy tournaments_manager_write on tournaments
  for all using (is_manager()) with check (is_manager());
create policy entries_staff_all on tournament_entries
  for all using (is_staff()) with check (is_staff());
create policy entries_own on tournament_entries
  for select using (customer_id = current_customer_id());
create policy notifications_staff_read on notifications
  for select using (is_staff());

-- ---------------------------------------------------------------------------
-- THE AUDIT LOG IS APPEND-ONLY, and that is enforced here, not by convention.
-- ---------------------------------------------------------------------------

create policy audit_manager_read on audit_log
  for select using (is_manager());

create policy audit_staff_insert on audit_log
  for insert with check (is_staff());

-- No UPDATE or DELETE policy exists, so with FORCE RLS on, nobody — including
-- the table owner — can rewrite history through the API.
create or replace function audit_is_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only (attempted %)', tg_op
    using errcode = '42501';
end $$;

create trigger audit_no_update
  before update or delete on audit_log
  for each row execute function audit_is_immutable();

-- ---------------------------------------------------------------------------
-- Keep `operating_day` honest.
--
-- The operating day runs 06:00 -> 02:00 Asia/Dubai, so a booking at 01:00
-- belongs to the PREVIOUS day. Deriving it in a trigger means no client can
-- write a row whose day disagrees with its period.
-- ---------------------------------------------------------------------------

create or replace function operating_day_of(ts timestamptz)
returns date
language sql
immutable
as $$
  select (($1 at time zone 'Asia/Dubai') - interval '6 hours')::date
$$;

create or replace function bookings_set_operating_day()
returns trigger
language plpgsql
as $$
begin
  new.operating_day := operating_day_of(lower(new.period));
  return new;
end $$;

create trigger bookings_operating_day
  before insert or update of period on bookings
  for each row execute function bookings_set_operating_day();

-- ---------------------------------------------------------------------------
-- Scheduled jobs.
-- ---------------------------------------------------------------------------

-- Expire stranded holds. Idempotent: a second run changes nothing.
create or replace function expire_holds()
returns int
language sql
security definer
set search_path = public
as $$
  with expired as (
    update bookings
       set status = 'expired'
     where status = 'held'
       and hold_expires_at is not null
       and hold_expires_at <= now()
    returning 1
  )
  select count(*)::int from expired
$$;

-- ⚠️ REVOKE FROM PUBLIC, not merely from anon/authenticated. Postgres grants
-- EXECUTE to PUBLIC when a function is created, and those roles inherit
-- through it — revoking from them alone does nothing at all.
revoke execute on function expire_holds() from public, anon, authenticated;
grant  execute on function expire_holds() to service_role;

select cron.schedule(
  'kagu-expire-holds',
  '*/5 * * * *',
  $$ select expire_holds() $$
);

-- The recurring-series sweep lives in the application (it needs the pricing
-- engine), at /api/cron/materialise-series, scheduled from vercel.ts. It is
-- guarded by bookings_series_day_key above, so a double run cannot duplicate a
-- Tuesday 21:00.
