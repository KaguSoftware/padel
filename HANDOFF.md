# Kagu Padel — Handoff

> Read this first in a fresh chat. Companions: [PRODUCT.md](PRODUCT.md) ·
> [DESIGN.md](DESIGN.md) · [PERFORMANCE.md](PERFORMANCE.md) ·
> [supabase/migrations/](supabase/migrations/) ·
> [src/data/supabase/README.md](src/data/supabase/README.md) ·
> plan file: `C:\Users\MnS\.claude\plans\tech-stack-nextjs-16-2-humble-sloth.md`

## Working style

- **Git author is Parsa only — no `Co-Authored-By` trailers, ever.** Applies to
  every commit and to PR bodies.
- Propose with a recommendation before locking user-facing or schema decisions.
- Keep this file in lockstep with the work.

## What this is

A padel club booking platform and operations console for a single Gulf venue:
five courts, bilingual AR/EN with real RTL, Asia/Dubai, AED. Two surfaces at
full parity — a player-facing booking app and a staff console — on one shared
domain and data layer. See [PRODUCT.md](PRODUCT.md).

**There is no database.** Everything runs on authored sample data behind a
repository boundary. The SQL is written but unapplied.

## Stack

Next.js **16.2.12** (App Router, Turbopack, `staleTimes`) · React 19.2 ·
TypeScript strict · Tailwind **v4** (`@theme` in `globals.css`, no config file) ·
next-intl 4 · zod 4 · date-fns 4 + `@date-fns/tz` · vitest 4. Dev OS: Windows 11.
Deploy target Vercel; config is `vercel.ts` (not `vercel.json`).

## Current status — ✅ everything below is built, typechecked, linted, built and smoke-tested

| | |
|---|---|
| `npx vitest run` | **104 passed**, 5 files |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean, zero warnings |
| `npm run build` | 21 routes, compiles |
| Routes smoke-tested | all console + play routes, EN and AR, HTTP 200 |

⚠️ **Not yet clicked through by a human.** Every route has been fetched and
renders, and the domain is heavily unit-tested, but nobody has dragged a
booking, taken a cash payment, or closed a shift in a browser. That is the next
thing worth doing — see *Browser pass* below.

### The design went through one full replacement

The first build shipped a "club ledger" world — green-bar ledger paper, indigo
ink, rubber stamps. **Parsa rejected it as flat and unexciting, then rejected
the console in the same terms.** It was replaced wholesale by **THE BOARD**: a
floodlit glass court, drenched court blue, optic-yellow "available" marks,
Archivo Black line paint, and Doto dot-matrix board digits. One world across
both surfaces — the console is the same court seen from the control desk.

[DESIGN.md](DESIGN.md) is the authority and matches what is built. **The old
ledger world is gone; do not reintroduce paper, ink, serifs, or engraved
ornament.** `src/ui/Guilloche.tsx` was deleted for this reason.

## Architecture — the four rules that matter

**1. Double-booking is prevented by the DATABASE, never by application code.**
`supabase/migrations/0001_core.sql` carries

```sql
constraint bookings_no_overlap exclude using gist (
  court_id with =, period with &&
) where (status in ('held','confirmed','blocked'))
```

The in-memory driver reproduces that check exactly and throws the **same
`SlotTakenError`** the Supabase driver will throw on `23P01`. So the UI's "just
taken" path is written once and is already correct.
⚠️ **Never add a pre-flight availability check.** Read-then-write is precisely
the race the constraint closes.

**2. Availability is COMPUTED, never stored.** Opening hours (`availability_templates`)
+ exception rows (`availability_exceptions`) resolved on read. Ramadan hours are
rows, not a code branch. There is no table of materialised slots.

**3. Rules the client will change are ROWS.** Rates, promos, cancellation tiers,
opening hours — all config with editing screens. "Change Friday evening rates"
must never be a deploy.

**4. Count waves, not queries.** One `Promise.all` per route, in
`src/data/loaders.ts`. A round-trip is ~305–330ms; a query added to an existing
wave is ~3–12ms. **Full detail and the measured numbers are in
[PERFORMANCE.md](PERFORMANCE.md) — read it before touching data access.**

## File map

| File | What it does |
|---|---|
| [src/domain/](src/domain/) | **Pure, no I/O, fully tested.** Never imports from `data/` or `app/` |
| [src/domain/slots.ts](src/domain/slots.ts) | The slot grid, generated on read. One place decides whether a slot is free |
| [src/domain/pricing.ts](src/domain/pricing.ts) | Table-driven rate card. Returns an itemised breakdown, never a number. Matches on the slot's **start** so duration never splits a rate band |
| [src/domain/recurrence.ts](src/domain/recurrence.ts) | Weekly series + per-instance exceptions. `instancesToMaterialise` is what makes the sweep idempotent |
| [src/domain/cancellation.ts](src/domain/cancellation.ts) | Policy tiers. Refunds what was **paid**, never the headline price |
| [src/domain/split.ts](src/domain/split.ts) | Four-way split; the booker absorbs the odd fils, deterministically |
| [src/domain/errors.ts](src/domain/errors.ts) | `SlotTakenError` — the contract both drivers share |
| [src/data/ports.ts](src/data/ports.ts) | The repository contract. **Both drivers implement this identically, including failure modes** |
| [src/data/loaders.ts](src/data/loaders.ts) | One wave per route. A new stat goes INSIDE the existing `Promise.all` |
| [src/data/query.ts](src/data/query.ts) | `rowsOrThrow(label, …)` — every query throws with a label. A failed availability read must never render as an empty day |
| [src/data/memory/driver.ts](src/data/memory/driver.ts) | The in-memory driver. `assertFree` is the exclusion constraint in JS |
| [src/data/memory/driver.test.ts](src/data/memory/driver.test.ts) | **The acceptance suite for the Supabase driver.** Parameterise it over both when that lands |
| [src/data/seed/](src/data/seed/) | ⚠️ Synthetic data, deliberately uneven. Regenerates relative to "today" |
| [src/lib/money.ts](src/lib/money.ts) | Integer fils + branded `Fils`. **Never inline a currency figure** |
| [src/lib/time.ts](src/lib/time.ts) | `operatingDayOf` — **the 06:00→02:00 rule lives here and nowhere else** |
| [src/lib/text.ts](src/lib/text.ts) | `fold()` Arabic-aware search, `normalisePhone()` dedupe key, `withinBound()` null-safe filters |
| [src/auth/claims.ts](src/auth/claims.ts) | `getClaims()` — **zero I/O**. Becomes local JWT verification, never `getUser()` |
| [src/auth/guard.ts](src/auth/guard.ts) | ONE guard. `require*` throws (for actions); `allow*` returns null (for pages) |
| [src/ui/board.tsx](src/ui/board.tsx) · [src/ui/court.tsx](src/ui/court.tsx) | The Board's own components: panels, flap rows, digits, court plan, rebound trace |
| [src/app/[locale]/console/calendar/](src/app/[locale]/console/calendar/) | The day book. `EntryLine.tsx` is the command-sentence create flow |
| [supabase/migrations/](supabase/migrations/) | Authored, **unapplied**. `0001` core + the constraint, `0002` money/config, `0003` RLS + jobs |

## Gotchas / hard-won

- ⚠️ **The operating day runs 06:00 → 02:00.** A 01:00 booking belongs to the
  PREVIOUS day's board and till. `operatingDayOf()` owns this; nothing else
  recomputes it. `new Date().toISOString().slice(0,10)` is a UTC bug here.
- ⚠️ **`Number(null)` is `0`**, so a null price/level/stock passes every max
  filter as though it were free. Use `withinBound()`. Pinned by tests.
- ⚠️ **Arabic search must fold alef forms.** A customer saved as "أحمد" is
  unfindable by typing "احمد" — which is what staff actually type. `fold()`
  handles alef/ya/ta-marbuta/tatweel/diacritics/digits. Pinned by tests.
- ⚠️ **A payment must never be stamped in the future.** It lands in a till
  session that has not happened and shows as a phantom shortfall. The seed used
  to do this; the till now bounds its window at both ends, and
  `0002_money_and_config.sql` has a CHECK.
- ⚠️ **Page guards must not throw.** A front-desk member of staff opening
  `/console/reports` is navigating, not erroring. Use `allowManager()` +
  `<Denied>`, not `requireManager()`. This shipped as a 500 first time round.
- ⚠️ **PowerShell `Get-Content -Raw` reads as ANSI** and will mojibake every
  Arabic string in the repo. Use `[System.IO.File]::ReadAllText(path, utf8)`.
- ⚠️ **Optic yellow (`--ball`) means "available or live" and nothing else.** If
  it leaks onto anything decorative the whole board stops meaning anything.
- ⚠️ **Do not add a Vercel `regions` setting by copying it.** On one sibling
  project it was the biggest single win; on another the same change would have
  made things slower. Measure first. See PERFORMANCE.md.

## Roadmap / next steps

1. **← ACTIVE: browser pass.** Nothing here has been driven by a human:
   - Day book: drag a booking to another court → it moves. Drag it onto an
     occupied slot → it snaps back and says "just taken".
   - Open two tabs on `/play`, hold the same 21:00 slot in both → exactly one
     gets to checkout, the other sees "Just taken".
   - Let a hold lapse on the checkout page → the amber bar empties, the card
     reads LAPSED, and the slot is bookable again.
   - Entry line: pick court → hour → member → duration, write the entry.
   - Take a cash payment, then close the shift with a deliberate AED 35
     shortfall → it refuses to close without an explanation.
   - Switch role to Front desk → `/console/reports` says "Not your board"
     rather than 500-ing. Switch to Owner → it opens.
   - Every screen in `ar`, including the day book grid mirroring.
2. **Decide the payment provider.** Checkout is built against a simulated
   adapter; "pay now" records a card payment so the till and receipt behave
   correctly end to end. No provider is assumed.
3. **Check WhatsApp Business API eligibility for the client's entity** before
   promising it. `NotificationPort` currently queues to a log. SMS via a local
   aggregator is the documented fallback.
4. **Then Supabase.** Follow [src/data/supabase/README.md](src/data/supabase/README.md)
   exactly — especially enabling ES256 signing keys *first*, and making
   `23P01` become `SlotTakenError` and nothing else.

## Deliberately partial — scope ledger

| Area | What shipped | Intended full shape |
|---|---|---|
| Pricing/policy editing | Read-only screens over the config rows | Full CRUD forms — the rows and the engine already support it |
| Tournaments | List, entries, court blocking, payment state | Bracket generation and americano/mexicano round scheduling |
| Coaching | Coaches, classes, rosters, commission computed at read time | Coach self-service and lesson booking from the player app |
| Pro shop | Sell to a court tab or standalone, stock decrements | Purchase orders, supplier records, stock-take |
| Reports | Utilisation by hour and court, revenue by source, no-show rate | Export, date-range picker beyond 7/30, per-agent breakdowns |
| Notifications | Queued to a log with the real message shape | A worker over the queue once the channel is confirmed |
| Auth | Signed cookie + role switcher, real server-side capability checks | Supabase Auth; the `Claims` shape is already the target shape |

## Replacement list — everything synthetic

⚠️ **Every name, phone number, price, booking, coach, product and figure in the
app is authored sample data.** Nothing is a real customer or a real rate.
Before any client demo that implies otherwise, replace:
`src/data/seed/reference.ts` (courts, hours, rate card, promos, cancellation
tiers, staff, coaches, products, 26 customers) and the venue block at the top of
that file. The generated fortnight of trading in `src/data/seed/bookings.ts`
regenerates itself and needs no editing.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000  → redirects to /en
npm run build
npx vitest run     # 104 tests
npx tsc --noEmit
npm run lint
```

Role switching is in the console's left rail (bottom). Owner and Manager see
the ledgers, staff and audit; Front desk does not.

The Vercel CLI is **not installed** — `npm i -g vercel` before any deploy work.
