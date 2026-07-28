-- ---------------------------------------------------------------------------
-- 0004 — Accounts
--
-- A login, as distinct from the person it belongs to.
--
-- `customers` holds everyone the club has ever taken a booking for, including
-- the walk-in who gave a number at the desk and will never sign in.
-- `staff_users` holds everyone on the rota. `accounts` holds only those who log
-- in, and points at whichever of the two it acts as. Folding the credential
-- into `customers` would mean a nullable password on every walk-in row, or
-- refusing to record a customer until they chose one — and staff take bookings
-- over the phone.
--
-- ⚠️ WHEN SUPABASE AUTH LANDS, THE CREDENTIAL COLUMNS GO.
-- `auth.users` owns the password; this table keeps only the mapping and the
-- role, and `auth_uid` becomes the join. The columns are here because the
-- prototype has to hold a credential somewhere and the file-backed driver holds
-- it in exactly this shape. Do not build anything else on top of them.
-- ---------------------------------------------------------------------------

create table accounts (
  id             uuid primary key default gen_random_uuid(),
  auth_uid       uuid unique,                    -- auth.users, once it exists
  email          text not null,
  password_hash  text,                           -- prototype only; see above
  password_salt  text,                           -- prototype only; see above
  name           text not null,
  role           staff_role not null,
  customer_id    uuid references customers(id) on delete set null,
  staff_id       uuid references staff_users(id) on delete set null,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  last_sign_in_at timestamptz,

  -- A player account acts as a customer; a staff account acts as a staff row.
  -- Neither is required — an owner need not be a customer — but pointing at
  -- both would make "who is this" ambiguous at exactly the moment it matters.
  constraint accounts_one_identity check (
    customer_id is null or staff_id is null
  )
);

-- THE constraint. Two people signing up on one address is prevented HERE, not
-- by the application checking first — "is this email free" followed by "insert"
-- is the same race as "is this slot free" followed by "book", and it is closed
-- the same way. The driver raises EmailTakenError on 23505 against this index,
-- which is the same error the in-memory driver raises, so the sign-up screen's
-- "that email is taken" path is already correct.
--
-- Lowercased, because Ahmed@ and ahmed@ are one person and one login.
create unique index accounts_email_key on accounts (lower(email));

create index accounts_customer_idx on accounts (customer_id) where customer_id is not null;
create index accounts_staff_idx on accounts (staff_id) where staff_id is not null;

-- ---------------------------------------------------------------------------
-- RLS. Consistent with 0003: staff read through the service path, and a signed
-- in player may read exactly their own row and nothing about anyone else's.
-- ---------------------------------------------------------------------------

alter table accounts enable row level security;

create policy accounts_self_read on accounts
  for select
  using (auth_uid = (select auth.uid()));

-- Deliberately no self-update policy: role and active are not the account
-- holder's to change, and a password change will go through auth.users rather
-- than through this table.
