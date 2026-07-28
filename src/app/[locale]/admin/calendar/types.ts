/**
 * The board's view model.
 *
 * Assembled on the server in `page.tsx`, where the rows already are, and shaped
 * to cross the RSC boundary: `Date` becomes an ISO string, the grid's `Map`
 * becomes closed runs, and nothing here is unserialisable.
 *
 * Kept in its own file so the server page and the client board can both name
 * these types without the page pulling a `"use client"` module into its graph.
 */

import type {
  BookingSource,
  BookingStatus,
  MembershipTier,
  PaymentStatus,
} from "@/data/types";
import type { Fils } from "@/lib/money";
import type { ClosedRun } from "./geometry";

export interface CourtLane {
  id: string;
  name: string;
  enclosure: string;
  /** A note from an availability exception — "Ramadan hours", "resurfacing". */
  closedNote: string | null;
  /** Closed stretches, per cell rather than per court. See geometry.ts. */
  closedRuns: ClosedRun[];
  /** No open band anywhere today. */
  shut: boolean;
}

export interface SlipView {
  id: string;
  serial: number;
  courtId: string;
  /** Minutes from 06:00. */
  startMinute: number;
  durationMinutes: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  source: BookingSource;
  openMatch: boolean;
  partySize: number;
  participantCount: number;
  customerName: string;
  customerPhone: string;
  total: Fils;
  outstanding: Fils;
  holdExpiresAt: string | null;
  holdIssuedAt: string | null;
  isSeries: boolean;
  blockReason: string | null;
}

export interface CustomerOption {
  id: string;
  name: string;
  altName: string;
  phone: string;
  tier: MembershipTier;
  level: number | null;
  blocked: boolean;
}

/** One day in the week strip: how full it was, and whether it is this one. */
export interface DayMark {
  day: string;
  /** Locale-formatted weekday initial and date, resolved on the server. */
  weekday: string;
  dayOfMonth: string;
  utilisation: number;
  isToday: boolean;
}

/**
 * What the board flags for attention. Counted on the server so the chips can
 * show their number before a single card is measured.
 */
export interface Attention {
  holds: number;
  unpaid: number;
  seats: number;
  blocked: number;
}

export type AttentionKey = "all" | keyof Attention;
