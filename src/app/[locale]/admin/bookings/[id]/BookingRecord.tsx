"use client";

import { useState, useTransition } from "react";
import {
  applyDiscount,
  cancelBooking,
  confirmHold,
  markNoShow,
} from "@/app/actions/bookings";
import { settleAllShares, takePayment } from "@/app/actions/money";
import type { BookingSource, BookingStatus, PaymentMethod, PaymentStatus } from "@/data/types";
import { formatMoney, type Fils } from "@/lib/money";
import { cn } from "@/ui/cn";
import { CourtLines } from "@/ui/court";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import {
  EmptyLine,
  FieldLabel,
  InkButton,
  Panel,
  Reading,
  RuledInput,
  RuledSelect,
  Serial,
} from "@/ui/primitives";
import { paymentStamp, Stamp } from "@/ui/Stamp";

/**
 * The booking record: the card pulled off the board and turned over.
 *
 * Everything the audit log points at lives here — the price breakdown with its
 * discount reason and author, who took which payment, and what cancelling now
 * would actually return.
 */

interface PriceLineView {
  code: string;
  label: string;
  amount: Fils;
  reason: string | null;
  appliedBy: string | null;
}

interface ShareView {
  participantId: string;
  name: string;
  share: Fils;
  paid: Fils;
  outstanding: Fils;
  settled: boolean;
  isBooker: boolean;
}

interface PaymentView {
  id: string;
  amount: Fils;
  method: PaymentMethod;
  takenBy: string;
  takenAt: string;
  isRefund: boolean;
}

interface BookingView {
  id: string;
  serial: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  source: BookingSource;
  courtName: string;
  day: string;
  startClock: string;
  endClock: string;
  startMinute: number;
  durationMinutes: number;
  customerName: string | null;
  partySize: number;
  openMatch: boolean;
  levelMin: number | null;
  levelMax: number | null;
  isSeries: boolean;
  notes: string;
  createdBy: string;
  createdAt: string;
  total: Fils;
  blockReason: string | null;
  cancellationReason: string | null;
  priceLines: PriceLineView[];
}

const METHODS: PaymentMethod[] = ["cash", "card", "wallet", "credit", "transfer"];

/**
 * Flat labels plus two nested groups. Spelled out rather than
 * `Record<string, string> & {...}` — an index signature of `string` and a
 * nested object cannot both be true, and TypeScript is right to say so.
 */
type RecordStrings = {
  [k: string]: string | Record<string, string>;
} & {
  title: string;
  when: string;
  duration: string;
  source: string;
  createdBy: string;
  participants: string;
  price: string;
  total: string;
  payments: string;
  cancel: string;
  confirm: string;
  markNoShow: string;
  discount: string;
  discountReason: string;
  takePayment: string;
  settleAll: string;
  share: string;
  paid: string;
  owes: string;
  booker: string;
  openMatch: string;
  credit: string;
  noPlayers: string;
  noPayments: string;
  save: string;
  sources: Record<BookingSource, string>;
  status: Record<string, string>;
};

export function BookingRecord({
  locale,
  booking,
  shares,
  collected,
  outstanding,
  payments,
  cancellation,
  permissions,
  customerCredit,
  strings,
}: {
  locale: string;
  booking: BookingView;
  shares: ShareView[];
  collected: Fils;
  outstanding: Fils;
  payments: PaymentView[];
  cancellation: {
    hoursBefore: number;
    refundAmount: Fils;
    refundKind: string;
    explanation: string;
  };
  permissions: { discount: boolean; cancel: boolean; payment: boolean };
  customerCredit: Fils | null;
  strings: RecordStrings;
}) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [discountPct, setDiscountPct] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const stamp = paymentStamp(booking.paymentStatus);
  const live = booking.status === "held" || booking.status === "confirmed";

  function run<T>(fn: () => Promise<{ ok: boolean; message?: string } & T>) {
    start(async () => {
      const res = await fn();
      setNotice(res.ok ? "Done." : (res.message ?? "Refused."));
    });
  }

  return (
    <PageShell
      title={strings.title}
      serial={<Serial value={booking.serial} />}
      guilloche
      note={notice}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          {/* The document head — court, when, source, all on one ruled band. */}
          <Panel title={booking.courtName}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Field label={strings.when}>
                <span className="font-board tabular-nums">
                  {booking.day} · {booking.startClock}–{booking.endClock}
                </span>
              </Field>
              <Field label={strings.duration}>
                <span className="font-board tabular-nums">
                  {booking.durationMinutes} min
                </span>
              </Field>
              <Field label={strings.source}>
                {strings.sources[booking.source]}
                {booking.isSeries && " ↻"}
              </Field>
              <Field label={strings.createdBy}>{booking.createdBy}</Field>
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/15 pt-3">
              <Stamp tone={stamp.tone}>{strings.status[stamp.key]}</Stamp>
              {booking.status === "held" && (
                <Stamp tone="held">{strings.status.held}</Stamp>
              )}
              {booking.status === "no_show" && (
                <Stamp tone="noshow">{strings.status.noShow}</Stamp>
              )}
              {booking.status === "cancelled" && (
                <Stamp tone="void">{strings.status.cancelled}</Stamp>
              )}
              {booking.openMatch && (
                <Stamp tone="seats">
                  {strings.openMatch}
                  {booking.levelMin !== null &&
                    ` ${booking.levelMin}–${booking.levelMax}`}
                </Stamp>
              )}
              {booking.blockReason && (
                <span className="text-[14px] text-line-dim">
                  {booking.blockReason}
                </span>
              )}
              {booking.cancellationReason && (
                <span className="text-[14px] text-line-dim">
                  {booking.cancellationReason}
                </span>
              )}
            </div>
          </Panel>

          {/* Price breakdown — itemised, because the receipt prints this and the
              audit log quotes it. */}
          <Panel title={strings.price}>
            <LedgerTable heads={["", strings.total]}>
              {booking.priceLines.map((l, i) => (
                <LedgerRow key={`${l.code}-${i}`}>
                  <Cell>
                    <span className={l.amount < 0 ? "text-ball" : ""}>
                      {l.label}
                    </span>
                    {l.reason && (
                      <span className="ms-2 text-[14px] text-line-dim">
                        {l.reason}
                        {l.appliedBy ? ` — ${l.appliedBy}` : ""}
                      </span>
                    )}
                  </Cell>
                  <Cell numeric className={l.amount < 0 ? "text-ball" : ""}>
                    {formatMoney(l.amount, locale, { showCurrency: false })}
                  </Cell>
                </LedgerRow>
              ))}
              <LedgerRow className="border-t-2 border-line/25 font-semibold hover:bg-transparent">
                <Cell>{strings.total}</Cell>
                <Cell numeric>{formatMoney(booking.total, locale)}</Cell>
              </LedgerRow>
            </LedgerTable>
          </Panel>

          {/* Participants — four players, four shares, four payment states. */}
          <Panel
            title={strings.participants}
            serial={
              <span className="text-[14px] text-line-dim">
                {shares.length}/{booking.partySize}
              </span>
            }
            actions={
              permissions.payment && outstanding > 0 ? (
                <InkButton
                  size="sm"
                  variant="primary"
                  disabled={pending}
                  onClick={() => run(() => settleAllShares(booking.id, method))}
                >
                  {strings.settleAll}
                </InkButton>
              ) : null
            }
          >
            {shares.length === 0 ? (
              <EmptyLine>{strings.noPlayers}</EmptyLine>
            ) : (
              <LedgerTable
                heads={["", strings.share, strings.paid, strings.owes, ""]}
              >
                {shares.map((s) => (
                  <LedgerRow key={s.participantId}>
                    <Cell>
                      <span className="flex items-center gap-2">
                        {s.name}
                        {s.isBooker && (
                          <span className="board-label board-label-sm text-amber">
                            {strings.booker}
                          </span>
                        )}
                      </span>
                    </Cell>
                    <Cell numeric>
                      {formatMoney(s.share, locale, { showCurrency: false })}
                    </Cell>
                    <Cell numeric>
                      {formatMoney(s.paid, locale, { showCurrency: false })}
                    </Cell>
                    <Cell numeric className={s.outstanding > 0 ? "text-clay" : ""}>
                      {formatMoney(s.outstanding, locale, { showCurrency: false })}
                    </Cell>
                    <Cell>
                      {s.settled ? (
                        <Stamp tone="paid">{strings.status.paid}</Stamp>
                      ) : permissions.payment ? (
                        <InkButton
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              takePayment({
                                bookingId: booking.id,
                                saleId: null,
                                participantId: s.participantId,
                                amountFils: s.outstanding,
                                method,
                                note: "",
                              }),
                            )
                          }
                        >
                          {strings.takePayment}
                        </InkButton>
                      ) : (
                        <Stamp tone="due">{strings.status.due}</Stamp>
                      )}
                    </Cell>
                  </LedgerRow>
                ))}
              </LedgerTable>
            )}
          </Panel>

          <Panel title={strings.payments}>
            {payments.length === 0 ? (
              <EmptyLine>{strings.noPayments}</EmptyLine>
            ) : (
              <LedgerTable heads={["", "", "", strings.total]}>
                {payments.map((p) => (
                  <LedgerRow key={p.id}>
                    <Cell className="text-[14px] text-line-dim">
                      {new Date(p.takenAt).toLocaleString(locale, {
                        timeZone: "Asia/Dubai",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </Cell>
                    <Cell className="board-label text-inherit">
                      {p.method}
                    </Cell>
                    <Cell>{p.takenBy}</Cell>
                    <Cell numeric className={p.isRefund ? "text-ball" : ""}>
                      {formatMoney(p.amount, locale, { showCurrency: false })}
                    </Cell>
                  </LedgerRow>
                ))}
              </LedgerTable>
            )}
          </Panel>
        </div>

        {/* The card's action face. */}
        <aside className="space-y-4">
          <div className="board-panel relative overflow-hidden p-5">
            <CourtLines className="pointer-events-none absolute inset-x-5 bottom-4 h-10 w-auto text-line/12" />
            <Reading
              label={strings.total}
              value={formatMoney(booking.total, locale)}
              sub={`${formatMoney(collected, locale, { showCurrency: false })} collected`}
              tone={outstanding > 0 ? "rule" : "settle"}
            />
            {customerCredit !== null && customerCredit > 0 && (
              <p className="mt-2 text-[14px] text-ball">
                {strings.credit}: {formatMoney(customerCredit, locale)}
              </p>
            )}
          </div>

          {permissions.payment && (
            <Panel title={strings.takePayment}>
              <FieldLabel htmlFor="method">Method</FieldLabel>
              <RuledSelect
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </RuledSelect>
            </Panel>
          )}

          {live && booking.status === "held" && (
            <InkButton
              variant="primary"
              className="w-full"
              disabled={pending}
              onClick={() => run(() => confirmHold(booking.id))}
            >
              {strings.confirm}
            </InkButton>
          )}

          {permissions.discount && live && (
            <Panel title={strings.discount}>
              <div className="space-y-3">
                <div>
                  <FieldLabel htmlFor="pct">%</FieldLabel>
                  <RuledInput
                    id="pct"
                    inputMode="numeric"
                    value={discountPct}
                    onChange={(e) => setDiscountPct(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="why">{strings.discountReason}</FieldLabel>
                  <RuledInput
                    id="why"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                  />
                </div>
                <InkButton
                  className="w-full"
                  disabled={pending || discountReason.trim().length < 3}
                  onClick={() =>
                    run(() =>
                      applyDiscount({
                        id: booking.id,
                        percent: Number(discountPct || 0),
                        reason: discountReason,
                      }),
                    )
                  }
                >
                  {strings.save}
                </InkButton>
                <p className="board-label leading-relaxed">
                  Recorded in the audit log with your name and this reason.
                </p>
              </div>
            </Panel>
          )}

          {permissions.cancel && live && (
            <Panel title={strings.cancel}>
              <p
                className={cn(
                  "mb-3 board-label leading-relaxed",
                  cancellation.refundKind === "none" ? "text-clay" : "text-line-dim",
                )}
              >
                {cancellation.hoursBefore > 0
                  ? `${cancellation.hoursBefore}h before start. ${cancellation.explanation}`
                  : cancellation.explanation}
                {cancellation.refundAmount > 0 &&
                  ` — ${formatMoney(cancellation.refundAmount, locale)}`}
              </p>
              <RuledInput
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason"
                aria-label="Cancellation reason"
              />
              <InkButton
                variant="danger"
                className="mt-3 w-full"
                disabled={pending || cancelReason.trim().length < 3}
                onClick={() => run(() => cancelBooking(booking.id, cancelReason))}
              >
                {strings.cancel}
              </InkButton>
              <InkButton
                variant="quiet"
                className="mt-2 w-full"
                disabled={pending}
                onClick={() => run(() => markNoShow(booking.id))}
              >
                {strings.markNoShow}
              </InkButton>
            </Panel>
          )}
        </aside>
      </div>
    </PageShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="board-label board-label-sm">
        {label}
      </dt>
      <dd className="mt-0.5 text-[14px] text-line">{children}</dd>
    </div>
  );
}
