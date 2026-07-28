import type { Fils } from "@/lib/money";
import type { LocalDate } from "@/lib/time";
import type {
  Account,
  AuditEntry,
  AvailabilityException,
  AvailabilityTemplate,
  Booking,
  BookingParticipant,
  BookingSeries,
  BookingSource,
  CancellationPolicy,
  ClassEnrolment,
  ClassSession,
  Coach,
  CoachAvailability,
  Court,
  Customer,
  Id,
  NotificationKind,
  NotificationRecord,
  Payment,
  PaymentMethod,
  PriceLine,
  PricingRule,
  Product,
  PromoCode,
  PublicAccount,
  Role,
  Sale,
  SaleLine,
  SeriesException,
  StaffUser,
  TillSession,
  Tournament,
  TournamentEntry,
} from "./types";

/**
 * The repository contract.
 *
 * Both drivers implement this identically, including their failure modes: an
 * overlapping write throws `SlotTakenError` whether it came from the memory
 * driver's own check or from Postgres 23P01. That is the whole point — the UI's
 * conflict path is written once and is already correct on the day the database
 * arrives.
 */

export interface CourtsPort {
  list(): Promise<Court[]>;
  get(id: Id): Promise<Court | null>;
  update(id: Id, patch: Partial<Court>): Promise<Court>;
}

export interface AvailabilityPort {
  templates(): Promise<AvailabilityTemplate[]>;
  exceptionsForRange(from: LocalDate, to: LocalDate): Promise<AvailabilityException[]>;
  addException(ex: Omit<AvailabilityException, "id">): Promise<AvailabilityException>;
  removeException(id: Id): Promise<void>;
}

export interface CreateBookingInput {
  courtId: Id;
  start: Date;
  end: Date;
  status: Extract<Booking["status"], "held" | "confirmed" | "blocked">;
  source: BookingSource;
  customerId: Id | null;
  partySize: number;
  priceLines: PriceLine[];
  createdBy: Id;
  seriesId?: Id | null;
  openMatch?: boolean;
  levelMin?: number | null;
  levelMax?: number | null;
  holdTtlMinutes?: number;
  notes?: string;
  blockReason?: string | null;
}

export interface BookingsPort {
  /** ONE range query across every court. Never call this per court. */
  listForDay(day: LocalDate): Promise<Booking[]>;
  listForRange(from: LocalDate, to: LocalDate): Promise<Booking[]>;
  listForCustomer(customerId: Id): Promise<Booking[]>;
  listOpenMatches(from: LocalDate, to: LocalDate): Promise<Booking[]>;
  get(id: Id): Promise<Booking | null>;

  /** Throws SlotTakenError on overlap. Never check-then-write. */
  create(input: CreateBookingInput): Promise<Booking>;
  /** Throws SlotTakenError if the destination is occupied; the origin is freed atomically. */
  move(id: Id, courtId: Id, start: Date, actorId: Id): Promise<Booking>;
  confirmHold(id: Id, actorId: Id): Promise<Booking>;
  cancel(
    id: Id,
    actorId: Id,
    reason: string,
    refund: { amount: Fils; kind: "refund" | "credit" | "none" },
  ): Promise<Booking>;
  markNoShow(id: Id, actorId: Id): Promise<Booking>;
  setPriceLines(id: Id, lines: PriceLine[], actorId: Id): Promise<Booking>;
  setNotes(id: Id, notes: string): Promise<Booking>;

  /** Bulk: one round-trip for N rows, never one per row. */
  cancelMany(
    ids: Id[],
    actorId: Id,
    reason: string,
  ): Promise<{ cancelled: Id[]; conflicted: Id[] }>;
  blockMany(inputs: CreateBookingInput[]): Promise<{ created: Booking[]; conflicted: number }>;

  /** The hold sweep. Returns how many expired. */
  expireHolds(now: Date): Promise<number>;
}

export interface ParticipantsPort {
  listForBooking(bookingId: Id): Promise<BookingParticipant[]>;
  listForBookings(bookingIds: Id[]): Promise<BookingParticipant[]>;
  add(
    p: Omit<BookingParticipant, "id" | "joinedAt">,
  ): Promise<BookingParticipant>;
  remove(id: Id): Promise<void>;
  recordPayment(id: Id, amount: Fils, at: Date): Promise<BookingParticipant>;
  /** Settle several shares in one round-trip. */
  settleMany(ids: Id[], at: Date): Promise<BookingParticipant[]>;
}

export interface SeriesPort {
  list(): Promise<BookingSeries[]>;
  get(id: Id): Promise<BookingSeries | null>;
  create(s: Omit<BookingSeries, "id" | "createdAt">): Promise<BookingSeries>;
  deactivate(id: Id, actorId: Id): Promise<BookingSeries>;
  exceptions(seriesId?: Id): Promise<SeriesException[]>;
  addException(ex: Omit<SeriesException, "id">): Promise<SeriesException>;
  removeException(id: Id): Promise<void>;
}

export interface CustomersPort {
  list(): Promise<Customer[]>;
  get(id: Id): Promise<Customer | null>;
  /** Dedupe is on the normalised phone; this is the lookup staff actually use. */
  findByPhone(phone: string): Promise<Customer | null>;
  create(c: Omit<Customer, "id" | "createdAt">): Promise<Customer>;
  update(id: Id, patch: Partial<Customer>): Promise<Customer>;
  adjustCredit(id: Id, delta: Fils, reason: string, actorId: Id): Promise<Customer>;
  setBlocked(id: Id, blocked: boolean, reason: string, actorId: Id): Promise<Customer>;
}

export interface PricingPort {
  rules(): Promise<PricingRule[]>;
  saveRule(rule: PricingRule): Promise<PricingRule>;
  deleteRule(id: Id): Promise<void>;
  promos(): Promise<PromoCode[]>;
  findPromo(code: string): Promise<PromoCode | null>;
  savePromo(promo: PromoCode): Promise<PromoCode>;
}

export interface PoliciesPort {
  cancellation(): Promise<CancellationPolicy[]>;
  saveCancellation(p: CancellationPolicy): Promise<CancellationPolicy>;
}

export interface PaymentsPort {
  listForDay(day: LocalDate): Promise<Payment[]>;
  listForBooking(bookingId: Id): Promise<Payment[]>;
  take(p: Omit<Payment, "id">): Promise<Payment>;
  refund(paymentId: Id, amount: Fils, actorId: Id, reason: string): Promise<Payment>;
  countDue(day: LocalDate): Promise<number>;
}

export interface TillPort {
  currentSession(): Promise<TillSession | null>;
  sessionsForRange(from: LocalDate, to: LocalDate): Promise<TillSession[]>;
  open(day: LocalDate, openingFloat: Fils, actorId: Id): Promise<TillSession>;
  close(
    id: Id,
    countedCash: Fils,
    note: string,
    actorId: Id,
  ): Promise<TillSession>;
}

export interface CoachesPort {
  list(): Promise<Coach[]>;
  availability(): Promise<CoachAvailability[]>;
  save(c: Coach): Promise<Coach>;
}

export interface ClassesPort {
  listForRange(from: LocalDate, to: LocalDate): Promise<ClassSession[]>;
  get(id: Id): Promise<ClassSession | null>;
  enrolments(classIds?: Id[]): Promise<ClassEnrolment[]>;
  create(c: Omit<ClassSession, "id">): Promise<ClassSession>;
  enrol(classId: Id, customerId: Id): Promise<ClassEnrolment>;
  setAttendance(enrolmentId: Id, attended: boolean): Promise<ClassEnrolment>;
}

export interface ProductsPort {
  list(): Promise<Product[]>;
  save(p: Product): Promise<Product>;
  adjustStock(id: Id, delta: number, reason: string, actorId: Id): Promise<Product>;
}

export interface SalesPort {
  listForDay(day: LocalDate): Promise<Sale[]>;
  create(input: {
    lines: SaleLine[];
    bookingId: Id | null;
    customerId: Id | null;
    soldBy: Id;
    day: LocalDate;
  }): Promise<Sale>;
}

export interface TournamentsPort {
  list(): Promise<Tournament[]>;
  get(id: Id): Promise<Tournament | null>;
  entries(tournamentId?: Id): Promise<TournamentEntry[]>;
  save(t: Tournament): Promise<Tournament>;
  enter(tournamentId: Id, customerId: Id): Promise<TournamentEntry>;
}

export interface StaffPort {
  list(): Promise<StaffUser[]>;
  get(id: Id): Promise<StaffUser | null>;
  save(u: StaffUser): Promise<StaffUser>;
}

export interface CreateAccountInput {
  email: string;
  passwordHash: string;
  passwordSalt: string;
  name: string;
  role: Role;
  customerId: Id | null;
  staffId: Id | null;
}

/**
 * Logins.
 *
 * `findForSignIn` is the ONE method that returns the stored hash, and it is
 * named so that a call site holding a secret is visible in a grep. Everything
 * else returns `PublicAccount`, so a password hash cannot reach a page by
 * accident — the usual way hashes end up in an RSC payload is a port that
 * returns the whole row and a component that spreads it.
 */
export interface AccountsPort {
  list(): Promise<PublicAccount[]>;
  get(id: Id): Promise<PublicAccount | null>;
  /** Returns the credential. Only the sign-in path may call this. */
  findForSignIn(email: string): Promise<Account | null>;
  /** Throws EmailTakenError on a duplicate. Never check-then-insert. */
  create(input: CreateAccountInput): Promise<PublicAccount>;
  setActive(id: Id, active: boolean, actorId: Id): Promise<PublicAccount>;
  recordSignIn(id: Id, at: Date): Promise<PublicAccount>;
  /** Attaches a player login to the customer row it acts as. */
  setCustomer(id: Id, customerId: Id): Promise<PublicAccount>;
}

export interface AuditPort {
  /** Newest first. */
  recent(limit: number): Promise<AuditEntry[]>;
  listForRange(from: LocalDate, to: LocalDate): Promise<AuditEntry[]>;
  /** Append-only. There is deliberately no update or delete. */
  append(e: Omit<AuditEntry, "id" | "at">): Promise<AuditEntry>;
}

export interface NotificationsPort {
  recent(limit: number): Promise<NotificationRecord[]>;
  queue(input: {
    kind: NotificationKind;
    to: string;
    body: string;
    bookingId: Id | null;
  }): Promise<NotificationRecord>;
}

export interface Db {
  accounts: AccountsPort;
  courts: CourtsPort;
  availability: AvailabilityPort;
  bookings: BookingsPort;
  participants: ParticipantsPort;
  series: SeriesPort;
  customers: CustomersPort;
  pricing: PricingPort;
  policies: PoliciesPort;
  payments: PaymentsPort;
  till: TillPort;
  coaches: CoachesPort;
  classes: ClassesPort;
  products: ProductsPort;
  sales: SalesPort;
  tournaments: TournamentsPort;
  staff: StaffPort;
  audit: AuditPort;
  notifications: NotificationsPort;
}

export type { PaymentMethod };
