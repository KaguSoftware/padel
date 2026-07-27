/**
 * The conflict every driver must produce identically.
 *
 * The memory driver throws this from its overlap check; the Supabase driver
 * throws it when Postgres raises 23P01 against
 *   exclude using gist (court_id with =, period with &&)
 *     where (status in ('held','confirmed','blocked'))
 *
 * Because both produce the same error, the UI's "just taken" path is written
 * once and is already correct on the day the database arrives. Application code
 * must never try to prevent the conflict by checking first — read-then-write is
 * exactly the race the constraint exists to close.
 */
export class SlotTakenError extends Error {
  readonly courtId: string;
  readonly start: Date;
  readonly end: Date;

  constructor(courtId: string, start: Date, end: Date) {
    super(`Court ${courtId} is already booked for ${start.toISOString()}–${end.toISOString()}`);
    this.name = "SlotTakenError";
    this.courtId = courtId;
    this.start = start;
    this.end = end;
  }
}

export function isSlotTaken(e: unknown): e is SlotTakenError {
  return e instanceof SlotTakenError;
}

/** A hold that expired, or was released, before checkout completed. */
export class HoldExpiredError extends Error {
  readonly bookingId: string;
  constructor(bookingId: string) {
    super(`Hold ${bookingId} has expired`);
    this.name = "HoldExpiredError";
    this.bookingId = bookingId;
  }
}

/** The court is closed at the requested time, per template + exceptions. */
export class CourtClosedError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`Court is closed: ${reason}`);
    this.name = "CourtClosedError";
    this.reason = reason;
  }
}

/** A domain rule refused the write. Carries a message safe to show a user. */
export class RuleViolation extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RuleViolation";
    this.code = code;
  }
}
