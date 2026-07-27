import { RuleViolation, SlotTakenError } from "@/domain/errors";
import { addFils, type Fils, subFils, ZERO } from "@/lib/money";
import { normalisePhone } from "@/lib/text";
import {
  type LocalDate,
  operatingDayOf,
  overlaps,
} from "@/lib/time";
import type {
  AuditPort,
  AvailabilityPort,
  ClassesPort,
  CoachesPort,
  CourtsPort,
  CreateBookingInput,
  CustomersPort,
  Db,
  BookingsPort,
  NotificationsPort,
  ParticipantsPort,
  PaymentsPort,
  PoliciesPort,
  PricingPort,
  ProductsPort,
  SalesPort,
  SeriesPort,
  StaffPort,
  TillPort,
  TournamentsPort,
} from "../ports";
import type {
  AuditEntry,
  Booking,
  BookingParticipant,
  Id,
  NotificationRecord,
  Payment,
  Sale,
  TillSession,
} from "../types";
import { OCCUPYING_STATUSES } from "../types";
import { getStore, nextId, type Store } from "./store";

/**
 * The in-memory driver.
 *
 * Its job is not to be a database — it is to have EXACTLY the failure modes the
 * database will have, so that every screen written against it is already
 * correct when Postgres arrives. Specifically:
 *
 *   - `assertFree` mirrors
 *       exclude using gist (court_id with =, period with &&)
 *         where (status in ('held','confirmed','blocked'))
 *     and throws the same `SlotTakenError` the Supabase driver throws on 23P01.
 *   - holds carry a TTL and are swept, so `status` matters to occupancy.
 *   - every money-touching mutation appends an audit row.
 *
 * ⚠️ It is deliberately NOT safe against real concurrency — nothing in a single
 * JS process is. The point is that application code never gets to *rely* on
 * checking first, so the day the constraint is real, nothing above this line
 * changes.
 */

const DEFAULT_HOLD_TTL_MINUTES = 8;

/**
 * The exclusion constraint, in JS.
 *
 * `excludeBookingId` exists for moves: the row being moved must not conflict
 * with itself.
 */
function assertFree(
  store: Store,
  courtId: Id,
  start: Date,
  end: Date,
  excludeBookingId?: Id,
): void {
  const clash = store.bookings.find(
    (b) =>
      b.id !== excludeBookingId &&
      b.courtId === courtId &&
      OCCUPYING_STATUSES.includes(b.status) &&
      !isExpiredHold(b) &&
      overlaps(b.start, b.end, start, end),
  );
  if (clash) throw new SlotTakenError(courtId, start, end);
}

function isExpiredHold(b: Booking, now: Date = new Date()): boolean {
  return b.status === "held" && b.holdExpiresAt !== null && b.holdExpiresAt <= now;
}

function audit(
  store: Store,
  e: Omit<AuditEntry, "id" | "at">,
): AuditEntry {
  const row: AuditEntry = { ...e, id: nextId(store, "aud"), at: new Date() };
  store.audit.unshift(row);
  return row;
}

// ---------------------------------------------------------------------------

function courtsPort(store: Store): CourtsPort {
  return {
    async list() {
      return [...store.courts].sort((a, b) => a.ordinal - b.ordinal);
    },
    async get(id) {
      return store.courts.find((c) => c.id === id) ?? null;
    },
    async update(id, patch) {
      const i = store.courts.findIndex((c) => c.id === id);
      if (i < 0) throw new RuleViolation("court_missing", "No such court");
      store.courts[i] = { ...store.courts[i], ...patch };
      return store.courts[i];
    },
  };
}

function availabilityPort(store: Store): AvailabilityPort {
  return {
    async templates() {
      return [...store.templates];
    },
    async exceptionsForRange(from, to) {
      return store.exceptions.filter((e) => e.to >= from && e.from <= to);
    },
    async addException(ex) {
      const row = { ...ex, id: nextId(store, "exc") };
      store.exceptions.push(row);
      return row;
    },
    async removeException(id) {
      store.exceptions = store.exceptions.filter((e) => e.id !== id);
    },
  };
}

function bookingsPort(store: Store): BookingsPort {
  const byDay = (day: LocalDate) =>
    store.bookings.filter((b) => b.operatingDay === day);

  function create(input: CreateBookingInput): Booking {
    if (input.end <= input.start) {
      throw new RuleViolation("bad_period", "A booking must end after it starts");
    }
    assertFree(store, input.courtId, input.start, input.end);

    const total = addFils(...input.priceLines.map((l) => l.amount));
    const booking: Booking = {
      id: nextId(store, "bkg"),
      serial: store.nextSerial++,
      courtId: input.courtId,
      start: input.start,
      end: input.end,
      status: input.status,
      source: input.source,
      operatingDay: operatingDayOf(input.start),
      customerId: input.customerId,
      partySize: input.partySize,
      seriesId: input.seriesId ?? null,
      seriesException: null,
      openMatch: input.openMatch ?? false,
      levelMin: input.levelMin ?? null,
      levelMax: input.levelMax ?? null,
      priceLines: input.priceLines,
      total,
      paymentStatus: "unpaid",
      holdExpiresAt:
        input.status === "held"
          ? new Date(
              Date.now() +
                (input.holdTtlMinutes ?? DEFAULT_HOLD_TTL_MINUTES) * 60_000,
            )
          : null,
      notes: input.notes ?? "",
      createdBy: input.createdBy,
      createdAt: new Date(),
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      refundAmount: null,
      refundKind: null,
      blockReason: input.blockReason ?? null,
    };

    store.bookings.push(booking);
    return booking;
  }

  return {
    async listForDay(day) {
      return byDay(day).sort((a, b) => a.start.getTime() - b.start.getTime());
    },
    async listForRange(from, to) {
      return store.bookings
        .filter((b) => b.operatingDay >= from && b.operatingDay <= to)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
    },
    async listForCustomer(customerId) {
      const asParticipant = new Set(
        store.participants
          .filter((p) => p.customerId === customerId)
          .map((p) => p.bookingId),
      );
      return store.bookings
        .filter((b) => b.customerId === customerId || asParticipant.has(b.id))
        .sort((a, b) => b.start.getTime() - a.start.getTime());
    },
    async listOpenMatches(from, to) {
      const counts = new Map<string, number>();
      for (const p of store.participants) {
        counts.set(p.bookingId, (counts.get(p.bookingId) ?? 0) + 1);
      }
      return store.bookings
        .filter(
          (b) =>
            b.openMatch &&
            b.status === "confirmed" &&
            b.operatingDay >= from &&
            b.operatingDay <= to &&
            (counts.get(b.id) ?? 0) < b.partySize,
        )
        .sort((a, b) => a.start.getTime() - b.start.getTime());
    },
    async get(id) {
      return store.bookings.find((b) => b.id === id) ?? null;
    },

    async create(input) {
      const b = create(input);
      audit(store, {
        actorId: input.createdBy,
        action: b.status === "blocked" ? "booking.block" : "booking.create",
        entity: "booking",
        entityId: b.id,
        summary: `#${b.serial} created on ${b.courtId} (${b.source})`,
        summaryAr: `#${b.serial} أُنشئ على ${b.courtId}`,
        amount: b.total,
        reason: null,
      });
      return b;
    },

    async move(id, courtId, start, actorId) {
      const b = store.bookings.find((x) => x.id === id);
      if (!b) throw new RuleViolation("booking_missing", "No such booking");
      const duration = b.end.getTime() - b.start.getTime();
      const end = new Date(start.getTime() + duration);

      // Excluding itself is what makes a same-slot no-op move succeed rather
      // than conflicting with the row being moved.
      assertFree(store, courtId, start, end, id);

      const fromDesc = `${b.courtId} ${b.start.toISOString()}`;
      b.courtId = courtId;
      b.start = start;
      b.end = end;
      b.operatingDay = operatingDayOf(start);

      audit(store, {
        actorId,
        action: "booking.move",
        entity: "booking",
        entityId: b.id,
        summary: `#${b.serial} moved from ${fromDesc} to ${courtId} ${start.toISOString()}`,
        summaryAr: `#${b.serial} نُقل إلى ${courtId}`,
        amount: null,
        reason: null,
      });
      return b;
    },

    async confirmHold(id, actorId) {
      const b = store.bookings.find((x) => x.id === id);
      if (!b) throw new RuleViolation("booking_missing", "No such booking");

      // Order matters: an already-swept hold must report as EXPIRED, not as
      // "not a hold". The player is looking at a checkout page that just ran
      // out, and "this booking is not a hold" tells them nothing about what
      // happened or what to do next.
      if (b.status === "expired" || isExpiredHold(b)) {
        b.status = "expired";
        throw new RuleViolation("hold_expired", "The hold expired");
      }
      if (b.status !== "held") {
        throw new RuleViolation("not_held", "This booking is not a hold");
      }
      b.status = "confirmed";
      b.holdExpiresAt = null;

      audit(store, {
        actorId,
        action: "booking.confirm",
        entity: "booking",
        entityId: b.id,
        summary: `#${b.serial} confirmed`,
        summaryAr: `#${b.serial} تم تأكيده`,
        amount: b.total,
        reason: null,
      });
      return b;
    },

    async cancel(id, actorId, reason, refund) {
      const b = store.bookings.find((x) => x.id === id);
      if (!b) throw new RuleViolation("booking_missing", "No such booking");
      b.status = "cancelled";
      b.cancelledAt = new Date();
      b.cancelledBy = actorId;
      b.cancellationReason = reason;
      b.refundAmount = refund.amount;
      b.refundKind = refund.kind;

      if (refund.kind === "credit" && b.customerId && refund.amount > 0) {
        const c = store.customers.find((x) => x.id === b.customerId);
        if (c) c.creditBalance = addFils(c.creditBalance, refund.amount);
      }

      audit(store, {
        actorId,
        action: "booking.cancel",
        entity: "booking",
        entityId: b.id,
        summary: `#${b.serial} cancelled — ${refund.kind} ${refund.amount}`,
        summaryAr: `#${b.serial} أُلغي`,
        amount: refund.amount,
        reason,
      });
      return b;
    },

    async markNoShow(id, actorId) {
      const b = store.bookings.find((x) => x.id === id);
      if (!b) throw new RuleViolation("booking_missing", "No such booking");
      b.status = "no_show";
      if (b.customerId) {
        const c = store.customers.find((x) => x.id === b.customerId);
        if (c) c.noShowCount += 1;
      }
      audit(store, {
        actorId,
        action: "booking.no_show",
        entity: "booking",
        entityId: b.id,
        summary: `#${b.serial} marked no-show`,
        summaryAr: `#${b.serial} لم يحضر`,
        amount: null,
        reason: null,
      });
      return b;
    },

    async setPriceLines(id, lines, actorId) {
      const b = store.bookings.find((x) => x.id === id);
      if (!b) throw new RuleViolation("booking_missing", "No such booking");
      const before = b.total;
      b.priceLines = lines;
      b.total = addFils(...lines.map((l) => l.amount));

      const discount = lines.find((l) => l.code === "discount");
      audit(store, {
        actorId,
        action: discount ? "booking.discount" : "booking.reprice",
        entity: "booking",
        entityId: b.id,
        summary: `#${b.serial} repriced ${before} -> ${b.total}`,
        summaryAr: `#${b.serial} أُعيد تسعيره`,
        amount: subFils(b.total, before),
        reason: discount?.reason ?? null,
      });
      return b;
    },

    async setNotes(id, notes) {
      const b = store.bookings.find((x) => x.id === id);
      if (!b) throw new RuleViolation("booking_missing", "No such booking");
      b.notes = notes;
      return b;
    },

    // One call for N rows. The console's bulk bar and "cancel this series"
    // both land here rather than looping a single-row mutation.
    async cancelMany(ids, actorId, reason) {
      const cancelled: Id[] = [];
      const conflicted: Id[] = [];
      for (const id of ids) {
        const b = store.bookings.find((x) => x.id === id);
        if (!b || b.status === "cancelled") {
          conflicted.push(id);
          continue;
        }
        b.status = "cancelled";
        b.cancelledAt = new Date();
        b.cancelledBy = actorId;
        b.cancellationReason = reason;
        b.refundAmount = ZERO;
        b.refundKind = "none";
        cancelled.push(id);
      }
      audit(store, {
        actorId,
        action: "booking.cancel_bulk",
        entity: "booking",
        entityId: cancelled.join(","),
        summary: `${cancelled.length} bookings cancelled in bulk`,
        summaryAr: `تم إلغاء ${cancelled.length} حجزاً`,
        amount: null,
        reason,
      });
      return { cancelled, conflicted };
    },

    async blockMany(inputs) {
      const created: Booking[] = [];
      let conflicted = 0;
      for (const input of inputs) {
        try {
          created.push(create(input));
        } catch (e) {
          if (e instanceof SlotTakenError) conflicted++;
          else throw e;
        }
      }
      if (created.length > 0) {
        audit(store, {
          actorId: inputs[0].createdBy,
          action: "booking.block_bulk",
          entity: "booking",
          entityId: created.map((b) => b.id).join(","),
          summary: `${created.length} slots blocked, ${conflicted} already taken`,
          summaryAr: `تم حجز ${created.length} فترة`,
          amount: null,
          reason: inputs[0].blockReason ?? null,
        });
      }
      return { created, conflicted };
    },

    // The sweep. In production this is pg_cron plus /api/cron/expire-holds;
    // here it is the same logic so the UI never sees a stale hold.
    async expireHolds(now) {
      let n = 0;
      for (const b of store.bookings) {
        if (isExpiredHold(b, now)) {
          b.status = "expired";
          n++;
        }
      }
      return n;
    },
  };
}

function participantsPort(store: Store): ParticipantsPort {
  return {
    async listForBooking(bookingId) {
      return store.participants.filter((p) => p.bookingId === bookingId);
    },
    async listForBookings(bookingIds) {
      const set = new Set(bookingIds);
      return store.participants.filter((p) => set.has(p.bookingId));
    },
    async add(p) {
      const booking = store.bookings.find((b) => b.id === p.bookingId);
      if (!booking) throw new RuleViolation("booking_missing", "No such booking");
      const existing = store.participants.filter((x) => x.bookingId === p.bookingId);
      if (existing.length >= booking.partySize) {
        throw new RuleViolation("match_full", "This match is already full");
      }
      if (p.customerId && existing.some((x) => x.customerId === p.customerId)) {
        throw new RuleViolation("already_joined", "Already in this match");
      }
      const row: BookingParticipant = {
        ...p,
        id: nextId(store, "par"),
        joinedAt: new Date(),
      };
      store.participants.push(row);
      return row;
    },
    async remove(id) {
      store.participants = store.participants.filter((p) => p.id !== id);
    },
    async recordPayment(id, amount, at) {
      const p = store.participants.find((x) => x.id === id);
      if (!p) throw new RuleViolation("participant_missing", "No such participant");
      p.paid = addFils(p.paid, amount);
      p.paidAt = at;
      return p;
    },
    async settleMany(ids, at) {
      const set = new Set(ids);
      const out: BookingParticipant[] = [];
      for (const p of store.participants) {
        if (!set.has(p.id)) continue;
        p.paid = p.share;
        p.paidAt = at;
        out.push(p);
      }
      return out;
    },
  };
}

function seriesPort(store: Store): SeriesPort {
  return {
    async list() {
      return [...store.series];
    },
    async get(id) {
      return store.series.find((s) => s.id === id) ?? null;
    },
    async create(s) {
      const row = { ...s, id: nextId(store, "ser"), createdAt: new Date() };
      store.series.push(row);
      audit(store, {
        actorId: s.createdBy,
        action: "series.create",
        entity: "series",
        entityId: row.id,
        summary: `Weekly series created on ${s.courtId}`,
        summaryAr: `تم إنشاء حجز أسبوعي`,
        amount: null,
        reason: null,
      });
      return row;
    },
    async deactivate(id, actorId) {
      const s = store.series.find((x) => x.id === id);
      if (!s) throw new RuleViolation("series_missing", "No such series");
      s.active = false;
      audit(store, {
        actorId,
        action: "series.deactivate",
        entity: "series",
        entityId: id,
        summary: "Weekly series ended",
        summaryAr: "تم إنهاء الحجز الأسبوعي",
        amount: null,
        reason: null,
      });
      return s;
    },
    async exceptions(seriesId) {
      return seriesId
        ? store.seriesExceptions.filter((e) => e.seriesId === seriesId)
        : [...store.seriesExceptions];
    },
    async addException(ex) {
      const row = { ...ex, id: nextId(store, "sex") };
      store.seriesExceptions.push(row);
      return row;
    },
    async removeException(id) {
      store.seriesExceptions = store.seriesExceptions.filter((e) => e.id !== id);
    },
  };
}

function customersPort(store: Store): CustomersPort {
  return {
    async list() {
      return [...store.customers];
    },
    async get(id) {
      return store.customers.find((c) => c.id === id) ?? null;
    },
    async findByPhone(phone) {
      const key = normalisePhone(phone);
      if (!key) return null;
      return store.customers.find((c) => c.phone === key) ?? null;
    },
    async create(c) {
      const row = {
        ...c,
        phone: normalisePhone(c.phone),
        id: nextId(store, "cus"),
        createdAt: new Date(),
      };
      store.customers.push(row);
      return row;
    },
    async update(id, patch) {
      const c = store.customers.find((x) => x.id === id);
      if (!c) throw new RuleViolation("customer_missing", "No such customer");
      Object.assign(c, patch);
      if (patch.phone) c.phone = normalisePhone(patch.phone);
      return c;
    },
    async adjustCredit(id, delta, reason, actorId) {
      const c = store.customers.find((x) => x.id === id);
      if (!c) throw new RuleViolation("customer_missing", "No such customer");
      c.creditBalance = addFils(c.creditBalance, delta);
      audit(store, {
        actorId,
        action: "customer.credit",
        entity: "customer",
        entityId: id,
        summary: `Credit adjusted for ${c.name}`,
        summaryAr: `تم تعديل رصيد ${c.nameAr ?? c.name}`,
        amount: delta,
        reason,
      });
      return c;
    },
    async setBlocked(id, blocked, reason, actorId) {
      const c = store.customers.find((x) => x.id === id);
      if (!c) throw new RuleViolation("customer_missing", "No such customer");
      c.blocked = blocked;
      c.blockedReason = blocked ? reason : null;
      audit(store, {
        actorId,
        action: blocked ? "customer.block" : "customer.unblock",
        entity: "customer",
        entityId: id,
        summary: `${c.name} ${blocked ? "blocked" : "unblocked"}`,
        summaryAr: `${c.nameAr ?? c.name} ${blocked ? "محظور" : "غير محظور"}`,
        amount: null,
        reason,
      });
      return c;
    },
  };
}

function pricingPort(store: Store): PricingPort {
  return {
    async rules() {
      return [...store.pricingRules];
    },
    async saveRule(rule) {
      const i = store.pricingRules.findIndex((r) => r.id === rule.id);
      if (i >= 0) store.pricingRules[i] = rule;
      else store.pricingRules.push({ ...rule, id: rule.id || nextId(store, "px") });
      return rule;
    },
    async deleteRule(id) {
      store.pricingRules = store.pricingRules.filter((r) => r.id !== id);
    },
    async promos() {
      return [...store.promos];
    },
    async findPromo(code) {
      const key = code.trim().toUpperCase();
      return store.promos.find((p) => p.code.toUpperCase() === key) ?? null;
    },
    async savePromo(promo) {
      const i = store.promos.findIndex((p) => p.id === promo.id);
      if (i >= 0) store.promos[i] = promo;
      else store.promos.push({ ...promo, id: promo.id || nextId(store, "promo") });
      return promo;
    },
  };
}

function policiesPort(store: Store): PoliciesPort {
  return {
    async cancellation() {
      return [...store.cancellationPolicies];
    },
    async saveCancellation(p) {
      const i = store.cancellationPolicies.findIndex((x) => x.id === p.id);
      if (i >= 0) store.cancellationPolicies[i] = p;
      else store.cancellationPolicies.push({ ...p, id: p.id || nextId(store, "cx") });
      return p;
    },
  };
}

function paymentsPort(store: Store): PaymentsPort {
  return {
    async listForDay(day) {
      const ids = new Set(
        store.bookings.filter((b) => b.operatingDay === day).map((b) => b.id),
      );
      const saleIds = new Set(
        store.sales.filter((s) => s.operatingDay === day).map((s) => s.id),
      );
      return store.payments.filter(
        (p) =>
          (p.bookingId && ids.has(p.bookingId)) ||
          (p.saleId && saleIds.has(p.saleId)),
      );
    },
    async listForBooking(bookingId) {
      return store.payments.filter((p) => p.bookingId === bookingId);
    },
    async take(p) {
      const row: Payment = { ...p, id: nextId(store, "pay") };
      store.payments.push(row);

      if (row.bookingId) {
        const b = store.bookings.find((x) => x.id === row.bookingId);
        if (b) {
          const taken = addFils(
            ...store.payments
              .filter((x) => x.bookingId === b.id)
              .map((x) => x.amount),
          );
          b.paymentStatus =
            taken >= b.total && b.total > 0
              ? "paid"
              : taken > 0
                ? "part_paid"
                : "unpaid";
        }
      }

      audit(store, {
        actorId: row.takenBy,
        action: "payment.take",
        entity: "payment",
        entityId: row.id,
        summary: `Payment taken by ${row.method}`,
        summaryAr: `تم استلام دفعة (${row.method})`,
        amount: row.amount,
        reason: null,
      });
      return row;
    },
    async refund(paymentId, amount, actorId, reason) {
      const original = store.payments.find((p) => p.id === paymentId);
      if (!original) throw new RuleViolation("payment_missing", "No such payment");
      const row: Payment = {
        id: nextId(store, "pay"),
        bookingId: original.bookingId,
        saleId: original.saleId,
        participantId: original.participantId,
        amount: (-amount) as Fils,
        method: original.method,
        takenBy: actorId,
        takenAt: new Date(),
        tillSessionId: original.tillSessionId,
        refundOf: original.id,
        note: reason,
      };
      store.payments.push(row);
      audit(store, {
        actorId,
        action: "payment.refund",
        entity: "payment",
        entityId: row.id,
        summary: `Refund against payment ${original.id}`,
        summaryAr: `استرداد مقابل الدفعة ${original.id}`,
        amount: row.amount,
        reason,
      });
      return row;
    },
    async countDue(day) {
      return store.bookings.filter(
        (b) =>
          b.operatingDay === day &&
          b.status === "confirmed" &&
          b.paymentStatus !== "paid" &&
          b.total > 0,
      ).length;
    },
  };
}

function tillPort(store: Store): TillPort {
  return {
    async currentSession() {
      return store.tillSessions.find((s) => s.closedAt === null) ?? null;
    },
    async sessionsForRange(from, to) {
      return store.tillSessions.filter(
        (s) => s.operatingDay >= from && s.operatingDay <= to,
      );
    },
    async open(day, openingFloat, actorId) {
      if (store.tillSessions.some((s) => s.closedAt === null)) {
        throw new RuleViolation("till_open", "A shift is already open");
      }
      const row: TillSession = {
        id: nextId(store, "till"),
        operatingDay: day,
        openedBy: actorId,
        openedAt: new Date(),
        openingFloat,
        closedBy: null,
        closedAt: null,
        countedCash: null,
        variance: null,
        varianceNote: "",
      };
      store.tillSessions.push(row);
      audit(store, {
        actorId,
        action: "till.open",
        entity: "till",
        entityId: row.id,
        summary: `Shift opened with a float`,
        summaryAr: "تم فتح الوردية برصيد ابتدائي",
        amount: openingFloat,
        reason: null,
      });
      return row;
    },
    async close(id, countedCash, note, actorId) {
      const s = store.tillSessions.find((x) => x.id === id);
      if (!s) throw new RuleViolation("till_missing", "No such shift");

      // A shift's cash is what was taken BETWEEN open and close — bounded at
      // both ends. Without the upper bound, a payment stamped later than now
      // (a deposit against a future booking, or seeded data) is counted into a
      // drawer that never held it, and the shift shows a phantom shortfall.
      const closedAt = new Date();
      const cashTaken = addFils(
        ...store.payments
          .filter(
            (p) =>
              p.method === "cash" &&
              p.takenAt >= s.openedAt &&
              p.takenAt <= closedAt &&
              (p.tillSessionId === null || p.tillSessionId === s.id),
          )
          .map((p) => p.amount),
      );
      const expected = addFils(s.openingFloat, cashTaken);

      s.closedBy = actorId;
      s.closedAt = closedAt;
      s.countedCash = countedCash;
      s.variance = subFils(countedCash, expected);
      s.varianceNote = note;

      audit(store, {
        actorId,
        action: "till.close",
        entity: "till",
        entityId: s.id,
        summary: `Shift closed — variance ${s.variance}`,
        summaryAr: `تم إغلاق الوردية — الفرق ${s.variance}`,
        amount: s.variance,
        reason: note,
      });
      return s;
    },
  };
}

function coachesPort(store: Store): CoachesPort {
  return {
    async list() {
      return [...store.coaches];
    },
    async availability() {
      return [...store.coachAvailability];
    },
    async save(c) {
      const i = store.coaches.findIndex((x) => x.id === c.id);
      if (i >= 0) store.coaches[i] = c;
      else store.coaches.push({ ...c, id: c.id || nextId(store, "coa") });
      return c;
    },
  };
}

function classesPort(store: Store): ClassesPort {
  return {
    async listForRange(from, to) {
      const days = new Map(
        store.bookings.map((b) => [b.id, b.operatingDay] as const),
      );
      return store.classes.filter((c) => {
        const d = days.get(c.bookingId);
        return d !== undefined && d >= from && d <= to;
      });
    },
    async get(id) {
      return store.classes.find((c) => c.id === id) ?? null;
    },
    async enrolments(classIds) {
      if (!classIds) return [...store.enrolments];
      const set = new Set(classIds);
      return store.enrolments.filter((e) => set.has(e.classId));
    },
    async create(c) {
      const row = { ...c, id: nextId(store, "cls") };
      store.classes.push(row);
      return row;
    },
    async enrol(classId, customerId) {
      const cls = store.classes.find((c) => c.id === classId);
      if (!cls) throw new RuleViolation("class_missing", "No such class");
      const current = store.enrolments.filter((e) => e.classId === classId);
      if (current.length >= cls.capacity) {
        throw new RuleViolation("class_full", "This class is full");
      }
      if (current.some((e) => e.customerId === customerId)) {
        throw new RuleViolation("already_enrolled", "Already enrolled");
      }
      const row = {
        id: nextId(store, "enr"),
        classId,
        customerId,
        paid: ZERO,
        attended: null,
      };
      store.enrolments.push(row);
      return row;
    },
    async setAttendance(enrolmentId, attended) {
      const e = store.enrolments.find((x) => x.id === enrolmentId);
      if (!e) throw new RuleViolation("enrolment_missing", "No such enrolment");
      e.attended = attended;
      return e;
    },
  };
}

function productsPort(store: Store): ProductsPort {
  return {
    async list() {
      return [...store.products];
    },
    async save(p) {
      const i = store.products.findIndex((x) => x.id === p.id);
      if (i >= 0) store.products[i] = p;
      else store.products.push({ ...p, id: p.id || nextId(store, "prd") });
      return p;
    },
    async adjustStock(id, delta, reason, actorId) {
      const p = store.products.find((x) => x.id === id);
      if (!p) throw new RuleViolation("product_missing", "No such product");
      if (p.stock === null) {
        throw new RuleViolation("not_tracked", "This product is not stock-tracked");
      }
      p.stock += delta;
      audit(store, {
        actorId,
        action: "stock.adjust",
        entity: "product",
        entityId: id,
        summary: `${p.name} stock ${delta > 0 ? "+" : ""}${delta} -> ${p.stock}`,
        summaryAr: `${p.nameAr} المخزون ${p.stock}`,
        amount: null,
        reason,
      });
      return p;
    },
  };
}

function salesPort(store: Store): SalesPort {
  return {
    async listForDay(day) {
      return store.sales.filter((s) => s.operatingDay === day);
    },
    async create(input) {
      const total = addFils(...input.lines.map((l) => l.amount));
      const row: Sale = {
        id: nextId(store, "sale"),
        serial: store.nextSaleSerial++,
        bookingId: input.bookingId,
        customerId: input.customerId,
        operatingDay: input.day,
        lines: input.lines,
        total,
        paymentStatus: "unpaid",
        soldBy: input.soldBy,
        soldAt: new Date(),
      };
      store.sales.push(row);

      for (const line of input.lines) {
        const p = store.products.find((x) => x.id === line.productId);
        if (p && p.stock !== null) p.stock -= line.qty;
      }

      audit(store, {
        actorId: input.soldBy,
        action: "sale.create",
        entity: "sale",
        entityId: row.id,
        summary: `Sale #${row.serial}, ${input.lines.length} lines`,
        summaryAr: `بيع #${row.serial}`,
        amount: total,
        reason: null,
      });
      return row;
    },
  };
}

function tournamentsPort(store: Store): TournamentsPort {
  return {
    async list() {
      return [...store.tournaments];
    },
    async get(id) {
      return store.tournaments.find((t) => t.id === id) ?? null;
    },
    async entries(tournamentId) {
      return tournamentId
        ? store.tournamentEntries.filter((e) => e.tournamentId === tournamentId)
        : [...store.tournamentEntries];
    },
    async save(t) {
      const i = store.tournaments.findIndex((x) => x.id === t.id);
      if (i >= 0) store.tournaments[i] = t;
      else store.tournaments.push({ ...t, id: t.id || nextId(store, "trn") });
      return t;
    },
    async enter(tournamentId, customerId) {
      const t = store.tournaments.find((x) => x.id === tournamentId);
      if (!t) throw new RuleViolation("tournament_missing", "No such tournament");
      const current = store.tournamentEntries.filter(
        (e) => e.tournamentId === tournamentId,
      );
      if (current.length >= t.capacity) {
        throw new RuleViolation("tournament_full", "This tournament is full");
      }
      if (current.some((e) => e.customerId === customerId)) {
        throw new RuleViolation("already_entered", "Already entered");
      }
      const row = {
        id: nextId(store, "tre"),
        tournamentId,
        customerId,
        paid: ZERO,
        points: 0,
      };
      store.tournamentEntries.push(row);
      return row;
    },
  };
}

function staffPort(store: Store): StaffPort {
  return {
    async list() {
      return [...store.staff];
    },
    async get(id) {
      return store.staff.find((s) => s.id === id) ?? null;
    },
    async save(u) {
      const i = store.staff.findIndex((x) => x.id === u.id);
      if (i >= 0) store.staff[i] = u;
      else store.staff.push({ ...u, id: u.id || nextId(store, "usr") });
      return u;
    },
  };
}

function auditPort(store: Store): AuditPort {
  return {
    async recent(limit) {
      return store.audit.slice(0, limit);
    },
    async listForRange(from, to) {
      return store.audit.filter((e) => {
        const day = operatingDayOf(e.at);
        return day >= from && day <= to;
      });
    },
    async append(e) {
      return audit(store, e);
    },
  };
}

function notificationsPort(store: Store): NotificationsPort {
  return {
    async recent(limit) {
      return store.notifications.slice(0, limit);
    },
    // The adapter logs rather than sends. WhatsApp Business API access depends
    // on the client's entity and is not assumed; the queue shape is what the
    // real sender will consume.
    async queue(input) {
      const row: NotificationRecord = {
        id: nextId(store, "ntf"),
        channel: "whatsapp",
        kind: input.kind,
        to: input.to,
        body: input.body,
        bookingId: input.bookingId,
        queuedAt: new Date(),
        sentAt: null,
        error: null,
      };
      store.notifications.unshift(row);
      return row;
    },
  };
}

export function createMemoryDb(): Db {
  const store = getStore();
  return {
    courts: courtsPort(store),
    availability: availabilityPort(store),
    bookings: bookingsPort(store),
    participants: participantsPort(store),
    series: seriesPort(store),
    customers: customersPort(store),
    pricing: pricingPort(store),
    policies: policiesPort(store),
    payments: paymentsPort(store),
    till: tillPort(store),
    coaches: coachesPort(store),
    classes: classesPort(store),
    products: productsPort(store),
    sales: salesPort(store),
    tournaments: tournamentsPort(store),
    staff: staffPort(store),
    audit: auditPort(store),
    notifications: notificationsPort(store),
  };
}
