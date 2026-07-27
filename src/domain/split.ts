import type { BookingParticipant, PaymentStatus, PlayerLevel } from "@/data/types";
import { addFils, type Fils, splitEvenly, subFils, ZERO } from "@/lib/money";

/**
 * Open matches and split payment.
 *
 * This is the feature that separates a padel system from a generic court
 * booker: two players book a court, list it as open at a level, two strangers
 * join, and the cost divides four ways with per-person payment status.
 */

export interface Share {
  participantId: string;
  customerId: string | null;
  guestName: string | null;
  share: Fils;
  paid: Fils;
  outstanding: Fils;
  settled: boolean;
  isBooker: boolean;
}

export interface SplitResult {
  shares: Share[];
  collected: Fils;
  outstanding: Fils;
  status: PaymentStatus;
}

/**
 * Divide a total across participants and report what each still owes.
 *
 * The remainder is deterministic — AED 90 across 4 is 22.50 × 4 exactly, but
 * AED 100 across 3 is not, and if the split is not deterministic the till never
 * reconciles. `splitEvenly` gives the extra fils to the earliest shares, and
 * the booker sorts first, so the person who made the commitment absorbs it.
 */
export function splitBooking(
  total: Fils,
  participants: BookingParticipant[],
): SplitResult {
  const ordered = [...participants].sort(
    (a, b) =>
      Number(b.isBooker) - Number(a.isBooker) ||
      a.joinedAt.getTime() - b.joinedAt.getTime(),
  );

  const amounts = splitEvenly(total, Math.max(ordered.length, 1));

  const shares: Share[] = ordered.map((p, i) => {
    const share = amounts[i] ?? ZERO;
    const outstanding = (Math.max(0, share - p.paid) as Fils);
    return {
      participantId: p.id,
      customerId: p.customerId,
      guestName: p.guestName,
      share,
      paid: p.paid,
      outstanding,
      settled: outstanding === 0,
      isBooker: p.isBooker,
    };
  });

  const collected = addFils(...shares.map((s) => s.paid));
  const outstanding = subFils(total, collected);

  let status: PaymentStatus = "unpaid";
  if (collected >= total && total > 0) status = "paid";
  else if (collected > 0) status = "part_paid";

  return {
    shares,
    collected,
    outstanding: (outstanding > 0 ? outstanding : 0) as Fils,
    status,
  };
}

/**
 * Seats still open on a match. Padel is four players; a booking listed as open
 * with two participants has two seats.
 */
export function openSeats(partySize: number, participantCount: number): number {
  return Math.max(0, partySize - participantCount);
}

/** Can this player join? Level bands are inclusive; an unrated player may always join. */
export function canJoin(
  level: PlayerLevel | null,
  levelMin: PlayerLevel | null,
  levelMax: PlayerLevel | null,
): boolean {
  if (level === null) return true;
  if (levelMin !== null && level < levelMin) return false;
  if (levelMax !== null && level > levelMax) return false;
  return true;
}

/**
 * What a joiner is quoted when they tap "join".
 *
 * The quote must be what they will actually pay after the split re-divides, not
 * the current per-head figure — a third player joining a two-player match sees
 * the four-way price if the match is set for four, because that is what they
 * will be charged when it fills.
 */
export function joinerQuote(total: Fils, partySize: number): Fils {
  return splitEvenly(total, Math.max(partySize, 1))[partySize - 1] ?? ZERO;
}
