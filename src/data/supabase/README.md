# The Supabase driver

Not implemented. This directory is the destination, not a stub to be filled in
casually — read this before writing the first line.

## What already exists

- **The contract**: [`src/data/ports.ts`](../ports.ts). Both drivers implement
  it identically, *including their failure modes*.
- **The schema**: [`supabase/migrations/`](../../../supabase/migrations/),
  authored but never applied.
- **The reference implementation**: [`src/data/memory/driver.ts`](../memory/driver.ts),
  and its test suite [`driver.test.ts`](../memory/driver.test.ts) — 30 tests
  that pin the exact behaviour this driver must reproduce.

## The job

1. Create the Supabase project. **Enable ES256 (asymmetric) signing keys before
   anything else** — the whole auth performance rule in
   [PERFORMANCE.md](../../../PERFORMANCE.md) depends on `getClaims()` verifying
   locally, and it silently falls back to a ~330ms network round-trip if the
   project signs symmetrically.
2. Apply `0001`, `0002`, `0003` **in order**. `0001` needs `btree_gist`;
   `0003` needs `pg_cron`.
3. Implement `createSupabaseDb(): Db` here.
4. Point `DATA_DRIVER=supabase` at it. Nothing above `src/data/index.ts`
   changes — that is the entire point of the ports.
5. Run `npx vitest run src/data/memory/driver.test.ts` against the new driver
   by parameterising the suite over both. **A green run is the acceptance
   criterion.**

## The three things that will bite

**1. `23P01` must become `SlotTakenError`.** Nothing else. Every screen's
"just taken" path is written against that one error type, and the whole
no-double-booking guarantee is that application code never checks first:

```ts
if (error?.code === "23P01") {
  throw new SlotTakenError(courtId, start, end);
}
```

Do not add a pre-flight availability check "to be safe". Read-then-write is
precisely the race the exclusion constraint exists to close, and adding one
back reintroduces it while looking careful.

**2. Name the foreign key when a table is referenced twice.** `bookings`
references `customers` twice (booker, and the customer a walk-in was rung up
under), and `booking_participants` references it again. The plain embed form is
ambiguous and fails with `PGRST201`:

```ts
.select("*, customers!bookings_customer_id_fkey(*)")
```

**3. `numeric` arrives as a string.** `customers.level`, and anything else
typed `numeric`, comes over PostgREST as `"4.5"`, not `4.5`. Parse explicitly
and test both shapes. Money is `bigint` and arrives as a **string** too — parse
it into `Fils` at the boundary and never let a raw string reach the domain.

## Wave discipline

The loaders in [`src/data/loaders.ts`](../loaders.ts) are already shaped as one
`Promise.all` per route. Keep them that way. A round-trip is ~305–330ms; a
query added to an existing wave is ~3–12ms. See PERFORMANCE.md for the measured
numbers this is based on.

`listForBookings`, `cancelMany`, `blockMany` and `settleMany` exist on the ports
specifically so bulk work is one round-trip. Implement them as one statement
each — `.in("id", ids)` — never a loop.

## Region

Do **not** copy a `regions` setting from another project. On one sibling
project, pinning compute beside a Stockholm database was the biggest single
win; on another the same change would have made the app slower, because
Supabase already fronted through Cloudflare in the same city. Measure `CF-RAY`
and connect time first. If it is ever pinned, change it in the same commit as
any database region change.
