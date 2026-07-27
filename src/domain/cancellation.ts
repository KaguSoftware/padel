import type { Booking, CancellationPolicy } from "@/data/types";
import { type Fils, percentOf, ZERO } from "@/lib/money";

/**
 * Cancellation policy is data, not code.
 *
 * Hours-before threshold, refund percentage, refund-vs-credit: all config rows,
 * because the client will change them three times in the first month. Nothing
 * here hard-codes a number.
 */

export interface CancellationOutcome {
  policy: CancellationPolicy | null;
  refundAmount: Fils;
  refundKind: "refund" | "credit" | "none";
  hoursBefore: number;
  /** Shown at the counter before the staff member confirms. */
  explanation: string;
  explanationAr: string;
}

/**
 * The applicable tier is the one with the LARGEST `hoursBefore` the customer
 * still satisfies. Cancelling 50 hours out satisfies both the 48h and the 12h
 * tiers; the 48h tier is the generous one and the one that applies.
 */
export function resolveCancellation(
  booking: Booking,
  policies: CancellationPolicy[],
  at: Date = new Date(),
): CancellationOutcome {
  const hoursBefore = (booking.start.getTime() - at.getTime()) / 3_600_000;

  const policy =
    policies
      .filter((p) => p.active && hoursBefore >= p.hoursBefore)
      .sort((a, b) => b.hoursBefore - a.hoursBefore || b.priority - a.priority)[0] ??
    null;

  if (!policy) {
    return {
      policy: null,
      refundAmount: ZERO,
      refundKind: "none",
      hoursBefore,
      explanation: "Inside the no-refund window — nothing is returned.",
      explanationAr: "ضمن فترة عدم الاسترداد — لا يُعاد أي مبلغ.",
    };
  }

  // Refund what was actually taken, never the headline price. A partly-paid
  // booking cannot refund more than the customer handed over.
  const paid = booking.paymentStatus === "unpaid" ? ZERO : booking.total;
  const refundAmount =
    policy.outcome === "none" ? ZERO : percentOf(paid, policy.refundPercent);

  return {
    policy,
    refundAmount,
    refundKind: policy.outcome,
    hoursBefore,
    explanation: `${policy.label}: ${policy.refundPercent}% as ${policy.outcome}.`,
    explanationAr: `${policy.labelAr}: ${policy.refundPercent}٪ ${
      policy.outcome === "credit" ? "كرصيد" : "استرداد"
    }.`,
  };
}

/** Would this cancellation be free? Used to soften the confirm dialog's copy. */
export function isFreeCancellation(outcome: CancellationOutcome): boolean {
  return outcome.policy !== null && outcome.policy.refundPercent >= 100;
}
