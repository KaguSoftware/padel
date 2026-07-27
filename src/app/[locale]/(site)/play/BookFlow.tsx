"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBooking } from "@/app/actions/bookings";
import type { MembershipTier } from "@/data/types";
import { formatMoney, type Fils } from "@/lib/money";
import { Link } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import { CourtMark } from "@/ui/marks";
import { EmptyLine, InkButton } from "@/ui/primitives";

/**
 * The player booking flow.
 *
 * Same ledger, phone-first: the page narrows to one court-day block per court,
 * and the slip is the unit. Every slot carries its real price, computed by the
 * same engine the console uses.
 *
 * Selecting a slot creates a HOLD, not a booking. The court goes visibly away
 * for everyone else while this player pays, and the hold expires on its own if
 * they wander off.
 */

export interface CourtOffer {
  id: string;
  name: string;
  enclosure: string;
  surface: string;
  slots: { startMinute: number; price: Fils }[];
}

export function BookFlow({
  locale,
  day,
  prevDay,
  nextDay,
  today,
  duration,
  durations,
  offers,
  me,
  strings,
}: {
  locale: string;
  day: string;
  prevDay: string;
  nextDay: string;
  today: string;
  duration: number;
  durations: number[];
  offers: CourtOffer[];
  me: {
    id: string;
    name: string;
    tier: MembershipTier;
    level: number | null;
    credit: Fils;
  } | null;
  strings: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [openMatch, setOpenMatch] = useState(false);

  const anySlots = offers.some((o) => o.slots.length > 0);

  function hold(courtId: string, startMinute: number) {
    if (!me) {
      setNotice(strings.signIn);
      return;
    }
    start(async () => {
      const res = await createBooking({
        courtId,
        day,
        startMinute,
        durationMinutes: duration,
        customerId: me.id,
        partySize: 4,
        source: "web",
        openMatch,
        hold: true,
        notes: "",
      });

      if (res.ok) {
        router.push(`/${locale}/play/checkout/${res.data.id}`);
      } else {
        // The same conflict path the console uses. This is what makes the
        // exclusion constraint visible to a player: "someone got there first".
        setNotice(res.code === "taken" ? strings.taken : res.message);
      }
    });
  }

  return (
    <main className="court-world court-surface min-h-dvh">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="border-b-2 border-line/25 pb-4">
          <h1 className="painted text-[clamp(2rem,5vw,3rem)] leading-none text-line">
            {strings.findCourt}
          </h1>

          <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4">
            <div>
              <span className="block font-board text-[10px] uppercase tracking-[0.14em] text-line-dim">
                {strings.when}
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                <DayLink href={`/play?d=${prevDay}&mins=${duration}`} label={strings.previous}>
                  â€¹
                </DayLink>
                <span className="min-w-32 border-b border-line/40 px-2 pb-1 text-center font-board text-[15px] tabular-nums">
                  {day}
                </span>
                <DayLink href={`/play?d=${nextDay}&mins=${duration}`} label={strings.next}>
                  â€º
                </DayLink>
                {day !== today && (
                  <Link
                    href={`/play?d=${today}&mins=${duration}`}
                    className="ms-1 min-h-11 px-2 py-2 font-board text-[11px] uppercase tracking-[0.12em] text-amber"
                  >
                    {strings.today}
                  </Link>
                )}
              </div>
            </div>

            <div>
              <span className="block font-board text-[10px] uppercase tracking-[0.14em] text-line-dim">
                {strings.duration}
              </span>
              <div className="mt-1 flex gap-1">
                {durations.map((mins) => (
                  <Link
                    key={mins}
                    href={`/play?d=${day}&mins=${mins}`}
                    className={cn(
                      "flex min-h-11 min-w-12 items-center justify-center border px-2 font-board text-[13px] tabular-nums",
                      mins === duration
                        ? "border-line/40 bg-line/20 text-court-deep"
                        : "border-line/30 text-line-dim",
                    )}
                  >
                    {mins}
                  </Link>
                ))}
              </div>
            </div>

            <label className="flex min-h-11 items-center gap-2 text-[13px] text-line-dim">
              <input
                type="checkbox"
                checked={openMatch}
                onChange={(e) => setOpenMatch(e.target.checked)}
                className="size-4 accent-[var(--color-ball)]"
              />
              {strings.openMatch}
            </label>

            {me && (
              <span className="ms-auto font-board text-[11px] text-line-dim">
                {me.name}
                {me.level !== null && ` Â· ${strings.yourLevel} ${me.level}`}
                {me.credit > 0 &&
                  ` Â· ${strings.credit} ${formatMoney(me.credit, locale)}`}
              </span>
            )}
          </div>
        </header>

        {notice && (
          <p
            role="status"
            className="mt-4 border border-line/25 bg-transparent px-3 py-2 font-board text-[12px] text-clay"
          >
            {notice}
          </p>
        )}

        {!anySlots ? (
          <div className="mt-10">
            <EmptyLine>{strings.noSlots}</EmptyLine>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {offers
              .filter((o) => o.slots.length > 0)
              .map((court) => (
                <section key={court.id}>
                  <div className="flex items-baseline gap-3 border-b border-line/25 pb-1.5">
                    <CourtMark size={20} className="text-line-dim" />
                    <h2 className="painted text-[24px] leading-none text-line">
                      {court.name}
                    </h2>
                    <span className="font-board text-[10px] uppercase tracking-[0.12em] text-line-dim">
                      {court.enclosure} Â· {court.surface}
                    </span>
                    <span className="ms-auto font-board text-[11px] tabular-nums text-line-dim">
                      {court.slots.length}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {court.slots.map((s) => (
                      <button
                        key={s.startMinute}
                        type="button"
                        disabled={pending}
                        onClick={() => hold(court.id, s.startMinute)}
                        className="slip group flex min-h-16 min-w-28 flex-col items-start justify-between gap-1 bg-transparent px-3 py-2 text-start hover:border-amber hover:bg-ball/10 disabled:opacity-50"
                      >
                        <span className="font-board text-[15px] font-bold tabular-nums text-line">
                          {clockOf(s.startMinute)}
                        </span>
                        <span className="font-board text-[11px] tabular-nums text-line-dim">
                          {formatMoney(s.price, locale)}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        )}

        <p className="mt-10 border-t border-line/15 pt-4 font-board text-[11px] leading-relaxed text-line-dim">
          {strings.holdExplain}
        </p>
      </div>
    </main>
  );
}

function DayLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex min-h-11 min-w-11 items-center justify-center border border-line/30 text-[18px] leading-none text-line hover:border-line/40"
    >
      {children}
    </Link>
  );
}

function clockOf(minute: number): string {
  const h = Math.floor((minute + 360) / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
