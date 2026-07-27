import type {
  Court,
  MembershipTier,
  PriceLine,
  PricingRule,
  PromoCode,
} from "@/data/types";
import {
  addFils,
  type Fils,
  percentOf,
  subFils,
  ZERO,
} from "@/lib/money";
import { type LocalDate, venueWeekday, instantAt } from "@/lib/time";

/**
 * The pricing engine is table-driven.
 *
 * Rules are rows with a priority; the highest-priority matching rule wins. The
 * client edits them in the UI, because "change Friday evening rates" must never
 * be a deploy.
 *
 * It returns an itemised breakdown, not a number. The breakdown is what the
 * booking stores, what the receipt prints, and what the audit log quotes when
 * someone asks who gave the 50% discount.
 */

export interface QuoteInput {
  day: LocalDate;
  startMinute: number;
  durationMinutes: number;
  court: Court;
  tier: MembershipTier;
  rules: PricingRule[];
  promo?: PromoCode | null;
  /** Manual discount, applied after the promo. Requires a reason and an author. */
  discount?: { percent?: number; amount?: Fils; reason: string; appliedBy: string } | null;
  extras?: { code: string; label: string; labelAr: string; amount: Fils }[];
}

export interface Quote {
  lines: PriceLine[];
  subtotal: Fils;
  total: Fils;
  /** The rule that set the base rate, for "why is this price?" in the UI. */
  matchedRule: PricingRule | null;
}

function ruleMatches(rule: PricingRule, input: QuoteInput, weekday: number): boolean {
  if (!rule.active) return false;

  if (rule.weekdays.length > 0 && !rule.weekdays.includes(weekday)) return false;

  // The rule's window is matched against the slot's START, so a 21:00 booking
  // is peak-priced whether it runs 60 or 120 minutes. Splitting a booking
  // across two rate bands is a pricing model the client has not asked for and
  // would make receipts unexplainable at the counter.
  if (rule.fromMinute !== null && input.startMinute < rule.fromMinute) return false;
  if (rule.toMinute !== null && input.startMinute >= rule.toMinute) return false;

  if (rule.courtIds.length > 0 && !rule.courtIds.includes(input.court.id)) return false;
  if (
    rule.courtTags.length > 0 &&
    !rule.courtTags.some((t) => input.court.tags.includes(t))
  ) {
    return false;
  }

  if (rule.tiers.length > 0 && !rule.tiers.includes(input.tier)) return false;
  if (rule.durations.length > 0 && !rule.durations.includes(input.durationMinutes)) {
    return false;
  }

  return true;
}

/** Highest priority wins; ties break on the more specific rule. */
function specificity(r: PricingRule): number {
  return (
    r.weekdays.length +
    (r.fromMinute !== null ? 1 : 0) +
    (r.toMinute !== null ? 1 : 0) +
    r.courtIds.length +
    r.courtTags.length +
    r.tiers.length +
    r.durations.length
  );
}

export function quote(input: QuoteInput): Quote {
  const weekday = venueWeekday(instantAt(input.day, input.startMinute));

  const matched = input.rules
    .filter((r) => ruleMatches(r, input, weekday))
    .sort((a, b) => b.priority - a.priority || specificity(b) - specificity(a));

  const rule = matched[0] ?? null;
  const lines: PriceLine[] = [];

  if (rule) {
    lines.push({
      code: "court",
      label: rule.label,
      labelAr: rule.labelAr,
      amount: rule.amount,
    });
  } else {
    // No rule matched. This is a configuration gap, not a free booking — the
    // console surfaces it as "no rate configured" and refuses to confirm.
    lines.push({
      code: "court",
      label: "No rate configured",
      labelAr: "لا توجد تسعيرة",
      amount: ZERO,
    });
  }

  for (const extra of input.extras ?? []) {
    lines.push({
      code: extra.code,
      label: extra.label,
      labelAr: extra.labelAr,
      amount: extra.amount,
    });
  }

  const subtotal = addFils(...lines.map((l) => l.amount));
  let running = subtotal;

  if (input.promo && promoUsable(input.promo, input.day)) {
    const cut =
      input.promo.kind === "percent"
        ? percentOf(running, input.promo.value)
        : (Math.min(input.promo.value, running) as Fils);
    lines.push({
      code: "promo",
      label: `${input.promo.label} (${input.promo.code})`,
      labelAr: `${input.promo.labelAr} (${input.promo.code})`,
      amount: -cut as Fils,
    });
    running = subFils(running, cut);
  }

  if (input.discount) {
    const cut = input.discount.percent
      ? percentOf(running, input.discount.percent)
      : (Math.min(input.discount.amount ?? 0, running) as Fils);
    lines.push({
      code: "discount",
      label: "Discount",
      labelAr: "خصم",
      amount: -cut as Fils,
      reason: input.discount.reason,
      appliedBy: input.discount.appliedBy,
    });
    running = subFils(running, cut);
  }

  return { lines, subtotal, total: running, matchedRule: rule };
}

export function promoUsable(promo: PromoCode, day: LocalDate): boolean {
  if (!promo.active) return false;
  if (promo.from && day < promo.from) return false;
  if (promo.to && day > promo.to) return false;
  if (promo.maxUses !== null && promo.uses >= promo.maxUses) return false;
  return true;
}

/** Sum of a stored breakdown. The booking's `total` must always equal this. */
export function totalOf(lines: PriceLine[]): Fils {
  return addFils(...lines.map((l) => l.amount));
}

/** True when the quote is a configuration gap rather than a real price. */
export function isUnpriced(q: Quote): boolean {
  return q.matchedRule === null;
}
