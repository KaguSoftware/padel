import { quote } from "@/domain/pricing";
import { dirhams, type Fils, splitEvenly, ZERO } from "@/lib/money";
import {
  addDaysToLocalDate,
  instantAt,
  type LocalDate,
  operatingDayOf,
} from "@/lib/time";
import type {
  Booking,
  BookingParticipant,
  BookingSeries,
  ClassEnrolment,
  ClassSession,
  Customer,
  Payment,
  SeriesException,
  Tournament,
  TournamentEntry,
} from "../types";
import {
  CANCELLATION_POLICIES,
  COURTS,
  CUSTOMERS,
  PRICING_RULES,
} from "./reference";

/**
 * ⚠️ SYNTHETIC — a generated fortnight of trading, built relative to whatever
 * "today" is when the store first initialises, so the calendar is never empty
 * and never stale.
 *
 * Deliberately uneven: evenings are near-full, mornings are thin, one court is
 * down for resurfacing, two holds are mid-checkout, there are unpaid tabs, a
 * no-show, and three open matches waiting for players. A demo where every slot
 * is tidily booked proves nothing about the screen that matters.
 */

/** Deterministic PRNG so the same "today" always seeds the same fortnight. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayNumber(day: LocalDate): number {
  return Number(day.replace(/-/g, ""));
}

export interface SeededTrading {
  bookings: Booking[];
  participants: BookingParticipant[];
  payments: Payment[];
  series: BookingSeries[];
  seriesExceptions: SeriesException[];
  classes: ClassSession[];
  enrolments: ClassEnrolment[];
  tournaments: Tournament[];
  tournamentEntries: TournamentEntry[];
  nextSerial: number;
}

const STAFF_IDS = ["usr-desk-1", "usr-desk-2", "usr-manager"];

/** The regulars whose weekly slot is the club's actual business model. */
const SERIES_SPEC = [
  { customerId: "cus-1", courtId: "crt-1", weekday: 2, startMinute: 900, duration: 90 },
  { customerId: "cus-3", courtId: "crt-2", weekday: 2, startMinute: 900, duration: 90 },
  { customerId: "cus-9", courtId: "crt-1", weekday: 0, startMinute: 780, duration: 90 },
  { customerId: "cus-20", courtId: "crt-3", weekday: 4, startMinute: 840, duration: 120 },
  { customerId: "cus-14", courtId: "crt-2", weekday: 6, startMinute: 180, duration: 90 },
];

export function seedTrading(today: LocalDate): SeededTrading {
  const rand = mulberry32(dayNumber(today));
  const byId = new Map(CUSTOMERS.map((c) => [c.id, c]));

  const bookings: Booking[] = [];
  const participants: BookingParticipant[] = [];
  const payments: Payment[] = [];
  const seriesExceptions: SeriesException[] = [];
  let serial = 4801;
  let idCounter = 0;

  const nextId = (prefix: string) => `${prefix}-${(++idCounter).toString(36)}`;

  const series: BookingSeries[] = SERIES_SPEC.map((s, i) => ({
    id: `ser-${i + 1}`,
    courtId: s.courtId,
    customerId: s.customerId,
    weekday: s.weekday,
    startMinute: s.startMinute,
    durationMinutes: s.duration,
    from: addDaysToLocalDate(today, -120),
    until: null,
    partySize: 4,
    active: true,
    createdBy: "usr-manager",
    createdAt: new Date(),
  }));

  // "Skip next week, we're travelling" — the reason per-instance exceptions
  // exist at all.
  seriesExceptions.push({
    id: "sex-1",
    seriesId: "ser-1",
    day: nextWeekdayOnOrAfter(addDaysToLocalDate(today, 7), 2),
    kind: "skip",
    movedToStart: null,
    movedToCourtId: null,
    overrideTotal: null,
    reason: "Travelling — back the week after",
  });

  const from = addDaysToLocalDate(today, -7);
  const to = addDaysToLocalDate(today, 7);

  for (let day = from; day <= to; day = addDaysToLocalDate(day, 1)) {
    const isPast = day < today;
    const isToday = day === today;

    // Recurring instances first — they own their slot.
    for (const s of series) {
      const wd = new Date(instantAt(day, s.startMinute)).getUTCDay();
      const localWd = weekdayOf(day, s.startMinute);
      void wd;
      if (localWd !== s.weekday) continue;
      if (seriesExceptions.some((e) => e.seriesId === s.id && e.day === day)) continue;

      const customer = byId.get(s.customerId)!;
      const b = makeBooking({
        id: nextId("bkg"),
        serial: serial++,
        day,
        courtId: s.courtId,
        startMinute: s.startMinute,
        duration: s.durationMinutes,
        customer,
        source: "recurring",
        seriesId: s.id,
        status: "confirmed",
        paid: isPast || isToday,
        rand,
      });
      bookings.push(b);
      pushParticipants(b, customer, 4, participants, payments, nextId, rand);
    }

    // Then ordinary demand, weighted to the evening.
    for (const court of COURTS) {
      for (const startMinute of [120, 300, 480, 600, 720, 810, 900, 990, 1080]) {
        if (occupied(bookings, court.id, day, startMinute, 90)) continue;
        if (court.id === "crt-5" && startMinute >= 960) continue;

        const evening = startMinute >= 720;
        const chance = evening ? 0.82 : 0.28;
        if (rand() > chance) continue;

        const customer = CUSTOMERS[Math.floor(rand() * 24)];
        if (customer.blocked) continue;

        const openMatch = evening && rand() < 0.14;
        const partySize = 4;

        let status: Booking["status"] = "confirmed";
        if (isPast && rand() < 0.05) status = "no_show";

        const b = makeBooking({
          id: nextId("bkg"),
          serial: serial++,
          day,
          courtId: court.id,
          startMinute,
          duration: 90,
          customer,
          source: rand() < 0.55 ? "web" : rand() < 0.8 ? "walk_in" : "phone",
          seriesId: null,
          status,
          paid: isPast ? rand() > 0.08 : rand() > 0.45,
          openMatch,
          rand,
        });
        bookings.push(b);

        const joined = openMatch ? 2 : partySize;
        pushParticipants(b, customer, joined, participants, payments, nextId, rand);
      }
    }
  }

  // Two live holds mid-checkout on today's page, so the countdown and the
  // perforated edge are visible the moment the console opens.
  const holdSpots: [string, number][] = [
    ["crt-4", 930],
    ["crt-3", 1020],
  ];
  for (const [courtId, startMinute] of holdSpots) {
    if (occupied(bookings, courtId, today, startMinute, 90)) continue;
    const customer = CUSTOMERS[Math.floor(rand() * 20)];
    const b = makeBooking({
      id: nextId("bkg"),
      serial: serial++,
      day: today,
      courtId,
      startMinute,
      duration: 90,
      customer,
      source: "web",
      seriesId: null,
      status: "held",
      paid: false,
      rand,
    });
    b.holdExpiresAt = new Date(Date.now() + (4 + Math.floor(rand() * 5)) * 60_000);
    bookings.push(b);
    pushParticipants(b, customer, 1, participants, payments, nextId, rand);
  }

  // Court 5 is down for resurfacing for three days from tomorrow.
  for (let i = 1; i <= 3; i++) {
    const day = addDaysToLocalDate(today, i);
    bookings.push({
      ...emptyBooking(),
      id: nextId("blk"),
      serial: serial++,
      courtId: "crt-5",
      start: instantAt(day, 0),
      end: instantAt(day, 960),
      status: "blocked",
      source: "staff",
      operatingDay: day,
      partySize: 0,
      blockReason: "Surface resurfacing — contractor on site",
      createdBy: "usr-manager",
      createdAt: new Date(),
      priceLines: [],
      total: ZERO,
    });
  }

  const { classes, enrolments } = seedClasses(today, bookings, nextId, () => serial++);
  const { tournaments, tournamentEntries } = seedTournaments(today);

  return {
    bookings,
    participants,
    payments,
    series,
    seriesExceptions,
    classes,
    enrolments,
    tournaments,
    tournamentEntries,
    nextSerial: serial,
  };

  function pushParticipants(
    b: Booking,
    booker: Customer,
    count: number,
    out: BookingParticipant[],
    pay: Payment[],
    id: (p: string) => string,
    r: () => number,
  ) {
    if (b.status === "blocked") return;
    const shares = splitEvenly(b.total, Math.max(b.partySize, 1));
    const others = CUSTOMERS.filter((c) => c.id !== booker.id && !c.blocked);

    for (let i = 0; i < count; i++) {
      const c = i === 0 ? booker : others[Math.floor(r() * others.length)];
      const share = shares[i] ?? ZERO;
      const settled = b.paymentStatus === "paid" || (i === 0 && b.paymentStatus === "part_paid");
      const p: BookingParticipant = {
        id: id("par"),
        bookingId: b.id,
        customerId: c.id,
        guestName: null,
        share,
        paid: settled ? share : ZERO,
        paidAt: settled ? b.start : null,
        isBooker: i === 0,
        joinedAt: new Date(b.createdAt.getTime() + i * 60_000),
      };
      out.push(p);
      if (settled && share > 0) {
        pay.push({
          id: id("pay"),
          bookingId: b.id,
          saleId: null,
          participantId: p.id,
          amount: share,
          method: r() < 0.45 ? "cash" : r() < 0.85 ? "card" : "wallet",
          takenBy: STAFF_IDS[Math.floor(r() * STAFF_IDS.length)],
          takenAt: b.start,
          tillSessionId: null,
          refundOf: null,
          note: "",
        });
      }
    }
  }
}

interface MakeBookingArgs {
  id: string;
  serial: number;
  day: LocalDate;
  courtId: string;
  startMinute: number;
  duration: number;
  customer: Customer;
  source: Booking["source"];
  seriesId: string | null;
  status: Booking["status"];
  paid: boolean;
  openMatch?: boolean;
  rand: () => number;
}

function makeBooking(a: MakeBookingArgs): Booking {
  const court = COURTS.find((c) => c.id === a.courtId)!;
  const q = quote({
    day: a.day,
    startMinute: a.startMinute,
    durationMinutes: a.duration,
    court,
    tier: a.customer.tier,
    rules: PRICING_RULES,
  });

  const start = instantAt(a.day, a.startMinute);
  const end = instantAt(a.day, a.startMinute + a.duration);

  return {
    ...emptyBooking(),
    id: a.id,
    serial: a.serial,
    courtId: a.courtId,
    start,
    end,
    status: a.status,
    source: a.source,
    operatingDay: operatingDayOf(start),
    customerId: a.customer.id,
    partySize: 4,
    seriesId: a.seriesId,
    openMatch: a.openMatch ?? false,
    levelMin: a.openMatch ? bandFloor(a.customer.level) : null,
    levelMax: a.openMatch ? bandFloor(a.customer.level) + 1 : null,
    priceLines: q.lines,
    total: q.total,
    paymentStatus: a.status === "no_show" ? "unpaid" : a.paid ? "paid" : "unpaid",
    createdBy: a.source === "web" ? "usr-desk-1" : STAFF_IDS[Math.floor(a.rand() * 3)],
    createdAt: new Date(start.getTime() - (1 + Math.floor(a.rand() * 96)) * 3_600_000),
  };
}

function bandFloor(level: number | null): number {
  return level === null ? 3 : Math.floor(level * 2) / 2;
}

function emptyBooking(): Booking {
  return {
    id: "",
    serial: 0,
    courtId: "",
    start: new Date(0),
    end: new Date(0),
    status: "confirmed",
    source: "staff",
    operatingDay: "1970-01-01" as LocalDate,
    customerId: null,
    partySize: 4,
    seriesId: null,
    seriesException: null,
    openMatch: false,
    levelMin: null,
    levelMax: null,
    priceLines: [],
    total: ZERO,
    paymentStatus: "unpaid",
    holdExpiresAt: null,
    notes: "",
    createdBy: "usr-manager",
    createdAt: new Date(),
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    refundAmount: null,
    refundKind: null,
    blockReason: null,
  };
}

function occupied(
  bookings: Booking[],
  courtId: string,
  day: LocalDate,
  startMinute: number,
  duration: number,
): boolean {
  const s = instantAt(day, startMinute).getTime();
  const e = instantAt(day, startMinute + duration).getTime();
  return bookings.some(
    (b) =>
      b.courtId === courtId &&
      b.status !== "cancelled" &&
      b.status !== "expired" &&
      b.start.getTime() < e &&
      s < b.end.getTime(),
  );
}

function weekdayOf(day: LocalDate, minute: number): number {
  return new Date(
    instantAt(day, minute).toLocaleString("en-US", { timeZone: "Asia/Dubai" }),
  ).getDay();
}

function nextWeekdayOnOrAfter(day: LocalDate, weekday: number): LocalDate {
  let d = day;
  for (let i = 0; i < 8; i++) {
    if (weekdayOf(d, 720) === weekday) return d;
    d = addDaysToLocalDate(d, 1);
  }
  return day;
}

function seedClasses(
  today: LocalDate,
  bookings: Booking[],
  nextId: (p: string) => string,
  nextSerial: () => number,
): { classes: ClassSession[]; enrolments: ClassEnrolment[] } {
  const classes: ClassSession[] = [];
  const enrolments: ClassEnrolment[] = [];

  const spec = [
    { coachId: "coa-1", title: "Beginners clinic", titleAr: "دورة المبتدئين", dayOffset: 1, startMinute: 240, capacity: 8, price: dirhams(75), lvl: [1, 2.5] },
    { coachId: "coa-2", title: "Intermediate drills", titleAr: "تدريبات المستوى المتوسط", dayOffset: 2, startMinute: 660, capacity: 6, price: dirhams(110), lvl: [3, 4.5] },
    { coachId: "coa-3", title: "Ladies' academy", titleAr: "أكاديمية السيدات", dayOffset: 3, startMinute: 300, capacity: 8, price: dirhams(90), lvl: [1.5, 3.5] },
    { coachId: "coa-1", title: "Advanced tactics", titleAr: "تكتيكات متقدمة", dayOffset: 5, startMinute: 780, capacity: 4, price: dirhams(180), lvl: [4.5, 7] },
  ];

  for (const s of spec) {
    const day = addDaysToLocalDate(today, s.dayOffset);
    const courtId = "crt-4";
    if (occupied(bookings, courtId, day, s.startMinute, 90)) continue;

    const start = instantAt(day, s.startMinute);
    const booking: Booking = {
      ...emptyBooking(),
      id: nextId("bkg"),
      serial: nextSerial(),
      courtId,
      start,
      end: instantAt(day, s.startMinute + 90),
      status: "confirmed",
      source: "class",
      operatingDay: day,
      partySize: s.capacity,
      priceLines: [
        { code: "class", label: s.title, labelAr: s.titleAr, amount: ZERO },
      ],
      total: ZERO,
      paymentStatus: "paid",
      createdBy: "usr-manager",
      createdAt: new Date(),
    };
    bookings.push(booking);

    const cls: ClassSession = {
      id: nextId("cls"),
      coachId: s.coachId,
      bookingId: booking.id,
      title: s.title,
      titleAr: s.titleAr,
      capacity: s.capacity,
      pricePerHead: s.price,
      levelMin: s.lvl[0],
      levelMax: s.lvl[1],
    };
    classes.push(cls);

    const enrolled = Math.max(1, Math.floor(s.capacity * 0.7));
    for (let i = 0; i < enrolled; i++) {
      enrolments.push({
        id: nextId("enr"),
        classId: cls.id,
        customerId: CUSTOMERS[(i * 3 + s.dayOffset) % 24].id,
        paid: i % 4 === 3 ? ZERO : s.price,
        attended: null,
      });
    }
  }

  return { classes, enrolments };
}

function seedTournaments(today: LocalDate): {
  tournaments: Tournament[];
  tournamentEntries: TournamentEntry[];
} {
  const tournaments: Tournament[] = [
    {
      id: "trn-1",
      name: "Thursday Night Americano",
      nameAr: "أمريكانو ليلة الخميس",
      format: "americano",
      day: addDaysToLocalDate(today, 4),
      startMinute: 840,
      endMinute: 1080,
      courtIds: ["crt-1", "crt-2", "crt-3"],
      entryFee: dirhams(120),
      capacity: 24,
      levelMin: 2.5,
      levelMax: 4.5,
      status: "open",
    },
    {
      id: "trn-2",
      name: "Kagu Winter League — Round 3",
      nameAr: "دوري كاجو الشتوي — الجولة ٣",
      format: "round_robin",
      day: addDaysToLocalDate(today, 11),
      startMinute: 600,
      endMinute: 1080,
      courtIds: ["crt-1", "crt-2", "crt-3", "crt-4"],
      entryFee: dirhams(200),
      capacity: 32,
      levelMin: 3.5,
      levelMax: 7,
      status: "draft",
    },
  ];

  const tournamentEntries: TournamentEntry[] = CUSTOMERS.slice(0, 17).map((c, i) => ({
    id: `tre-${i + 1}`,
    tournamentId: "trn-1",
    customerId: c.id,
    paid: i % 5 === 4 ? (ZERO as Fils) : dirhams(120),
    points: 0,
  }));

  return { tournaments, tournamentEntries };
}
