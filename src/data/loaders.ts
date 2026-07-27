import "server-only";
import { resolveAvailability } from "@/domain/availability";
import { resolveCancellation } from "@/domain/cancellation";
import { quote } from "@/domain/pricing";
import { expandSeries, materialisationWindow } from "@/domain/recurrence";
import { computeDayGrid, type DayGrid, utilisationByHour } from "@/domain/slots";
import { splitBooking } from "@/domain/split";
import { addFils, type Fils, ZERO } from "@/lib/money";
import { addDaysToLocalDate, type LocalDate, todayInDubai } from "@/lib/time";
import { getDb } from "./index";
import { countOrThrow, maybeRow, rowsOrThrow } from "./query";
import type {
  AuditEntry,
  Booking,
  BookingParticipant,
  CancellationPolicy,
  ClassEnrolment,
  ClassSession,
  Coach,
  Court,
  Customer,
  Payment,
  PricingRule,
  Product,
  PromoCode,
  StaffUser,
  TillSession,
  Tournament,
  TournamentEntry,
} from "./types";

/**
 * ONE WAVE PER ROUTE.
 *
 * A round-trip costs ~305–330ms; a query added to an existing Promise.all costs
 * ~3–12ms. Six queries in one wave measured 339ms against production on a
 * sibling project; the same six serially measured 1961ms.
 *
 * Every loader below is exactly one `Promise.all`. A new stat, panel or count
 * goes INSIDE it — never in an `await` above it. If you find yourself writing a
 * second `await` in one of these functions, you have added 300ms.
 *
 * The pure computation that follows each wave does no I/O and is not a second
 * wave; it is free.
 */

export interface ConsoleDay {
  day: LocalDate;
  grid: DayGrid;
  courts: Court[];
  bookings: Booking[];
  participants: BookingParticipant[];
  customers: Customer[];
  staff: StaffUser[];
  till: TillSession | null;
  dueCount: number;
  payments: Payment[];
  closures: { courtId: string; note: string; noteAr: string }[];
  takings: { cash: Fils; card: Fils; wallet: Fils; total: Fils };
  utilisationByHour: Map<number, number>;
}

export async function loadConsoleDay(day: LocalDate): Promise<ConsoleDay> {
  const db = getDb();

  // Sweep first so the page never renders a hold that has already lapsed.
  // It is a local mutation here; in production it is pg_cron plus the route in
  // app/api/cron/expire-holds, and this call becomes unnecessary.
  await db.bookings.expireHolds(new Date());

  const [
    courts,
    bookings,
    templates,
    exceptions,
    customers,
    staff,
    till,
    dueCount,
    payments,
  ] = await Promise.all([
    rowsOrThrow("console.courts", db.courts.list()),
    rowsOrThrow("console.bookings", db.bookings.listForDay(day)),
    rowsOrThrow("console.templates", db.availability.templates()),
    rowsOrThrow("console.exceptions", db.availability.exceptionsForRange(day, day)),
    rowsOrThrow("console.customers", db.customers.list()),
    rowsOrThrow("console.staff", db.staff.list()),
    maybeRow("console.till", db.till.currentSession()),
    countOrThrow("console.due", db.payments.countDue(day)),
    rowsOrThrow("console.payments", db.payments.listForDay(day)),
  ]);

  // Participants need the booking ids, so they are a genuine second wave. It is
  // the only one in this loader, and it is one query, not one per booking.
  const participants = await rowsOrThrow(
    "console.participants",
    db.participants.listForBookings(bookings.map((b) => b.id)),
  );

  const availability = resolveAvailability(day, courts, templates, exceptions);
  const grid = computeDayGrid({ day, courts, availability, bookings });

  const takings = sumTakings(payments);

  return {
    day,
    grid,
    courts,
    bookings,
    participants,
    customers,
    staff,
    till,
    dueCount,
    payments,
    closures: availability.closures,
    takings,
    utilisationByHour: utilisationByHour(grid),
  };
}

function sumTakings(payments: Payment[]) {
  const by = (m: Payment["method"]) =>
    addFils(...payments.filter((p) => p.method === m).map((p) => p.amount));
  const cash = by("cash");
  const card = by("card");
  const wallet = by("wallet");
  return { cash, card, wallet, total: addFils(cash, card, wallet) };
}

// ---------------------------------------------------------------------------

export interface BookingDetail {
  booking: Booking;
  court: Court | null;
  customer: Customer | null;
  participants: BookingParticipant[];
  customers: Customer[];
  payments: Payment[];
  split: ReturnType<typeof splitBooking>;
  cancellation: ReturnType<typeof resolveCancellation>;
  policies: CancellationPolicy[];
  staff: StaffUser[];
}

/**
 * Collapsed chain: booking, court, customer, participants and payments arrive
 * together rather than booking -> customer -> participants -> payments. The
 * equivalent chain on a sibling project measured 1339ms; collapsed, 337ms.
 */
export async function loadBookingDetail(id: string): Promise<BookingDetail | null> {
  const db = getDb();

  const [booking, courts, customers, participants, payments, policies, staff] =
    await Promise.all([
      maybeRow("booking.get", db.bookings.get(id)),
      rowsOrThrow("booking.courts", db.courts.list()),
      rowsOrThrow("booking.customers", db.customers.list()),
      rowsOrThrow("booking.participants", db.participants.listForBooking(id)),
      rowsOrThrow("booking.payments", db.payments.listForBooking(id)),
      rowsOrThrow("booking.policies", db.policies.cancellation()),
      rowsOrThrow("booking.staff", db.staff.list()),
    ]);

  if (!booking) return null;

  return {
    booking,
    court: courts.find((c) => c.id === booking.courtId) ?? null,
    customer: customers.find((c) => c.id === booking.customerId) ?? null,
    participants,
    customers,
    payments,
    split: splitBooking(booking.total, participants),
    cancellation: resolveCancellation(booking, policies),
    policies,
    staff,
  };
}

// ---------------------------------------------------------------------------

export interface CustomersPage {
  customers: Customer[];
  bookings: Booking[];
  participants: BookingParticipant[];
}

/**
 * The whole list, once, under one stable key. Filtering and search happen in
 * the browser over these rows — every filter value folded into a cache key is
 * a refetch per keystroke, which measured 329ms each.
 */
export async function loadCustomersPage(): Promise<CustomersPage> {
  const db = getDb();
  const today = todayInDubai();

  const [customers, bookings] = await Promise.all([
    rowsOrThrow("customers.list", db.customers.list()),
    rowsOrThrow(
      "customers.bookings",
      db.bookings.listForRange(addDaysToLocalDate(today, -90), addDaysToLocalDate(today, 60)),
    ),
  ]);

  // Genuine second wave — participants are keyed by booking id, which wave one
  // produces. One query for all of them, never one per booking.
  const participants = await rowsOrThrow(
    "customers.participants",
    db.participants.listForBookings(bookings.map((b) => b.id)),
  );

  return { customers, bookings, participants };
}

// ---------------------------------------------------------------------------

export interface TillPage {
  day: LocalDate;
  session: TillSession | null;
  recent: TillSession[];
  payments: Payment[];
  staff: StaffUser[];
  expected: Fils;
  byMethod: { cash: Fils; card: Fils; wallet: Fils; credit: Fils; transfer: Fils };
}

export async function loadTillPage(day: LocalDate): Promise<TillPage> {
  const db = getDb();

  const [session, recent, payments, staff] = await Promise.all([
    maybeRow("till.current", db.till.currentSession()),
    rowsOrThrow(
      "till.recent",
      db.till.sessionsForRange(addDaysToLocalDate(day, -14), day),
    ),
    rowsOrThrow("till.payments", db.payments.listForDay(day)),
    rowsOrThrow("till.staff", db.staff.list()),
  ]);

  const by = (m: Payment["method"]) =>
    addFils(...payments.filter((p) => p.method === m).map((p) => p.amount));

  const byMethod = {
    cash: by("cash"),
    card: by("card"),
    wallet: by("wallet"),
    credit: by("credit"),
    transfer: by("transfer"),
  };

  return {
    day,
    session,
    recent: recent.sort((a, b) => (a.operatingDay < b.operatingDay ? 1 : -1)),
    payments,
    staff,
    expected: session ? addFils(session.openingFloat, byMethod.cash) : ZERO,
    byMethod,
  };
}

// ---------------------------------------------------------------------------

export interface PricingPage {
  rules: PricingRule[];
  promos: PromoCode[];
  policies: CancellationPolicy[];
  courts: Court[];
  /** A worked example so the effect of a rule is visible, not inferred. */
  sample: { label: string; total: Fils }[];
}

export async function loadPricingPage(): Promise<PricingPage> {
  const db = getDb();
  const day = todayInDubai();

  const [rules, promos, policies, courts] = await Promise.all([
    rowsOrThrow("pricing.rules", db.pricing.rules()),
    rowsOrThrow("pricing.promos", db.pricing.promos()),
    rowsOrThrow("pricing.policies", db.policies.cancellation()),
    rowsOrThrow("pricing.courts", db.courts.list()),
  ]);

  const indoor = courts.find((c) => c.tags.includes("indoor")) ?? courts[0];
  const outdoor = courts.find((c) => c.tags.includes("outdoor")) ?? courts[0];

  const sample = indoor
    ? [
        {
          label: "Indoor · 09:00 · 90 min · guest",
          total: quote({ day, startMinute: 180, durationMinutes: 90, court: indoor, tier: "guest", rules }).total,
        },
        {
          label: "Indoor · 21:00 · 90 min · guest",
          total: quote({ day, startMinute: 900, durationMinutes: 90, court: indoor, tier: "guest", rules }).total,
        },
        {
          label: "Indoor · 21:00 · 90 min · member",
          total: quote({ day, startMinute: 900, durationMinutes: 90, court: indoor, tier: "member", rules }).total,
        },
        {
          label: "Outdoor · 21:00 · 90 min · guest",
          total: quote({ day, startMinute: 900, durationMinutes: 90, court: outdoor, tier: "guest", rules }).total,
        },
      ]
    : [];

  return { rules, promos, policies, courts, sample };
}

// ---------------------------------------------------------------------------

export interface ReportsPage {
  from: LocalDate;
  to: LocalDate;
  bookings: Booking[];
  payments: Payment[];
  courts: Court[];
  customers: Customer[];
  classes: ClassSession[];
  coaches: Coach[];
}

export async function loadReportsPage(
  from: LocalDate,
  to: LocalDate,
): Promise<ReportsPage> {
  const db = getDb();

  // The per-day payment reads are part of the SAME wave as everything else —
  // they are pushed into one Promise.all rather than awaited in a loop, which
  // is the difference between one round-trip and thirty.
  const [bookings, courts, customers, classes, coaches, dayPayments] =
    await Promise.all([
      rowsOrThrow("reports.bookings", db.bookings.listForRange(from, to)),
      rowsOrThrow("reports.courts", db.courts.list()),
      rowsOrThrow("reports.customers", db.customers.list()),
      rowsOrThrow("reports.classes", db.classes.listForRange(from, to)),
      rowsOrThrow("reports.coaches", db.coaches.list()),
      Promise.all(
        eachDay(from, to).map((d) =>
          rowsOrThrow(`reports.payments.${d}`, db.payments.listForDay(d)),
        ),
      ),
    ]);

  return {
    from,
    to,
    bookings,
    payments: dayPayments.flat(),
    courts,
    customers,
    classes,
    coaches,
  };
}

function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDaysToLocalDate(d, 1)) out.push(d);
  return out;
}

// ---------------------------------------------------------------------------

export interface AcademyPage {
  classes: ClassSession[];
  enrolments: ClassEnrolment[];
  coaches: Coach[];
  customers: Customer[];
  bookings: Booking[];
}

export async function loadAcademyPage(): Promise<AcademyPage> {
  const db = getDb();
  const today = todayInDubai();
  const to = addDaysToLocalDate(today, 28);

  const [classes, enrolments, coaches, customers, bookings] = await Promise.all([
    rowsOrThrow("academy.classes", db.classes.listForRange(today, to)),
    rowsOrThrow("academy.enrolments", db.classes.enrolments()),
    rowsOrThrow("academy.coaches", db.coaches.list()),
    rowsOrThrow("academy.customers", db.customers.list()),
    rowsOrThrow("academy.bookings", db.bookings.listForRange(today, to)),
  ]);

  return { classes, enrolments, coaches, customers, bookings };
}

// ---------------------------------------------------------------------------

export interface ShopPage {
  products: Product[];
  todaysSales: Awaited<ReturnType<ReturnType<typeof getDb>["sales"]["listForDay"]>>;
  bookings: Booking[];
  customers: Customer[];
}

export async function loadShopPage(): Promise<ShopPage> {
  const db = getDb();
  const today = todayInDubai();

  const [products, todaysSales, bookings, customers] = await Promise.all([
    rowsOrThrow("shop.products", db.products.list()),
    rowsOrThrow("shop.sales", db.sales.listForDay(today)),
    rowsOrThrow("shop.bookings", db.bookings.listForDay(today)),
    rowsOrThrow("shop.customers", db.customers.list()),
  ]);

  return { products, todaysSales, bookings, customers };
}

// ---------------------------------------------------------------------------

export interface TournamentsPage {
  tournaments: Tournament[];
  entries: TournamentEntry[];
  customers: Customer[];
  courts: Court[];
}

export async function loadTournamentsPage(): Promise<TournamentsPage> {
  const db = getDb();

  const [tournaments, entries, customers, courts] = await Promise.all([
    rowsOrThrow("tournaments.list", db.tournaments.list()),
    rowsOrThrow("tournaments.entries", db.tournaments.entries()),
    rowsOrThrow("tournaments.customers", db.customers.list()),
    rowsOrThrow("tournaments.courts", db.courts.list()),
  ]);

  return { tournaments, entries, customers, courts };
}

// ---------------------------------------------------------------------------

export interface AuditPage {
  entries: AuditEntry[];
  staff: StaffUser[];
}

export async function loadAuditPage(): Promise<AuditPage> {
  const db = getDb();
  const [entries, staff] = await Promise.all([
    rowsOrThrow("audit.recent", db.audit.recent(300)),
    rowsOrThrow("audit.staff", db.staff.list()),
  ]);
  return { entries, staff };
}

// ---------------------------------------------------------------------------

export interface SeriesPage {
  series: Awaited<ReturnType<ReturnType<typeof getDb>["series"]["list"]>>;
  exceptions: Awaited<ReturnType<ReturnType<typeof getDb>["series"]["exceptions"]>>;
  customers: Customer[];
  courts: Court[];
  planned: ReturnType<typeof expandSeries>;
}

export async function loadSeriesPage(): Promise<SeriesPage> {
  const db = getDb();
  const today = todayInDubai();
  const window = materialisationWindow(today);

  const [series, exceptions, customers, courts] = await Promise.all([
    rowsOrThrow("series.list", db.series.list()),
    rowsOrThrow("series.exceptions", db.series.exceptions()),
    rowsOrThrow("series.customers", db.customers.list()),
    rowsOrThrow("series.courts", db.courts.list()),
  ]);

  const planned = series.flatMap((s) =>
    expandSeries(s, window.from, window.to, exceptions),
  );

  return { series, exceptions, customers, courts, planned };
}

// ---------------------------------------------------------------------------
// Player app
// ---------------------------------------------------------------------------

export interface PlayDay {
  day: LocalDate;
  grid: DayGrid;
  courts: Court[];
  rules: PricingRule[];
}

export async function loadPlayDay(day: LocalDate): Promise<PlayDay> {
  const db = getDb();
  await db.bookings.expireHolds(new Date());

  const [courts, bookings, templates, exceptions, rules] = await Promise.all([
    rowsOrThrow("play.courts", db.courts.list()),
    rowsOrThrow("play.bookings", db.bookings.listForDay(day)),
    rowsOrThrow("play.templates", db.availability.templates()),
    rowsOrThrow("play.exceptions", db.availability.exceptionsForRange(day, day)),
    rowsOrThrow("play.rules", db.pricing.rules()),
  ]);

  const availability = resolveAvailability(day, courts, templates, exceptions);
  return {
    day,
    grid: computeDayGrid({ day, courts, availability, bookings }),
    courts,
    rules,
  };
}

export interface MatchesPage {
  matches: Booking[];
  participants: BookingParticipant[];
  customers: Customer[];
  courts: Court[];
}

export async function loadMatchesPage(): Promise<MatchesPage> {
  const db = getDb();
  const today = todayInDubai();
  const to = addDaysToLocalDate(today, 14);

  const matches = await rowsOrThrow(
    "matches.list",
    db.bookings.listOpenMatches(today, to),
  );

  const [participants, customers, courts] = await Promise.all([
    rowsOrThrow("matches.participants", db.participants.listForBookings(matches.map((m) => m.id))),
    rowsOrThrow("matches.customers", db.customers.list()),
    rowsOrThrow("matches.courts", db.courts.list()),
  ]);

  return { matches, participants, customers, courts };
}

export interface AccountPage {
  customer: Customer | null;
  bookings: Booking[];
  participants: BookingParticipant[];
  courts: Court[];
  policies: CancellationPolicy[];
}

export async function loadAccountPage(customerId: string): Promise<AccountPage> {
  const db = getDb();

  const [customer, bookings, courts, policies] = await Promise.all([
    maybeRow("account.customer", db.customers.get(customerId)),
    rowsOrThrow("account.bookings", db.bookings.listForCustomer(customerId)),
    rowsOrThrow("account.courts", db.courts.list()),
    rowsOrThrow("account.policies", db.policies.cancellation()),
  ]);

  const participants = await rowsOrThrow(
    "account.participants",
    db.participants.listForBookings(bookings.map((b) => b.id)),
  );

  return { customer, bookings, participants, courts, policies };
}
