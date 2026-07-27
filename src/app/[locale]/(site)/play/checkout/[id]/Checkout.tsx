"use client";

import { useState, useTransition } from "react";
import { confirmHold } from "@/app/actions/bookings";
import { takePayment } from "@/app/actions/money";
import type { BookingStatus } from "@/data/types";
import { formatMoney, type Fils } from "@/lib/money";
import { formatPhone } from "@/lib/text";
import { Link } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import { Guilloche } from "@/ui/Guilloche";
import { InkButton, Serial } from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";
import { useCountdown, useHoldProgress } from "@/ui/Ticker";

/**
 * Checkout, set as the carbon receipt it becomes.
 *
 * The hold's remaining time is not a progress bar â€” it is the perforated edge
 * of the stub tearing further open, which is what the world does when something
 * is about to detach. When it lapses the page says so plainly and offers the
 * way back, because a lapsed hold means the slot is genuinely free again and
 * the honest instruction is "try once more".
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
        <article
          className={cn(
            "slip relative overflow-hidden bg-transparent",
            !done && !expired && "perforated-end",
          )}
          style={{ ["--perf" as string]: `${3 + progress * 7}px` }}
        >
          <Guilloche
            band
            className="pointer-events-none absolute inset-inline-0 top-0 h-6 w-full text-amber/40"
          />

          <header className="border-b-2 border-line/25 px-5 pb-3 pt-9">
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="painted text-[28px] leading-none text-line">
                {done ? strings.confirmed : strings.checkout}
              </h1>
              <Serial value={booking.serial} />
            </div>
            <p className="mt-1 font-board text-[11px] uppercase tracking-[0.14em] text-line-dim">
              Kagu Padel Â· {booking.day}
            </p>
          </header>

          <div className="space-y-4 px-5 py-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Line label="Court" value={booking.courtName} />
              <Line
                label="Time"
                value={`${booking.startClock}â€“${booking.endClock}`}
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
                  className="ink-button mt-4 inline-flex min-h-11 items-center border-line/40 bg-transparent px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-line"
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
                  className="ink-button mt-4 inline-flex min-h-11 items-center border-ball live-block px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-court-deep"
                >
                  {strings.back}
                </Link>
              </div>
            ) : (
              <div className="border-t border-line/15 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <Stamp tone="held">HELD {countdown ?? "â€”"}</Stamp>
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
                  No payment provider is wired in this prototype â€” &ldquo;pay
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
