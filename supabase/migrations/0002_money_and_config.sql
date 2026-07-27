-- Kagu Padel — pricing, policy, money, and the rest of the club.
--
-- ⚠️ AUTHORED, NOT APPLIED.
--
-- Everything the client will plausibly want different next month is a ROW with
-- an editing screen, not a branch in code: rates, promos, cancellation tiers,
-- opening hours. "Change Friday evening rates" must never be a deploy.

-- ---------------------------------------------------------------------------
-- Pricing. Highest priority wins; ties break on the more specific rule.
-- ---------------------------------------------------------------------------

create table pricing_rules (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  label_ar    text not null,
  priority    int not null default 0,
  weekdays    int[] not null default '{}',      -- empty = every day
  from_minute int check (from_minute between 0 and 1200),
  to_minute   int check (to_minute   between 0 and 1200),
  court_ids   uuid[] not null default '{}',     -- empty = every court
  court_tags  text[] not null default '{}',
  tiers       membership_tier[] not null default '{}',
  durations   int[] not null default '{}',
  amount      bigint not null,                  -- fils, for the whole slot
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (from_minute is null or to_minute is null or to_minute > from_minute)
);

create table promo_codes (
  id        uuid primary key default gen_random_uuid(),
  code      text not null,
  label     text not null,
  label_ar  text not null,
  kind      text not null check (kind in ('percent', 'amount')),
  value     bigint not null check (value >= 0),
  from_day  date,
  to_day    date,
  max_uses  int,
  uses      int not null default 0,
  active    boolean not null default true,
  check (kind <> 'percent' or value <= 100)
);

create unique index promo_codes_code_key on promo_codes (upper(code));

-- Cancellation policy as data. The applicable tier is the LARGEST
-- hours_before the customer still satisfies. Under the shortest window no tier
-- matches and nothing is returned — expressed by absence rather than a 0% row,
-- which keeps the copy at the counter honest.
create table cancellation_policies (
  id             uuid primary key default gen_random_uuid(),
  label          text not null,
  label_ar       text not null,
  hours_before   int not null check (hours_before >= 0),
  refund_percent int not null check (refund_percent between 0 and 100),
  outcome        refund_kind not null,
  priority       int not null default 0,
  active         boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Till and payments. For a cash-heavy venue this is the module that pays for
-- the system, because it is the one that catches theft.
-- ---------------------------------------------------------------------------

create table till_sessions (
  id             uuid primary key default gen_random_uuid(),
  operating_day  date not null,
  opened_by      uuid not null references staff_users(id),
  opened_at      timestamptz not null default now(),
  opening_float  bigint not null default 0,
  closed_by      uuid references staff_users(id),
  closed_at      timestamptz,
  counted_cash   bigint,
  variance       bigint,                       -- counted - (float + cash taken)
  variance_note  text not null default '',
  check ((closed_at is null) = (counted_cash is null))
);

-- Only one shift open at a time.
create unique index till_sessions_one_open
  on till_sessions ((true))
  where closed_at is null;

create table product_sales (
  id            uuid primary key default gen_random_uuid(),
  serial        bigint not null,
  booking_id    uuid references bookings(id) on delete set null,
  customer_id   uuid references customers(id),
  operating_day date not null,
  lines         jsonb not null default '[]'::jsonb,
  total         bigint not null default 0,
  payment_status payment_status not null default 'unpaid',
  sold_by       uuid not null references staff_users(id),
  sold_at       timestamptz not null default now()
);

create table payments (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid references bookings(id) on delete set null,
  sale_id         uuid references product_sales(id) on delete set null,
  participant_id  uuid references booking_participants(id) on delete set null,
  amount          bigint not null,             -- fils; negative for a refund
  method          text not null check (
                    method in ('cash','card','wallet','credit','transfer')),
  taken_by        uuid not null references staff_users(id),
  taken_at        timestamptz not null default now(),
  till_session_id uuid references till_sessions(id),
  refund_of       uuid references payments(id),
  note            text not null default '',
  -- A payment cannot be stamped in the future; it would land in a shift that
  -- has not happened yet and show as a phantom shortfall.
  constraint payments_not_future check (taken_at <= now() + interval '1 minute')
);

create index payments_taken_at on payments (taken_at);
create index payments_booking  on payments (booking_id);
create index payments_session  on payments (till_session_id);

-- ---------------------------------------------------------------------------
-- Coaching
-- ---------------------------------------------------------------------------

create table coaches (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  name_ar             text not null,
  phone               text not null,
  commission_percent  int not null default 50 check (commission_percent between 0 and 100),
  active              boolean not null default true
);

create table coach_availability (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references coaches(id) on delete cascade,
  weekday     int not null check (weekday between 0 and 6),
  from_minute int not null,
  to_minute   int not null,
  check (to_minute > from_minute)
);

-- A class consumes a real court slot, so it hangs off a booking and inherits
-- the exclusion constraint for free.
create table class_sessions (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid not null references coaches(id),
  booking_id     uuid not null references bookings(id) on delete cascade,
  title          text not null,
  title_ar       text not null,
  capacity       int not null check (capacity > 0),
  price_per_head bigint not null default 0,
  level_min      numeric(2,1),
  level_max      numeric(2,1)
);

create table class_enrolments (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references class_sessions(id) on delete cascade,
  customer_id uuid not null references customers(id),
  paid        bigint not null default 0,
  attended    boolean,
  unique (class_id, customer_id)
);

-- ---------------------------------------------------------------------------
-- Pro shop / F&B
-- ---------------------------------------------------------------------------

create table products (
  id           uuid primary key default gen_random_uuid(),
  sku          text not null unique,
  name         text not null,
  name_ar      text not null,
  category     text not null check (
                 category in ('equipment','consumable','drink','food','rental')),
  price        bigint not null default 0,
  stock        int,                            -- null = not stock-tracked
  low_stock_at int,
  active       boolean not null default true,
  -- Stock can go to zero but never below it.
  constraint products_stock_non_negative check (stock is null or stock >= 0)
);

-- ---------------------------------------------------------------------------
-- Tournaments — they block courts in bulk, which is why the blocking model
-- (bookings with status 'blocked') exists from the start.
-- ---------------------------------------------------------------------------

create table tournaments (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  name_ar      text not null,
  format       text not null check (
                 format in ('americano','mexicano','round_robin','knockout')),
  day          date not null,
  start_minute int not null,
  end_minute   int not null,
  court_ids    uuid[] not null default '{}',
  entry_fee    bigint not null default 0,
  capacity     int not null check (capacity > 0),
  level_min    numeric(2,1),
  level_max    numeric(2,1),
  status       text not null default 'draft' check (
                 status in ('draft','open','running','done','cancelled')),
  check (end_minute > start_minute)
);

create table tournament_entries (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  customer_id   uuid not null references customers(id),
  paid          bigint not null default 0,
  points        int not null default 0,
  unique (tournament_id, customer_id)
);

-- ---------------------------------------------------------------------------
-- Audit — append-only, and enforced as such below in 0003.
-- ---------------------------------------------------------------------------

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  at          timestamptz not null default now(),
  actor_id    uuid not null references staff_users(id),
  action      text not null,
  entity      text not null,
  entity_id   text not null,
  -- Already resolved to readable text: the log must be readable without joins,
  -- because it is read during an argument about money.
  summary     text not null,
  summary_ar  text not null default '',
  amount      bigint,
  reason      text
);

create index audit_log_at     on audit_log (at desc);
create index audit_log_actor  on audit_log (actor_id, at desc);
create index audit_log_entity on audit_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Notifications. WhatsApp is the channel customers actually read; email is
-- not. The sender is a worker over this queue.
-- ---------------------------------------------------------------------------

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  channel    text not null default 'whatsapp' check (channel in ('whatsapp','sms','email')),
  kind       text not null,
  to_address text not null,
  body       text not null,
  booking_id uuid references bookings(id) on delete set null,
  queued_at  timestamptz not null default now(),
  sent_at    timestamptz,
  error      text
);

create index notifications_pending on notifications (queued_at) where sent_at is null;
