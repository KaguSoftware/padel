"use client";

import { useState, useTransition } from "react";
import { confirmHold } from "@/app/actions/bookings";
import { takePayment } from "@/app/actions/money";
import type { BookingStatus } from "@/data/types";
import { formatMoney, type Fils } from "@/lib/money";
import { formatPhone } from "@/lib/text";
import { Link } from "@/i18n/routing";
import { CourtLines } from "@/ui/court";
import { InkButton, Serial } from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";
import { useCountdown, useHoldProgress } from "@/ui/Ticker";

/**
 * Checkout, set as the card that has been pulled off the board.
 *
 * The hold burns down as a bar across the head of the card, because the slot is
 * physically going away — not a decorative timer. When it lapses the page says
 * so plainly and offers the way back, since a lapsed hold means the slot is
 * genuinely free again and the honest instruction is "try once more".
 */

interface BookingView {
  id: string;
  serial: number;
  status: BookingStatus;
  courtName: string;
  day: string;
  startClock: string;
  endClock: string;
  total: Fils;
  partySize: number;
  openMatch: boolean;
  holdExpiresAt: string | null;
  holdIssuedAt: string;
  priceLines: { label: string; amount: Fils }[];
}

export function Checkout({
  locale,
  booking,
  customer,
  strings,
}: {
  locale: string;
  booking: BookingView;
  customer: { name: string; phone: string; credit: Fils } | null;
  strings: Record<string, string>;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(booking.status === "confirmed");
  const [error, setError] = useState<string | null>(null);

  const countdown = useCountdown(booking.holdExpiresAt);
  const progress = useHoldProgress(booking.holdIssuedAt, booking.holdExpiresAt);

  const lapsed =
    !done && booking.status === "held" && booking.holdExpiresAt !== null && countdown === null;
  const expired = booking.status === "expired" || lapsed;

  function pay(atDesk: boolean) {
    start(async () => {
      const confirm = await confirmHold(booking.id);
      if (!confirm.ok) {
        setError(confirm.code === "expired" ? strings.expired : confirm.message);
        return;
      }
      if (!atDesk) {
        await takePayment({
          bookingId: booking.id,
          saleId: null,
          participantId: null,
          amountFils: booking.total,
          method: "card",
          note: "Paid online at checkout",
        });
      }
      setDone(true);
    });
  }

  return (
    <main className="court-world court-surface min-h-dvh">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <article className="board-panel relative overflow-hidden">
          {/* The hold burning down, as a bar across the head of the card. */}
          {!done && !expired && (
            <span
              className="absolute inset-x-0 top-0 z-10 block h-1 bg-amber transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.max(0, 100 - progress * 100)}%` }}
              aria-hidden
            />
          )}
          <CourtLines className="pointer-events-none absolute inset-x-6 bottom-6 h-16 w-auto text-line/12" />

          <header className="relative border-b border-line/20 px-5 pb-3 pt-6">
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="painted text-[28px] leading-none text-line">
                {done ? strings.confirmed : strings.checkout}
              </h1>
              <Serial value={booking.serial} />
            </div>
            <p className="mt-1 font-board text-[11px] uppercase tracking-[0.14em] text-line-dim">
              Kagu Padel · {booking.day}
            </p>
          </header>

          <div className="space-y-4 px-5 py-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Line label="Court" value={booking.courtName} />
              <Line
                label="Time"
                value={`${booking.startClock}–${booking.endClock}`}
              />
              <Line label="Players" value={String(booking.partySize)} />
              {customer && <Line label="Booked by" value={customer.name} />}
            </dl>

            <div className="border-t border-line/15 pt-3">
              {booking.priceLines.map((l, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-4 py-1 text-[13px]"
                >
                  <span className={l.amount < 0 ? "text-ball" : "text-line"}>
                    {l.label}
                  </span>
                  <span className="font-board tabular-nums">
                    {formatMoney(l.amount, locale, { showCurrency: false })}
                  </span>
                </div>
              ))}
              <div className="mt-2 flex items-baseline justify-between gap-4 border-t-2 border-line/25 pt-2">
                <span className="font-board text-[11px] uppercase tracking-[0.12em] text-line-dim">
                  {strings.total}
                </span>
                <span className="painted text-[28px] leading-none tabular-nums text-line">
                  {formatMoney(booking.total, locale)}
                </span>
              </div>
              <p className="mt-1 text-end font-board text-[10px] text-line-dim">
                {formatMoney(
                  Math.round(booking.total / booking.partySize) as Fils,
                  locale,
                )}{" "}
                each, four ways
              </p>
            </div>

            {done ? (
              <div className="border-t border-line/15 pt-4">
                <Stamp tone="paid" land className="text-[13px]">
                  {strings.confirmed}
                </Stamp>
                {customer && (
                  <p className="mt-3 font-board text-[11px] leading-relaxed text-line-dim">
                    Details sent to {formatPhone(customer.phone)} on WhatsApp.
                  </p>
                )}
                <Link
                  href="/play/account"
                  className="mt-4 inline-flex min-h-12 items-center border border-line/35 px-5 font-stadium text-[12px] uppercase tracking-[0.09em] text-line transition-colors hover:border-line hover:bg-line/10"
                >
                  {strings.myBookings}
                </Link>
              </div>
            ) : expired ? (
              <div className="border-t border-line/25 pt-4">
                <Stamp tone="void" className="text-[13px]">
                  LAPSED
                </Stamp>
                <p className="mt-3 text-[14px] leading-relaxed text-line">
                  {strings.expired}
                </p>
                <Link
                  href="/play"
                  className="mt-4 live-block inline-flex min-h-12 items-center px-5 font-stadium text-[12px] uppercase tracking-[0.09em] transition-[filter,transform] duration-100 hover:brightness-110 active:translate-y-0.5"
                >
                  {strings.back}
                </Link>
              </div>
            ) : (
              <div className="border-t border-line/15 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <Stamp tone="held">HELD {countdown ?? "—"}</Stamp>
                  <span className="font-board text-[10px] uppercase tracking-[0.1em] text-line-dim">
                    {strings.holdExplain}
                  </span>
                </div>

                {error && (
                  <p className="mt-3 border border-line/25 px-3 py-2 font-board text-[12px] text-clay">
                    {error}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <InkButton
                    variant="primary"
                    disabled={pending}
                    onClick={() => pay(false)}
                  >
                    {strings.payNow}
                  </InkButton>
                  <InkButton
                    variant="secondary"
                    disabled={pending}
                    onClick={() => pay(true)}
                  >
                    {strings.payAtDesk}
                  </InkButton>
                </div>

                <p className="mt-3 font-board text-[10px] leading-relaxed text-line-dim">
                  No payment provider is wired in this prototype — &ldquo;pay
                  now&rdquo; records a card payment against the entry so the
                  till and the receipt behave correctly end to end.
                </p>
              </div>
            )}
          </div>
        </article>
      </div>
    </main>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-board text-[10px] uppercase tracking-[0.12em] text-line-dim">
        {label}
      </dt>
      <dd className="mt-0.5 text-[15px] text-line">{value}</dd>
    </div>
  );
}
