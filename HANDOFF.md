# Kagu Padel — Handoff

> Read this first in a fresh chat. Companions: [PRODUCT.md](PRODUCT.md) ·
> [DESIGN.md](DESIGN.md) · [PERFORMANCE.md](PERFORMANCE.md) ·
> [supabase/migrations/](supabase/migrations/) ·
> [src/data/supabase/README.md](src/data/supabase/README.md)

## Working style

- **Git author is Parsa only — no `Co-Authored-By` trailers, ever.** Applies to
  every commit and to PR bodies.
- Propose with a recommendation before locking user-facing or schema decisions.
- **Plan mode for anything direction-setting**; Parsa approves before build.
- **[DESIGN.md](DESIGN.md) is a contract, not a mood board.** It can be amended —
  it has been, twice — but never silently ignored. If the build departs from it,
  the document changes in the same pass.
- **Read the framework docs before writing code.** Per [AGENTS.md](AGENTS.md),
  this is not the Next.js in your training data: read the relevant guide in
  `node_modules/next/dist/docs/`.
- Keep this file in lockstep with the work.

## What this is

A padel club booking platform and operations console for a single Gulf venue:
five courts, bilingual AR/EN with real RTL, Asia/Dubai, AED. Two surfaces at
full parity — a player-facing booking app and a staff console — on one shared
domain and data layer. See [PRODUCT.md](PRODUCT.md).

**There is no database.** Everything runs on authored sample data behind a
repository boundary. The SQL is written but unapplied.

## Stack

Next.js **16.2.12** (App Router, Turbopack, `staleTimes`) · React **19.2.4** ·
TypeScript strict · Tailwind **v4** (`@theme` in `globals.css`, no config file) ·
next-intl 4 · zod 4 · date-fns 4 + `@date-fns/tz` · vitest 4. Dev OS: Windows 11.
Deploy target Vercel; config is `vercel.ts` (not `vercel.json`).

**Five fonts, all reachable:** Archivo Black (painted headings), Doto (board
figures only), Archivo (body + every label), Noto Kufi Arabic (painted Arabic),
Almarai (Arabic body). Bodoni Moda, Courier Prime and Noto Naskh were removed on
2026-07-28 — they were downloaded on every cold visit and referenced by nothing.

## Current status — ✅ everything below is built, typechecked, linted, built and smoke-tested

| | |
|---|---|
| `npx vitest run` | **146 passed**, 7 files |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | clean, zero warnings |
| `npx next build` | 24 routes, compiles |
| Routes smoke-tested | every admin route × EN and AR — 22 combinations, HTTP 200 from `next start` |

⚠️ **Not yet clicked through by a human.** Every route has been fetched and
renders, and the domain is heavily unit-tested, but nobody has dragged a
booking, taken a cash payment, or closed a shift in a browser. That is the next
thing worth doing — see *Browser pass* below.

### 2026-07-28 — the admin comfort pass, and the day board rebuilt

Parsa's brief: *"the frontend is great and all, but the admin panel might get
annoying when the workers are looking at it for hours and hours. Redo the admin
panel UI, it should be spacious. Also redo the entire daybook tab."*

Three measured causes, all fixed.

**1. The dot-matrix face was carrying words.** `font-board` (Doto) appeared 75×
in `admin/` against `font-body` once — almost all of it running labels at 9–11px,
uppercase, tracked anywhere between 0.07em and 0.28em, in ten different values
for one idiom. Doto is superb on a clock and punishing as label text for an
eight-hour shift. It now carries **figures only**; `.board-label` (Archivo, 13px,
sentence case, one tracking value) carries every label. [DESIGN.md](DESIGN.md)'s
Type table was amended to match.

**2. Nothing had room.** Panels `p-5` → `p-6/p-7`, table cells `py-2.5` → 52px
rows, grids `gap-6` → `gap-8`, form fields 16px (below that iOS zooms the page on
focus). Page bodies cap at `--desk-max` (110rem) and centre. Admin heads dropped
`.court-surface` — the four floodlight pools are the world at the door and glare
at the counter — and the glass pane dropped its backdrop blur.

**3. The board was on the wrong axis, and two of its three gestures did not
work.** Courts-as-columns × 30-minute rows made a 06:00–02:00 day ~40 bands tall:
four hours visible, and a 90-minute booking was a 96×120px sliver. **Courts are
now lanes and time runs across.** The whole club is 4–6 rows and seven hours fit
across a tablet.

- Move/resize/draw are **Pointer Events** now. The old board used HTML5
  drag-and-drop, which does not fire on touch — on a product whose thesis is
  "the tablet is the whole product", the move gesture did not exist on the
  tablet. All three have keyboard equivalents (`m` to pick up, arrows, Enter).
- **The peek sheet** replaced a full page navigation. Tapping a booking used to
  destroy your place on the board, dozens of times a shift, usually mid-sentence
  with someone at the counter.
- A **week strip** with per-day utilisation replaced `‹ Today ›`; an **attention
  filter** (holds / unpaid / open seats / blocked) dims rather than hides, because
  hiding a booking on an operations board is a hazard.
- The board opens scrolled to *now*, not to 06:00.

Correctness fixes carried in the rebuild:

- **Closure was computed per COURT, not per band** (`closed = !c.hasWindow`), so
  a shortened Ramadan window or a two-hour maintenance block drew as fully open
  on a board whose server rejects every write into it. Per-cell state now crosses
  the RSC boundary as closed *runs*.
- **Client occupancy disagreed with the server.** It excluded only `cancelled`
  and `expired`; `OCCUPYING_STATUSES` also excludes `no_show`. A no-showed slot
  was un-bookable on the board and bookable via the API.
- **`resize` is a new port method**, routed through the same exclusion constraint
  — lengthening collides with what sits *after* a booking, which a move never
  does. It re-quotes rather than scaling the total (the tariff is not linear in
  duration) and refuses a discounted booking outright, because someone approved
  that discount and the audit log has their name on it.
- The calendar's 40-line server-side `strings` bag is gone; client components use
  `useTranslations` directly. It was hiding three bugs, including a hardcoded
  `locale === "ar" ? "مقاعد" : "SEATS"` and an `openSeats` plural smuggled
  through a `.replace("0","{n}")`.
- **Three Google font families deleted** (Bodoni Moda, Courier Prime, Noto
  Naskh) — loaded on every cold visit, referenced by no token and no class.
- Every empty state now names what belongs there and how it gets there, instead
  of saying "Nothing here yet".
- The rail's hover was `border-s-ball`, breaking the one hard palette rule. Nav
  state is line paint; the rail also finally says which module you are in.

### 2026-07-28 — four defects found by looking at it on a phone

The first real phone screenshot found three things that route smoke tests
cannot see, all fixed (typechecked, linted, 104 tests green, EN + AR
re-fetched):

1. **The mobile drawer opened empty.** Root cause below under *gotchas* — a
   `backdrop-filter` on the site header was the containing block for the
   drawer's `position: fixed`. It now portals to `<body>`.
2. **Four Tailwind classes were silently doing nothing** (`inset-inline-start-0`
   and friends are not v4 utilities). One of them was the reason the drawer was
   never pinned to an edge.
3. **The nav lit "Book a court" on every `/play/*` route.** Prefix matching;
   now longest-match.
The landing page's order-of-play board was rebuilt as a time × court grid in
the same pass and **reverted at Parsa's request — the court-per-row board is
the one he wants.** Do not redo it.

Then the **console day book's time ruling** was fixed, which is what "the
calendar is hard to read" actually meant:

- Every 30-minute band is now ruled and labelled, not just the hour. A 19:30
  card used to float between two hour lines with nothing marking 19:30.
- **The now line is at the real minute and moves.** It was quantised to the
  bottom of the current 30-minute band (up to half an hour wrong) *and*
  computed once at mount, so a tablet left open all evening froze it. It now
  runs off the shared 1Hz ticker and carries the clock in a sticky chip.
- Cards sit flush to their column and to the ruling — they were inset 4px each
  side and cut 2px short, so they never aligned with anything.
- **`--row-px` is now the single source of truth** for row height, cell height
  and every card's `top`/`height`. It is 44px, up from 30px, so an empty cell
  finally meets the touch floor this product sets for itself; 48px from 640px
  up, where the screen is the front desk's tablet.

Scroll motion was added to the landing page at the same time: the court's line
plan marks itself out as you descend, and the court cards land on the board's
existing flap. Both are scroll-timeline driven and fall back to the finished
state where scroll timelines are unsupported. **Neither has been watched in a
browser yet** — see the browser pass.

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

### 2026-07-28 — accounts, and the console became /admin

**`/console` is now `/admin`.** Every path, `ConsoleMobileNav` → `AdminMobileNav`,
and the guards with it: `requireConsole`/`allowConsole`/`CONSOLE_ROLES`/
`view_console` are now `requireAdmin`/`allowAdmin`/`ADMIN_ROLES`/`view_admin`.
`/:locale/console/:path*` redirects to the new path carrying the deep path, so a
front-desk tablet on a pinned tab keeps working.

**There are real logins now.** Public sign-up at `/account/sign-up`, sign-in at
`/account/sign-in`, and an owner-only account creator on `/admin/staff`. Both
write the same `Claims` cookie the role switcher writes, so the session shape is
unchanged and the switcher still works for demoing roles.

- **`Account` is a login; `Customer` is a person.** Signing up attaches the
  login to the existing customer row if that phone number is already known —
  a regular who has been booked in by the desk for a year and then signs up
  online is one human, and a second customer row would split their history,
  credit and no-show count in half.
- **Accounts are the one thing written to disk**, at `.data/accounts.json`
  (gitignored). Everything else is regenerated each boot, which is right for
  synthetic trading and wrong for a login.
- Passwords are scrypt from `node:crypto`. No dependency was added.
- `supabase/migrations/0004_accounts.sql` carries the table and
  `accounts_email_key`, the unique index that `EmailTakenError` mirrors.

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

**1b. Duplicate emails are prevented by the same mechanism.**
`accounts_email_key` is a unique index on `lower(email)`, and both drivers raise
**`EmailTakenError`** — the memory driver from its own check, the Supabase driver
from `23505`. Same shape as `SlotTakenError`, same rule: **never check-then-
insert.** "Is this email free" followed by "insert" is the same race as "is this
slot free" followed by "book".

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
| [src/auth/claims.ts](src/auth/claims.ts) | `getClaims()` — **zero I/O**. Becomes local JWT verification, never `getUser()`. Owns the `SIGNED_OUT` sentinel |
| [src/auth/password.ts](src/auth/password.ts) · [src/auth/policy.ts](src/auth/policy.ts) | scrypt hash/verify (`server-only`) and the length rule (importable by client code). Deleted, not ported, when Supabase Auth lands |
| [src/app/actions/account.ts](src/app/actions/account.ts) | `signUp` / `signIn` / `signOut` / `createStaffAccount`. Sign-up creates the account *before* the customer so a taken email leaves no orphan row |
| [src/data/memory/accounts.ts](src/data/memory/accounts.ts) | The accounts port. **Reads the file every call** — read the caching gotcha before "optimising" it |
| [src/data/local/file.ts](src/data/local/file.ts) | Write-then-rename JSON persistence for `.data/`. A truncated file on a killed process reads as a wipe |
| [src/auth/guard.ts](src/auth/guard.ts) | ONE guard. `require*` throws (for actions); `allow*` returns null (for pages) |
| [src/app/globals.css](src/app/globals.css) | **All tokens.** `@theme` palette and faces, `.board-label`, `.painted`, `.board-digit`, the lane metrics, the z-ladder, the admin comfort layer |
| [src/ui/primitives.tsx](src/ui/primitives.tsx) | The staff-facing grammar: `Panel`, `InkButton`, `Reading`, `BoardLabel`, `Segmented`, `Skeleton`, fields |
| [src/ui/PageShell.tsx](src/ui/PageShell.tsx) | Page head (`bleed` for the board) + `LedgerTable`/`LedgerRow`/`Cell` |
| [src/ui/Sheet.tsx](src/ui/Sheet.tsx) | The peek/compose sheet. Portalled, focus-trapped, side sheet ≥lg and bottom sheet below |
| [src/ui/board.tsx](src/ui/board.tsx) · [src/ui/court.tsx](src/ui/court.tsx) | The **public** surface's components: panels, flap rows, digits, court plan, rebound trace. `board.tsx` is imported zero times by `admin/` — that is the cleanest fault line in the codebase |
| [src/ui/Drawer.tsx](src/ui/Drawer.tsx) | The one mobile drawer, shared by both surfaces. **Portals to `<body>`** — read the `backdrop-filter` gotcha before changing it |
| [src/app/[locale]/admin/nav.ts](src/app/[locale]/admin/nav.ts) | The console's destinations, declared ONCE. The list used to exist twice because a server component cannot pass component refs to a client one; it passes a mark *name* now |
| [src/app/[locale]/admin/calendar/geometry.ts](src/app/[locale]/admin/calendar/geometry.ts) | The board's arithmetic. Pure, and [tested](src/app/[locale]/admin/calendar/geometry.test.ts) |
| [src/app/[locale]/admin/calendar/useBoardGesture.ts](src/app/[locale]/admin/calendar/useBoardGesture.ts) | Move / resize / draw on Pointer Events, hit-testing `data-band-*` |
| [src/app/[locale]/admin/calendar/Board.tsx](src/app/[locale]/admin/calendar/Board.tsx) | The board: optimistic move/resize, keyboard grid, now-rule, filters |
| [src/app/[locale]/admin/finances/](src/app/[locale]/admin/finances/) | Cash book, ledgers, rate card and audit behind one nav entry. Its sub-rail only offers what your role can open |
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
  `/admin/reports` is navigating, not erroring. Use `allowManager()` +
  `<Denied>`, not `requireManager()`. This shipped as a 500 first time round.
- ⚠️ **PowerShell `Get-Content -Raw` reads as ANSI** and will mojibake every
  Arabic string in the repo. Use `[System.IO.File]::ReadAllText(path, utf8)`.
- ⚠️ **Optic yellow (`--ball`) means "available or live" and nothing else.** If
  it leaks onto anything decorative the whole board stops meaning anything.
- ⚠️ **The page never scrolls sideways.** `body { overflow-x: clip }` plus a
  `.scroll-x` container on every wide surface (day board, every table, the
  utilisation chart). It is `clip`, not `hidden` — `hidden` would make body a
  scroll container and silently break every sticky header in the app.
- ⚠️ **The day board's court rail is `position: sticky`** at the inline start.
  Without it you scroll to 21:00 and no longer know which court you are looking
  at. Widths come from `--rail-w`/`--slot-w`/`--lane-h`, which narrow below 640px
  so three hours plus the court names fit on a 375px screen.
- ⚠️ **The board is pinned `dir="ltr"` and time runs left-to-right in both
  locales.** This is the existing chart-axis rule in [DESIGN.md](DESIGN.md)
  applied to what became a time axis; everything with words in it (the rail, the
  cards, the sheets) still mirrors. Do not "fix" it by mirroring the day.
- ⚠️ **Deleting a file while `next dev` is running kills the Turbopack worker.**
  It surfaces as `Error: Jest worker encountered 2 child process exceptions,
  exceeding retry limit`, with no stack and no clue. It is not a code bug —
  restart the dev server, and remove `.next` if it persists. This cost time on
  2026-07-28 when `DayBook.tsx` and `EntryLine.tsx` were removed under a running
  watcher. **The dev log swallows real render errors too**; to see one, run
  `npx next build` or `npx next start` and hit the route.
- ⚠️ **The React Compiler lint is strict in two ways worth knowing before you
  fight it.** (1) A ref created inside a hook, returned, and then attached with
  `ref={...}` is `react-hooks/refs` — refs are owned by the component and passed
  *into* hooks, which is why `useBoardGesture` takes `scrollerRef` as an option.
  (2) Resetting state inside an effect is an error — key the component instead,
  which is why `<Compose>` is keyed on the drawn span.
- ⚠️ **A union discriminant must be ONE literal per member.** A `kind: "card" |
  "handle"` member does not narrow; splitting it into two members does.
- ⚠️ **Never cache a file-backed collection in a module closure.** The accounts
  port did, and Next hands a server action and a page render *different module
  instances* — so an account created down one path was invisible down the other,
  and a staff login could be created and then fail to sign in. Same thing across
  workers or processes in any real deployment. It now reads the file on every
  call and mutates read-modify-write; a stale snapshot written back would
  silently delete rows another instance had added. Pinned by two tests in
  `src/auth/accounts.test.ts`.
- ⚠️ **`server-only` is Next's, not a package.** It is why `password.ts` cannot
  be imported by a client component — importing `MIN_PASSWORD_LENGTH` from it
  pulled scrypt into the browser bundle, which the marker caught. The length
  rule therefore lives in `src/auth/policy.ts`, which carries no marker: the
  rule is not a secret, the hashing is. Vitest aliases `server-only` to
  `src/test/server-only-stub.ts`, because there is no such package to resolve.
- ⚠️ **Signing out writes a `signed-out` sentinel rather than clearing the
  cookie.** An absent cookie is what a first-time visitor has, and the prototype
  deliberately opens as the front desk so `/admin` is reviewable without seeding
  a login. Clearing the cookie put the user straight back to being staff, which
  read as sign-out being broken.
- ⚠️ **`.data/` holds real credentials** for whoever signed up on this machine.
  It is gitignored. It also means the accounts survive `npm run dev` restarts
  but **not** a deploy to a read-only or ephemeral filesystem — Vercel's lambdas
  will lose them. `DATA_DIR` can point elsewhere; Supabase Auth ends this.
- ⚠️ **`--slot-w` / `--lane-h` / `--rail-w` are the day board's single source of
  truth.** The ruling, the band sizes and every card's inline offset and width
  all `calc()` off them. **Never reintroduce a JS pixel constant for band size**
  — an early version had the card maths in JS and the ruling in CSS and they
  disagreed by 2px on every card. If you need a pixel decision ("is there room
  for a second line"), decide it from the booking's *duration*, not from a
  measured height. `BookingCard`'s three content tiers do exactly that.
- ⚠️ **`.lane` carries `content-visibility: auto`, which brings paint
  containment** — anything absolutely positioned inside a lane that overflows it
  gets clipped. This is why the now-rule and its clock chip live in the
  lanes-wide overlay and not inside a lane.
- ⚠️ **The card layer never takes pointer events; each card opts in.** The drag
  hit-tests with `elementFromPoint` against `data-band-court` / `data-band-minute`
  rather than by arithmetic on bounding rects — that is what makes it correct
  under RTL, horizontal scroll and the sticky rail without special-casing any of
  them. If the layer swallowed events, a drag crossing the gap between two
  bookings would hit nothing and the ghost would freeze.
- ⚠️ **Mobile navigation is a DRAWER, not a bottom strip** (`src/ui/Drawer.tsx`,
  `ConsoleMobileNav.tsx`, `(site)/SiteNav.tsx`). A strip either truncated the
  destinations or shrank them below a thumb's width, and this product has
  enough modules that it did both.
- ⚠️ **`backdrop-filter` makes an element the containing block for every
  `position: fixed` descendant.** The site header carries `backdrop-blur-md`,
  so the drawer's `fixed inset-0` resolved against a 60px header strip, its
  title row ate the whole height, and `flex-1 overflow-y-auto` clipped every
  nav link to nothing. The menu opened looking empty. **The drawer therefore
  portals to `document.body`** (`createPortal`), which also puts it outside
  `.court-world` — hence the `.drawer-root` rule in `globals.css` that carries
  the world's type across. Same trap applies to any future fixed overlay
  rendered inside a blurred bar.
- ⚠️ **`inset-inline-*` is NOT a Tailwind v4 utility and compiles to nothing.**
  Four of them shipped and were silently dead. The real ones are `start-*` /
  `end-*` (inline start/end), `inset-s-*` / `inset-e-*`, and `inset-x-*` for
  both. Verify a suspect class by generating it rather than trusting the name:
  `@source inline("<class>")` through `npx @tailwindcss/cli` and see whether a
  rule comes out.
- ⚠️ **Nav highlighting needs longest-match, not `startsWith`.** `/play/matches`
  prefix-matches `/play`, so "Book a court" lit on every page in the booking
  flow. `SiteNav.tsx` now matches on segment boundaries and keeps only the
  longest hit, so `/play` still lights for `/play/checkout/<id>` but loses to
  `/play/matches`.
- ⚠️ **Never filter a nav item out because the role cannot open it.** Show it
  locked, naming who can. A front-desk session with the money modules filtered
  out showed a lone "Cash Book" and read as a half-built product.
- ⚠️ **`app/global-not-found.tsx` carries its own `<html>`/`<body>` and fonts.**
  The root layout deliberately has none — they live in `[locale]/layout.tsx` so
  `lang`/`dir` are set before first paint — which leaves any URL outside a
  locale segment with no document. That gap threw "Missing &lt;html&gt; and
  &lt;body&gt; tags in the root layout" until this file existed.
- ⚠️ **The ledger world's CSS classes outlived its tokens once.** `.slip` still
  carried `background: var(--color-paper)` — near-white — and beat
  `bg-transparent` on specificity, rendering whole panels unreadable. When a
  visual world is replaced, delete its CSS classes, not only its utilities.
- ⚠️ **Do not add a Vercel `regions` setting by copying it.** On one sibling
  project it was the biggest single win; on another the same change would have
  made things slower. Measure first. See PERFORMANCE.md.

## Roadmap / next steps

1. **← ACTIVE: browser pass.** Nothing here has been driven by a human, and the
   rebuilt board in particular is entirely unwatched:
   - **On a tablet, with a finger** — this is the whole point of the rebuild.
     Drag a booking to another lane; drag its trailing edge to 120 min; drag
     across empty lane to draw a new one. Drop onto an occupied band → it snaps
     back and says "just taken".
   - Tap a booking → the peek sheet opens *over* the board. Confirm a hold,
     mark a no-show, cancel with a reason. The board must never leave the screen.
   - Keyboard only: Tab to the grid, arrow to a band, Enter to compose. Tab to a
     card, `m`, arrows, Enter to move; `Esc` to abandon.
   - The now-rule should be at the real minute and should move over a shift.
     The board should open scrolled to it, not to 06:00.
   - A day with a maintenance block → that court hatches **only** those bands.
   - Open two tabs on `/play`, hold the same 21:00 slot in both → exactly one
     gets to checkout, the other sees "Just taken".
   - Let a hold lapse → the amber bar across the card head empties, the card
     reads LAPSED, and the slot is bookable again.
   - Take a cash payment, then close the shift with a deliberate AED 35
     shortfall → it refuses to close without an explanation.
   - Switch role to Front desk → Finances shows only the Cash Book, and
     `/admin/finances/ledgers` says "Not your board" rather than 500-ing.
     Switch to Owner → all four appear.
   - **Every screen at 375px.** The structural causes of horizontal overflow
     are fixed (see below) but no breakpoint has been eyeballed.
   - **The mobile menu on both surfaces** — it must be full-height, pinned to
     the inline edge, with all destinations reachable. It shipped broken once
     and route tests did not catch it.
   - **The landing page's scroll motion**, which has never been watched: the
     court lines should mark themselves out as you descend the Courts and
     closing sections, and the court cards should flap in rather than fade.
     Check it also with OS "reduce motion" on (everything must sit at its
     finished state) and in Firefox (no scroll timelines — same expectation).
   - Every screen in `ar`. The board's *time* stays left-to-right by design;
     its rail, cards, sheets and every panel around it must mirror.
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
| Peek sheet actions | Confirm hold, mark no-show, cancel with a reason, and move via the board | Take payment and settle shares without leaving the board. Tagged `SCOPE(v1)` in `PeekPanel.tsx`; needs a `record` action on the payments port |
| Board resize | 60 / 90 / 120 only, and it refuses a booking that carries an approved discount | Any sellable length, with the discount re-approved inline rather than silently erased |
| Compose | Court, time, length, customer, hold-or-write | Open match, party size, maintenance block, and "series from here". `partySize: 4` and `openMatch: false` are still hardcoded at the call site |
| Board tests | The arithmetic is covered by `geometry.test.ts`; the driver by `driver.test.ts` | No component or e2e layer exists at all — vitest is node-only, no jsdom. The gestures are unverified by anything but hands |
| Pricing/policy editing | Read-only screens over the config rows | Full CRUD forms — the rows and the engine already support it |
| Tournaments | List, entries, court blocking, payment state | Bracket generation and americano/mexicano round scheduling |
| Coaching | Coaches, classes, rosters, commission computed at read time | Coach self-service and lesson booking from the player app |
| Pro shop | Sell to a court tab or standalone, stock decrements | Purchase orders, supplier records, stock-take |
| Reports | Utilisation by hour and court, revenue by source, no-show rate | Export, date-range picker beyond 7/30, per-agent breakdowns |
| Notifications | Queued to a log with the real message shape | A worker over the queue once the channel is confirmed |
| Auth | Real sign-up / sign-in / sign-out over file-backed accounts, scrypt passwords, signed cookie, plus the role switcher for demoing | Supabase Auth owns the credential; `accounts` keeps only `auth_uid` + role. The `Claims` shape is already the target shape |
| Account self-service | Sign up, sign in, sign out | Password change, password reset, email verification, and a way for a player to edit their own details. **There is no mail channel in this product yet**, so a reset link would be a fiction — an owner sets a staff password and reads it out |
| Account admin | Owner creates staff/coach logins; the accounts list shows role, last sign-in and disabled state | Disable/enable from the UI (`setAccountActive` exists and is wired to nothing), reassign a role, and unlink an account from its customer |

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
npm run build      # also runs the TypeScript pass
npm run start      # production server — use this to see REAL render errors
npx vitest run     # 146 tests, node environment
npx tsc --noEmit
npx eslint .       # `npm run lint` is bare eslint, not `next lint`
```

Role switching is in the admin left rail (bottom). Owner and Manager see
the ledgers, staff and audit; Front desk does not.

The Vercel CLI is **not installed** — `npm i -g vercel` before any deploy work.
