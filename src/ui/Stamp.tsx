import type { Booking, BookingStatus, PaymentStatus } from "@/data/types";
import { cn } from "./cn";

/**
 * Status on the board.
 *
 * Never hue alone. Every state is a WORD as well as a colour, because the board
 * is read at a glance across a room, in floodlight, sometimes by someone who
 * does not distinguish red from green.
 *
 * Optic yellow is reserved: it means available-to-take or live, and nothing
 * else in the product may use it. Amber belongs to the mechanical digits. Clay
 * is the alert.
 *
 * The exported API is unchanged from the first build so every screen inherits
 * the new world without a rewrite.
 */

export type StampTone =
  | "held"
  | "confirmed"
  | "paid"
  | "due"
  | "part"
  | "noshow"
  | "blocked"
  | "void"
  | "seats";

const TONE: Record<StampTone, string> = {
  held: "bg-amber text-court-deep",
  confirmed: "bg-line/15 text-line",
  paid: "bg-ball text-court-deep",
  due: "bg-clay text-line",
  part: "border border-amber text-amber",
  noshow: "border border-line/30 text-line-dim line-through",
  blocked: "border border-line/25 text-line-dim",
  void: "border border-line/20 text-line-dim",
  seats: "bg-ball text-court-deep",
};

interface Props {
  tone: StampTone;
  children: React.ReactNode;
  /** Plays the flap-in on the action that caused it. */
  land?: boolean;
  className?: string;
  title?: string;
}

export function Stamp({ tone, children, land, className, title }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-1 font-board text-[10px] font-bold uppercase leading-none tracking-[0.16em]",
        TONE[tone],
        land && "flap-in",
        className,
      )}
      title={title}
    >
      {children}
    </span>
  );
}

/** The chip a booking earns, resolving status and payment together. */
export function statusStamp(
  booking: Pick<Booking, "status" | "paymentStatus" | "openMatch" | "partySize">,
  participantCount: number,
): { tone: StampTone; key: string; count?: number } {
  switch (booking.status) {
    case "held":
      return { tone: "held", key: "held" };
    case "blocked":
      return { tone: "blocked", key: "blocked" };
    case "no_show":
      return { tone: "noshow", key: "noShow" };
    case "cancelled":
      return { tone: "void", key: "cancelled" };
    case "expired":
      return { tone: "void", key: "expired" };
    default:
      break;
  }

  if (booking.openMatch && participantCount < booking.partySize) {
    return {
      tone: "seats",
      key: "openSeats",
      count: booking.partySize - participantCount,
    };
  }

  return paymentStamp(booking.paymentStatus);
}

export function paymentStamp(status: PaymentStatus): {
  tone: StampTone;
  key: string;
} {
  switch (status) {
    case "paid":
      return { tone: "paid", key: "paid" };
    case "part_paid":
      return { tone: "part", key: "partPaid" };
    case "refunded":
      return { tone: "void", key: "cancelled" };
    default:
      return { tone: "due", key: "due" };
  }
}

/** The panel treatment a status implies. */
export function slipTreatment(status: BookingStatus): string {
  switch (status) {
    case "no_show":
      return "opacity-60 saturate-0";
    case "blocked":
      return "hatched opacity-70";
    case "held":
      return "border-dashed border-amber/60";
    case "cancelled":
    case "expired":
      return "opacity-35 saturate-0";
    default:
      return "";
  }
}
