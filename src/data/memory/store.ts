import { dirhams, fils } from "@/lib/money";
import { todayInDubai } from "@/lib/time";
import { seedTrading } from "../seed/bookings";
import {
  CANCELLATION_POLICIES,
  COACHES,
  COACH_AVAILABILITY,
  COURTS,
  CUSTOMERS,
  EXCEPTIONS,
  PRICING_RULES,
  PRODUCTS,
  PROMOS,
  STAFF,
  TEMPLATES,
} from "../seed/reference";
import type {
  AuditEntry,
  AvailabilityException,
  AvailabilityTemplate,
  Booking,
  BookingParticipant,
  BookingSeries,
  CancellationPolicy,
  ClassEnrolment,
  ClassSession,
  Coach,
  CoachAvailability,
  Court,
  Customer,
  NotificationRecord,
  Payment,
  PricingRule,
  Product,
  PromoCode,
  Sale,
  SeriesException,
  StaffUser,
  TillSession,
  Tournament,
  TournamentEntry,
} from "../types";

/**
 * The in-memory store.
 *
 * Held on globalThis so it survives Next's dev-server module reloading —
 * without that, every hot reload silently reverts the bookings a demo just
 * made, which reads as data loss.
 */

export interface Store {
  courts: Court[];
  templates: AvailabilityTemplate[];
  exceptions: AvailabilityException[];
  customers: Customer[];
  bookings: Booking[];
  participants: BookingParticipant[];
  series: BookingSeries[];
  seriesExceptions: SeriesException[];
  pricingRules: PricingRule[];
  promos: PromoCode[];
  cancellationPolicies: CancellationPolicy[];
  payments: Payment[];
  tillSessions: TillSession[];
  coaches: Coach[];
  coachAvailability: CoachAvailability[];
  classes: ClassSession[];
  enrolments: ClassEnrolment[];
  products: Product[];
  sales: Sale[];
  tournaments: Tournament[];
  tournamentEntries: TournamentEntry[];
  staff: StaffUser[];
  audit: AuditEntry[];
  notifications: NotificationRecord[];
  nextSerial: number;
  nextSaleSerial: number;
  seq: number;
}

function build(): Store {
  const today = todayInDubai();
  const trading = seedTrading(today);

  const store: Store = {
    courts: structuredCloneish(COURTS),
    templates: structuredCloneish(TEMPLATES),
    exceptions: structuredCloneish(EXCEPTIONS),
    customers: structuredCloneish(CUSTOMERS),
    bookings: trading.bookings,
    participants: trading.participants,
    series: trading.series,
    seriesExceptions: trading.seriesExceptions,
    pricingRules: structuredCloneish(PRICING_RULES),
    promos: structuredCloneish(PROMOS),
    cancellationPolicies: structuredCloneish(CANCELLATION_POLICIES),
    payments: trading.payments,
    tillSessions: [],
    coaches: structuredCloneish(COACHES),
    coachAvailability: structuredCloneish(COACH_AVAILABILITY),
    classes: trading.classes,
    enrolments: trading.enrolments,
    products: structuredCloneish(PRODUCTS),
    sales: [],
    tournaments: trading.tournaments,
    tournamentEntries: trading.tournamentEntries,
    staff: structuredCloneish(STAFF),
    audit: [],
    notifications: [],
    nextSerial: trading.nextSerial,
    nextSaleSerial: 1201,
    seq: 0,
  };

  // An open till session for today, so the console has a shift to reconcile.
  store.tillSessions.push({
    id: "till-today",
    operatingDay: today,
    openedBy: "usr-desk-1",
    openedAt: new Date(),
    openingFloat: dirhams(500),
    closedBy: null,
    closedAt: null,
    countedCash: null,
    variance: null,
    varianceNote: "",
  });

  // A closed session from yesterday with a small shortfall — the module exists
  // to make exactly this visible.
  const yesterday = store.bookings.find((b) => b.operatingDay < today)?.operatingDay;
  if (yesterday) {
    store.tillSessions.push({
      id: "till-yesterday",
      operatingDay: yesterday,
      openedBy: "usr-desk-2",
      openedAt: new Date(Date.now() - 86_400_000),
      openingFloat: dirhams(500),
      closedBy: "usr-desk-2",
      closedAt: new Date(Date.now() - 50_400_000),
      countedCash: dirhams(1_465),
      variance: fils(-3_500),
      varianceNote: "Short AED 35 — no explanation found; flagged to O. Haddad",
    });
  }

  store.audit.push({
    id: "aud-seed",
    at: new Date(),
    actorId: "usr-manager",
    action: "system.seed",
    entity: "system",
    entityId: "seed",
    summary: "Prototype seeded with synthetic trading data",
    summaryAr: "تمت تهيئة النموذج ببيانات تجريبية",
    amount: null,
    reason: null,
  });

  return store;
}

/** Cheap deep copy for plain seed rows (no Dates in the reference tables). */
function structuredCloneish<T>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r }) as T);
}

declare global {
  var __kaguPadelStore: Store | undefined;
}

export function getStore(): Store {
  if (!globalThis.__kaguPadelStore) {
    globalThis.__kaguPadelStore = build();
  }
  return globalThis.__kaguPadelStore;
}

/** Test helper — never called by the app. */
export function resetStore(): Store {
  globalThis.__kaguPadelStore = build();
  return globalThis.__kaguPadelStore;
}

export function nextId(store: Store, prefix: string): string {
  store.seq += 1;
  return `${prefix}-${store.seq.toString(36)}-${Date.now().toString(36)}`;
}
