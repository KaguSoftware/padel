# Performance rules — Kagu Padel

Inherited from Kagu Emlak and ExxionOs/KaguOs, where **each of these was measured, not assumed**.
Only the performance rules were taken across; those projects' UX, component, and i18n conventions
are deliberately not inherited — this project's UI answers to [DESIGN.md](DESIGN.md).

Two of the rules below are marked **INHERITED-UNVERIFIED**: they were true on Supabase in
`eu-north-1`/Istanbul and are almost certainly true here, but this project has no database yet, so
nothing has been timed. Re-measure before quoting a number.

---

## The one rule

**COUNT WAVES, NEVER QUERIES.**

A round-trip costs ~305–330ms. A query added to an existing `Promise.all` costs ~3–12ms. Measured
on Kagu Emlak against production, warm connection, median of 8:

| | |
|---|---|
| 1 query | 327ms |
| 6 queries in one `Promise.all` | 339ms |
| the same 6 serially | **1961ms** |

**One wave per route.** Every page's reads live in exactly one `Promise.all`, inside a single
`load<Page>()` function. A new stat, a new count, a new panel goes **inside** that `Promise.all` —
never in an `await` above it.

This is why the data layer is built wave-shaped now, while the driver is still in memory: retrofitting
wave discipline onto a hundred call sites is the expensive part, and it costs nothing to get right
today.

```ts
// src/data/loaders/consoleDay.ts — the shape every route follows
export async function loadConsoleDay(date: LocalDate) {
  const [courts, bookings, exceptions, tillSession, dueCount] = await Promise.all([
    db.courts.list(),
    db.bookings.listForDay(date),        // ALL courts, one range query. Never loop courts.
    db.exceptions.listForDay(date),
    db.till.currentSession(),
    db.payments.countDue(date),
  ])
  return computeDayGrid({ courts, bookings, exceptions })  // pure, no I/O
}
```

**Never loop courts.** The day calendar is one range query across every court, not one per column.
Six courts × one query each is six waves and a two-second page.

---

## Identity is verified locally, never over the network

**INHERITED-UNVERIFIED** (no auth server exists here yet; the rule shapes the port now).

Supabase's `getUser()` is a network call to the auth server — **measured at 331ms**. Kagu Emlak was
calling it 37 times: proxy, every page, the auth provider, and each db helper, so a page paid it
three times before requesting a row. **Auth cost more than the data did.**

`getClaims()` verifies the JWT locally via WebCrypto (~0.1ms) *provided the project signs with an
asymmetric algorithm* — ES256. That is a project setting, and it is the precondition for the whole
rule.

For us, right now:

- `src/auth/claims.ts` exposes **`getClaims()`** — reads the signed session cookie and returns
  `{ userId, role, venueId }` with **zero I/O**. The mock driver and the eventual Supabase driver
  share this signature, so the swap changes an implementation, not 40 call sites.
- **`requireUser()`** is the single guard. One copy. Kagu Emlak had 13 copy-pasted copies that had
  already drifted apart, 7 of them paying the round-trip.
- ⚠️ When Supabase lands: **enable ES256 signing keys before relying on `getClaims()`**, and leave
  the OAuth/token-exchange callback on the refreshing path. That route straddles a mid-transition
  session and runs once per sign-in; "finishing the job" there drops sessions randomly.
- ⚠️ The session read is the **one deliberate exception** to the throw-on-failure rule below. A
  failed session read means *signed out* → redirect. Throwing would crash every route including the
  way out.

---

## Every query throws, with a label

`src/data/query.ts` exposes `rowOrThrow(label, p)`, `rowsOrThrow(label, p)`, `countOrThrow(label, p)`.

**Wrap a QUERY, never a WAVE** — wrapping the `Promise.all` loses which query failed.

This matters more here than anywhere it was inherited from. **A failed availability read that renders
a calm empty grid does not look like an error — it looks like a fully booked day, or a completely
free one.** Staff act on that. On Kagu Emlak the same silence turned a missing migration into a
company-wide outage that read as "no data". An availability query that fails must throw and show an
error, always.

---

## Filtering and search never touch the network

100% client-side, `useMemo` over rows already in memory.

The failure mode this replaces: folding every filter value into the cache key, so each dropdown pick
and each debounced keystroke minted a new key and refetched — **329ms per keystroke, now 0**. Lists
are fetched once under **one stable key** and narrowed locally.

Consequences that are easy to get wrong:

- **The search debounces get deleted.** They only ever existed to rate-limit the network. Keeping a
  250ms debounce over an in-memory filter is 250ms of pure added latency.
- **The URL mirrors filters via `replaceState`, never `router.push`.** A push is a server round-trip
  plus one history entry per keystroke.
- ⚠️ **`Number(null)` is `0`.** On Kagu Emlak a NULL `list_price` passed every max-price filter and
  read as free. Here: a booking with no price yet, a coach with no commission rate, a product with no
  stock count. Every numeric filter tests for null explicitly.
- ⚠️ **Search folding must be Arabic-aware.** The Turkish analogue of this bug was
  `toLocaleLowerCase("tr")` — without it, searching "istanbul" missed "İstanbul". Ours is
  `foldAr()`: normalize alef forms (`أ إ آ ٱ` → `ا`), ta marbuta (`ة` → `ه`), alef maqsura (`ى` →
  `ي`), strip tatweel `ـ` and all diacritics, and normalize Arabic-Indic digits to ASCII. Without it,
  a customer saved as "أحمد" is unfindable by typing "احمد", which is what staff will type. Pinned by
  tests.
- ⚠️ **Filter dropdown options are built from the full list, not the visible rows.** Building options
  from what's currently shown makes them collapse as you narrow, and you can never widen again.

---

## Collapse serial chains

`getBookingDetail()` must be **one embedded select**, not booking → customer → participants →
payments. The equivalent chain on Kagu Emlak was 1339ms; collapsed, 337ms.

Same rule for anything that "awaits X then decides whether to fetch Y" when both only need the URL
id — they share one wave.

⚠️ When a table is referenced twice from one parent, PostgREST needs the **explicit constraint name**
or it fails with PGRST201. Ours will hit this: `bookings` references `customers` twice (booker and
the customer a walk-in was rung up under), and `booking_participants` references `customers` again.
Name the FK: `customers!bookings_booker_id_fkey`.

---

## Bulk mutations batch

One round-trip for N rows, never one per row. Kagu Emlak's 20-row bulk delete was 6598ms → 332ms.

Ours, all of which are real staff actions: cancel a whole recurring series, block a court for a
tournament across 14 slots, settle four participants' shares, void a shift's payments, bulk-import
class rosters.

---

## Warm on hover, and *consume* the warm copy

`router.prefetch` fetches the route bundle only, leaving the page to pay a full round-trip on
arrival. Start the query on hover too.

`warmBooking(id)` starts it; **`takeWarmBooking(id)` consumes it** — removing it from the map as it
is read. Without consume semantics, a reload after a mutation can serve the stale warm copy. On this
product that means showing a slot as free after someone just took it, which is the single worst thing
this system can do.

Warm on hover: calendar slips, customer rows, open-match cards.

---

## Framework and platform

- **`staleTimes: { dynamic: 30, static: 180 }`** in `next.config.ts`. Next defaults `dynamic` to
  **0**, so even pressing Back re-runs the server component. Confirm it is honoured in
  `.next/required-server-files.json` rather than assuming — it has been silently dropped before.
- **Cache Components.** `use cache` + `cacheTag('availability:<venue>:<date>')` on the slot grid;
  `updateTag` on every booking mutation. **Never cache a slot grid without a tag** — a stale
  availability grid is a double-booking waiting to happen.
- **Side effects go in `after()`** (`next/server`) so the user never waits on them: WhatsApp sends,
  audit-log writes, receipt generation, reminder scheduling. A booking confirmation must not sit
  behind a notification API.
- **Tabs are client state, not routes.** The booking record's tabs, the reports tabs, the customer
  record's tabs — every tab's data arrives in the page's single `Promise.all` and switching is pure
  client state. Separate routes trade ~3ms for ~305ms on every switch.
- ⚠️ **Do not add a Vercel `regions` setting by copying it from another project.** On ExxionOs,
  pinning compute to `arn1` beside a Stockholm database was the single biggest win (~30%). On Kagu
  Emlak the same change would have made the app **slower** — measured `CF-RAY …-IST`, connect 38ms,
  because Supabase already fronted through Cloudflare in Istanbul. Measure this project before
  pinning anything. **If it is pinned and the DB region ever changes, change both in the same
  commit** or compute is stranded a continent away.
- **Fold duplicate cache keys.** Three keys naming the same unfiltered query means three fetches;
  folded, the dashboard and the list page hydrate each other. Ours to watch:
  `bookings:day`, `bookings:for-calendar`, and `bookings:for-till` are the same day range.

---

## React

- **Adjust state DURING RENDER, never `useEffect(() => setX(prop), [prop])`.** The effect commits the
  stale value first and the UI visibly bounces after every save. Pattern:
  `if (seen !== prop) { setSeen(prop); setX(prop) }`. `react-hooks/set-state-in-effect` is an
  **error** in this project's lint config.
- **One clock, not sixty.** Hold countdowns tick from a single 1Hz ticker in context that broadcasts
  `now`; every expiring slip subscribes to that. Sixty slips each owning a `setInterval` is a
  guaranteed jank source on the tablet this runs on, and the tablet is the whole product.
- **Drag moves with `transform` only.** No layout-affecting properties during a drag, pointer events
  not mouse events, and the drop commits once. The calendar is touched all day; this is the one
  interaction that must never stutter.
- **`content-visibility: auto` on off-screen hour bands.** A 06:00→02:00 day is ~20 hour bands × 6
  courts; only the visible ones need to be laid out.
- **Realtime is one channel for the day**, not one per court. And `await supabase.realtime.setAuth(token)`
  **before** `.subscribe()`, or RLS streams nothing while the channel still reports SUBSCRIBED.

---

## Dates and money

- **`todayInDubai()` for every domain date.** `new Date().toISOString().slice(0,10)` is UTC and
  answers *yesterday* between 00:00–04:00 local. This project is worse than most: the operating day
  runs **06:00 → 02:00**, so a booking at 01:00 belongs to the *previous* day's page and the previous
  day's till. `operatingDayOf(instant)` owns that rule and nothing else computes it.
  A `todayLocal()` that reads the runtime clock is a UTC bug on Vercel.
- **Money is integer fils.** Parsing and rounding at every render is both slow and wrong; a branded
  `Fils` type makes a raw `number` a compile error. Format once, at the edge.
- ⚠️ Postgres `numeric` arrives over PostgREST as a **string**. Anything typed `numeric` must be
  parsed explicitly, and tested for both string and number input.
