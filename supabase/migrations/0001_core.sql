-- Kagu Padel — core schema.
--
-- ⚠️ AUTHORED, NOT APPLIED. There is no Supabase project yet. This file is
-- written alongside the in-memory driver so the driver was built against real
-- constraints rather than the other way round; see src/data/memory/driver.ts
-- and HANDOFF.md.
--
-- THE ONE THING THIS FILE EXISTS FOR is at the bottom of the bookings table:
-- double-booking is prevented by an exclusion constraint, never by application
-- code. Two people tapping the same 21:00 slot — one gets 23P01, we catch it
-- and say "just taken". No locking, no read-then-write, no race.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums. CHECK-constrained text is used where the client will plausibly add a
-- value later (payment methods, sources), because that is an ALTER CONSTRAINT
-- rather than an ALTER TYPE that locks the table.
-- ---------------------------------------------------------------------------

create type booking_status as enum (
  'held', 'confirmed', 'cancelled', 'no_show', 'expired', 'blocked'
);

create type payment_status as enum ('unpaid', 'part_paid', 'paid', 'refunded');
create type membership_tier as enum ('guest', 'member', 'premium');
create type staff_role as enum ('owner', 'manager', 'staff', 'coach', 'player');
create type refund_kind as enum ('refund', 'credit', 'none');

-- ---------------------------------------------------------------------------
-- Courts and availability. Slots are COMPUTED from these on read; there is
-- deliberately no table of materialised slots.
-- ---------------------------------------------------------------------------

create table courts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_ar       text not null,
  ordinal       int  not null,
  surface       text not null check (surface in ('glass', 'panoramic', 'wall')),
  enclosure     text not null check (enclosure in ('indoor', 'outdoor', 'covered')),
  tags          text[] not null default '{}',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index courts_ordinal_key on courts (ordinal);

-- The normal week. `court_id` null means "every court".
-- Minutes are measured from the operating day's 06:00 start, so 0 = 06:00 and
-- 1200 = 02:00 the following calendar morning.
create table availability_templates (
  id            uuid primary key default gen_random_uuid(),
  court_id      uuid references courts(id) on delete cascade,
  weekday       int not null check (weekday between 0 and 6),
  open_minute   int not null check (open_minute  between 0 and 1200),
  close_minute  int not null check (close_minute between 0 and 1200),
  check (close_minute > open_minute)
);

-- Holidays, maintenance and Ramadan hours. Null open/close closes entirely.
create table availability_exceptions (
  id            uuid primary key default gen_random_uuid(),
  court_id      uuid references courts(id) on delete cascade,
  from_day      date not null,
  to_day        date not null,
  kind          text not null check (
                  kind in ('holiday','maintenance','ramadan','private','tournament')),
  open_minute   int check (open_minute  between 0 and 1200),
  close_minute  int check (close_minute between 0 and 1200),
  note          text not null default '',
  note_ar       text not null default '',
  check (to_day >= from_day),
  check ((open_minute is null) = (close_minute is null))
);

create index availability_exceptions_range on availability_exceptions (from_day, to_day);

-- ---------------------------------------------------------------------------
-- Customers. Phone is the practical primary key — names are entered
-- inconsistently, so deduplication is on the normalised number.
-- ---------------------------------------------------------------------------

create table customers (
  id             uuid primary key default gen_random_uuid(),
  phone          text not null,
  name           text not null,
  name_ar        text,
  email          text,
  level          numeric(2,1) check (level between 1.0 and 7.0),
  tier           membership_tier not null default 'guest',
  credit_balance bigint not null default 0,   -- fils
  no_show_count  int not null default 0,
  total_spend    bigint not null default 0,   -- fils
  blocked        boolean not null default false,
  blocked_reason text,
  notes          text not null default '',
  created_at     timestamptz not null default now()
);

-- The dedupe guarantee. Digits only, no punctuation, no country-code variants.
create unique index customers_phone_key on customers (phone);
create index customers_name_trgm on customers using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------

create table staff_users (
  id          uuid primary key default gen_random_uuid(),
  auth_uid    uuid unique,                    -- maps to auth.users when auth lands
  name        text not null,
  name_ar     text not null,
  role        staff_role not null,
  phone       text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Recurring series. A large share of revenue is the same four players at 21:00
-- every Tuesday; instances are materialised forward on a rolling window.
-- ---------------------------------------------------------------------------

create table booking_series (
  id               uuid primary key default gen_random_uuid(),
  court_id         uuid not null references courts(id),
  customer_id      uuid not null references customers(id),
  weekday          int not null check (weekday between 0 and 6),
  start_minute     int not null check (start_minute between 0 and 1200),
  duration_minutes int not null check (duration_minutes in (60, 90, 120)),
  from_day         date not null,
  until_day        date,
  party_size       int not null default 4 check (party_size between 1 and 8),
  active           boolean not null default true,
  created_by       uuid not null references staff_users(id),
  created_at       timestamptz not null default now()
);

create table series_exceptions (
  id                uuid primary key default gen_random_uuid(),
  series_id         uuid not null references booking_series(id) on delete cascade,
  day               date not null,
  kind              text not null check (kind in ('skip', 'move', 'price')),
  moved_to_start    timestamptz,
  moved_to_court_id uuid references courts(id),
  override_total    bigint,
  reason            text not null default '',
  unique (series_id, day)
);

-- ---------------------------------------------------------------------------
-- BOOKINGS — and the constraint this whole system is built around.
-- ---------------------------------------------------------------------------

create sequence booking_serial_seq start 4801;

create table bookings (
  id             uuid primary key default gen_random_uuid(),
  serial         bigint not null default nextval('booking_serial_seq'),
  court_id       uuid not null references courts(id),

  -- One range column rather than start/end, so the GiST index and the
  -- exclusion operator work directly on it.
  period         tstzrange not null,

  status         booking_status not null,
  source         text not null check (
                   source in ('web','walk_in','phone','staff','recurring','class','tournament')),

  -- The operating day runs 06:00 -> 02:00, so a 01:00 booking belongs to the
  -- PREVIOUS day's page and till. Stored, not derived at read time, because
  -- every day-scoped query filters on it.
  operating_day  date not null,

  customer_id    uuid references customers(id),
  party_size     int not null default 4 check (party_size between 0 and 8),

  series_id      uuid references booking_series(id) on delete set null,
  series_exception text check (series_exception in ('moved', 'priced')),

  open_match     boolean not null default false,
  level_min      numeric(2,1),
  level_max      numeric(2,1),

  -- The itemised breakdown, exactly as quoted. The receipt prints this and the
  -- audit log quotes it, so it is stored rather than recomputed.
  price_lines    jsonb not null default '[]'::jsonb,
  total          bigint not null default 0,        -- fils
  payment_status payment_status not null default 'unpaid',

  -- Wall-clock expiry for `held`. This is why `status` is in the exclusion
  -- constraint's WHERE clause.
  hold_expires_at timestamptz,

  notes          text not null default '',
  created_by     uuid not null references staff_users(id),
  created_at     timestamptz not null default now(),

  cancelled_at        timestamptz,
  cancelled_by        uuid references staff_users(id),
  cancellation_reason text,
  refund_amount       bigint,
  refund_kind         refund_kind,

  block_reason   text,

  constraint bookings_period_not_empty check (not isempty(period)),
  constraint bookings_hold_has_expiry check (
    (status = 'held') = (hold_expires_at is not null)
  ),
  constraint bookings_level_band check (
    level_min is null or level_max is null or level_max >= level_min
  ),

  -- ========================================================================
  -- THE CONSTRAINT.
  --
  -- No two OCCUPYING bookings may overlap on one court. `held`, `confirmed`
  -- and `blocked` occupy; `cancelled`, `no_show` and `expired` do not, which
  -- is what lets a lapsed hold release its slot without being deleted.
  --
  -- A violation raises SQLSTATE 23P01, which the driver translates into the
  -- same SlotTakenError the in-memory driver throws — so the UI's "just taken"
  -- path is written once and is already correct.
  -- ========================================================================
  constraint bookings_no_overlap exclude using gist (
    court_id with =,
    period   with &&
  ) where (status in ('held', 'confirmed', 'blocked'))
);

create index bookings_operating_day  on bookings (operating_day);
create index bookings_customer       on bookings (customer_id);
create index bookings_series         on bookings (series_id, operating_day);
create index bookings_period_gist    on bookings using gist (period);
create index bookings_open_match     on bookings (operating_day)
  where open_match and status = 'confirmed';
create index bookings_holds          on bookings (hold_expires_at)
  where status = 'held';

-- One instance per series per day. This, plus the sweep's own NOT EXISTS
-- filter, is what stops a non-idempotent cron from duplicating every Tuesday
-- 21:00 in the club within a week.
create unique index bookings_series_day_key
  on bookings (series_id, operating_day)
  where series_id is not null and status in ('held','confirmed');

-- ---------------------------------------------------------------------------
-- Participants — four players, four shares, four payment states.
-- ---------------------------------------------------------------------------

create table booking_participants (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  customer_id uuid references customers(id),
  guest_name  text,
  share       bigint not null default 0,     -- fils
  paid        bigint not null default 0,     -- fils
  paid_at     timestamptz,
  is_booker   boolean not null default false,
  joined_at   timestamptz not null default now(),
  check (customer_id is not null or guest_name is not null)
);

-- A customer cannot join the same match twice.
create unique index booking_participants_unique
  on booking_participants (booking_id, customer_id)
  where customer_id is not null;

create index booking_participants_booking on booking_participants (booking_id);

-- Exactly one booker per booking.
create unique index booking_participants_one_booker
  on booking_participants (booking_id)
  where is_booker;
