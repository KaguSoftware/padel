import type { Fils } from "@/lib/money";
import type { LocalDate } from "@/lib/time";

/**
 * Row types. These mirror the authored SQL in supabase/migrations one-for-one,
 * so the memory driver and the eventual Supabase driver return the same shapes.
 *
 * Instants are `Date` at this boundary; the drivers own ISO <-> Date parsing.
 */

export type Id = string;

// ---------------------------------------------------------------------------
// Venue, courts, availability
// ---------------------------------------------------------------------------

export type CourtSurface = "glass" | "panoramic" | "wall";
export type CourtEnclosure = "indoor" | "outdoor" | "covered";

export interface Court {
  id: Id;
  name: string;
  nameAr: string;
  ordinal: number;
  surface: CourtSurface;
  enclosure: CourtEnclosure;
  /** Rendered on the calendar column head; drives court-specific pricing rules. */
  tags: string[];
  active: boolean;
}

/** The normal week. Slots are computed from this, never stored. */
export interface AvailabilityTemplate {
  id: Id;
  courtId: Id | null; // null = applies to every court
  /** 0 = Sunday. */
  weekday: number;
  /** Minutes from the operating day's 06:00 start. */
  openMinute: number;
  closeMinute: number;
}

export type ExceptionKind =
  | "holiday"
  | "maintenance"
  | "ramadan"
  | "private"
  | "tournament";

/** Overrides the template for a date range. Ramadan hours are rows, never a code branch. */
export interface AvailabilityException {
  id: Id;
  courtId: Id | null;
  from: LocalDate;
  to: LocalDate;
  kind: ExceptionKind;
  /** null/null = fully closed for the range. */
  openMinute: number | null;
  closeMinute: number | null;
  note: string;
  noteAr: string;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type MembershipTier = "guest" | "member" | "premium";

/** Padel level, roughly the common 1.0–7.0 scale. */
export type PlayerLevel = number;

export interface Customer {
  id: Id;
  /** Normalised digits. THE practical primary key — dedupe is on this. */
  phone: string;
  name: string;
  nameAr: string | null;
  email: string | null;
  level: PlayerLevel | null;
  tier: MembershipTier;
  creditBalance: Fils;
  noShowCount: number;
  totalSpend: Fils;
  blocked: boolean;
  blockedReason: string | null;
  notes: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export type BookingStatus =
  | "held"
  | "confirmed"
  | "cancelled"
  | "no_show"
  | "expired"
  | "blocked";

/** Statuses that occupy a court. Mirrors the exclusion constraint's WHERE clause. */
export const OCCUPYING_STATUSES: readonly BookingStatus[] = [
  "held",
  "confirmed",
  "blocked",
];

export type BookingSource =
  | "web"
  | "walk_in"
  | "phone"
  | "staff"
  | "recurring"
  | "class"
  | "tournament";

export type PaymentStatus = "unpaid" | "part_paid" | "paid" | "refunded";

export interface PriceLine {
  code: string;
  label: string;
  labelAr: string;
  amount: Fils;
  /** Set on discount lines; the audit log requires a reason and an author. */
  reason?: string;
  appliedBy?: Id;
}

export interface Booking {
  id: Id;
  /** Human-facing serial printed on the slip. Ledger entries are numbered. */
  serial: number;
  courtId: Id;
  start: Date;
  end: Date;
  status: BookingStatus;
  source: BookingSource;
  /** The operating day this entry belongs to — 01:00 belongs to the previous page. */
  operatingDay: LocalDate;

  customerId: Id | null;
  partySize: number;

  seriesId: Id | null;
  /** Set when this instance deviates from its series rule. */
  seriesException: "moved" | "priced" | null;

  /** Open match: listed for strangers to join at a stated level band. */
  openMatch: boolean;
  levelMin: PlayerLevel | null;
  levelMax: PlayerLevel | null;

  priceLines: PriceLine[];
  total: Fils;
  paymentStatus: PaymentStatus;

  /** Wall-clock expiry for `held`. A sweep expires stragglers. */
  holdExpiresAt: Date | null;

  notes: string;
  createdBy: Id;
  createdAt: Date;

  cancelledAt: Date | null;
  cancelledBy: Id | null;
  cancellationReason: string | null;
  refundAmount: Fils | null;
  refundKind: "refund" | "credit" | "none" | null;

  /** Set on `blocked` rows only. */
  blockReason: string | null;
}

export interface BookingParticipant {
  id: Id;
  bookingId: Id;
  customerId: Id | null;
  /** For a guest a member brought who has no record yet. */
  guestName: string | null;
  share: Fils;
  paid: Fils;
  paidAt: Date | null;
  isBooker: boolean;
  joinedAt: Date;
}

// ---------------------------------------------------------------------------
// Recurring series
// ---------------------------------------------------------------------------

export interface BookingSeries {
  id: Id;
  courtId: Id;
  customerId: Id;
  /** 0 = Sunday. */
  weekday: number;
  startMinute: number;
  durationMinutes: number;
  from: LocalDate;
  /** null = open-ended; the rolling window materialises forward. */
  until: LocalDate | null;
  partySize: number;
  active: boolean;
  createdBy: Id;
  createdAt: Date;
}

export interface SeriesException {
  id: Id;
  seriesId: Id;
  /** The operating day the exception applies to. */
  day: LocalDate;
  kind: "skip" | "move" | "price";
  movedToStart: Date | null;
  movedToCourtId: Id | null;
  overrideTotal: Fils | null;
  reason: string;
}

// ---------------------------------------------------------------------------
// Pricing and policy — config rows, never code
// ---------------------------------------------------------------------------

export interface PricingRule {
  id: Id;
  label: string;
  labelAr: string;
  priority: number;
  /** Empty = every weekday. 0 = Sunday. */
  weekdays: number[];
  /** Minutes from 06:00. Empty bounds = all day. */
  fromMinute: number | null;
  toMinute: number | null;
  /** Empty = every court. */
  courtIds: Id[];
  courtTags: string[];
  /** Empty = every tier. */
  tiers: MembershipTier[];
  /** Empty = every duration. */
  durations: number[];
  /** Price for the whole slot, at the rule's duration. */
  amount: Fils;
  active: boolean;
}

export interface PromoCode {
  id: Id;
  code: string;
  label: string;
  labelAr: string;
  kind: "percent" | "amount";
  value: number;
  from: LocalDate | null;
  to: LocalDate | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
}

export interface CancellationPolicy {
  id: Id;
  label: string;
  labelAr: string;
  /** Cancel at least this many hours before start to get this tier's outcome. */
  hoursBefore: number;
  refundPercent: number;
  outcome: "refund" | "credit" | "none";
  priority: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Money: payments and the till
// ---------------------------------------------------------------------------

export type PaymentMethod = "cash" | "card" | "wallet" | "credit" | "transfer";

export interface Payment {
  id: Id;
  bookingId: Id | null;
  saleId: Id | null;
  participantId: Id | null;
  amount: Fils;
  method: PaymentMethod;
  takenBy: Id;
  takenAt: Date;
  tillSessionId: Id | null;
  refundOf: Id | null;
  note: string;
}

export interface TillSession {
  id: Id;
  operatingDay: LocalDate;
  openedBy: Id;
  openedAt: Date;
  openingFloat: Fils;
  closedBy: Id | null;
  closedAt: Date | null;
  countedCash: Fils | null;
  /** counted - (float + cash takings). Negative means short. */
  variance: Fils | null;
  varianceNote: string;
}

// ---------------------------------------------------------------------------
// Coaching
// ---------------------------------------------------------------------------

export interface Coach {
  id: Id;
  name: string;
  nameAr: string;
  phone: string;
  /** Percent of lesson revenue. */
  commissionPercent: number;
  active: boolean;
}

export interface CoachAvailability {
  id: Id;
  coachId: Id;
  weekday: number;
  fromMinute: number;
  toMinute: number;
}

export interface ClassSession {
  id: Id;
  coachId: Id;
  bookingId: Id;
  title: string;
  titleAr: string;
  capacity: number;
  pricePerHead: Fils;
  levelMin: PlayerLevel | null;
  levelMax: PlayerLevel | null;
}

export interface ClassEnrolment {
  id: Id;
  classId: Id;
  customerId: Id;
  paid: Fils;
  attended: boolean | null;
}

// ---------------------------------------------------------------------------
// Pro shop / F&B
// ---------------------------------------------------------------------------

export type ProductCategory = "equipment" | "consumable" | "drink" | "food" | "rental";

export interface Product {
  id: Id;
  sku: string;
  name: string;
  nameAr: string;
  category: ProductCategory;
  price: Fils;
  /** null = not stock-tracked (a rental returns). */
  stock: number | null;
  lowStockAt: number | null;
  active: boolean;
}

export interface Sale {
  id: Id;
  serial: number;
  bookingId: Id | null;
  customerId: Id | null;
  operatingDay: LocalDate;
  lines: SaleLine[];
  total: Fils;
  paymentStatus: PaymentStatus;
  soldBy: Id;
  soldAt: Date;
}

export interface SaleLine {
  productId: Id;
  qty: number;
  unitPrice: Fils;
  amount: Fils;
}

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------

export type TournamentFormat = "americano" | "mexicano" | "round_robin" | "knockout";

export interface Tournament {
  id: Id;
  name: string;
  nameAr: string;
  format: TournamentFormat;
  day: LocalDate;
  startMinute: number;
  endMinute: number;
  courtIds: Id[];
  entryFee: Fils;
  capacity: number;
  levelMin: PlayerLevel | null;
  levelMax: PlayerLevel | null;
  status: "draft" | "open" | "running" | "done" | "cancelled";
}

export interface TournamentEntry {
  id: Id;
  tournamentId: Id;
  customerId: Id;
  paid: Fils;
  points: number;
}

// ---------------------------------------------------------------------------
// Staff and audit
// ---------------------------------------------------------------------------

export type Role = "owner" | "manager" | "staff" | "coach" | "player";

export interface StaffUser {
  id: Id;
  name: string;
  nameAr: string;
  role: Role;
  phone: string;
  active: boolean;
}

/** Append-only. Every money-touching mutation writes one. */
export interface AuditEntry {
  id: Id;
  at: Date;
  actorId: Id;
  action: string;
  entity: string;
  entityId: Id;
  /** Human-readable, already resolved — the log must be readable without joins. */
  summary: string;
  summaryAr: string;
  amount: Fils | null;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationChannel = "whatsapp" | "sms" | "email";
export type NotificationKind =
  | "booking_confirmed"
  | "booking_reminder"
  | "booking_cancelled"
  | "match_filled"
  | "payment_due"
  | "series_materialised";

export interface NotificationRecord {
  id: Id;
  channel: NotificationChannel;
  kind: NotificationKind;
  to: string;
  body: string;
  bookingId: Id | null;
  queuedAt: Date;
  sentAt: Date | null;
  error: string | null;
}
