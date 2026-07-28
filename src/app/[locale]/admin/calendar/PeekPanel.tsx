"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cancelBooking, confirmHold, markNoShow } from "@/app/actions/bookings";
import { Link } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/text";
import { cn } from "@/ui/cn";
import { InkButton, RuledInput, Serial } from "@/ui/primitives";
import { Sheet } from "@/ui/Sheet";
import { Stamp, statusStamp } from "@/ui/Stamp";
import { useCountdown } from "@/ui/Ticker";
import { clockOf } from "./geometry";
import type { SlipView } from "./types";

/**
 * A booking, turned over, without leaving the board.
 *
 * This is the change that matters most to a shift. Opening a booking used to be
 * a full page navigation: the day book vanished, the record loaded, the action
 * happened, and the way back was the browser's. Staff do that dozens of times
 * an evening, usually with somebody standing at the counter waiting for an
 * answer about a different court — and the board they needed to answer with was
 * the thing that had just disappeared.
 *
 * What is here is the four things the front desk actually does to a booking
 * between one customer and the next. Everything else — the price breakdown, the
 * per-participant split, discounts, the series — is a click away on the record,
 * which is a page and can afford to be one.
 *
 * SCOPE(v1): the panel does not take payment. GROWS LATER → capture on the
 * panel once the payments port grows a `record` action the console can call.
 */
export function PeekPanel({
  slip,
  locale,
  onClose,
  onNotice,
}: {
  slip: SlipView | null;
  locale: string;
  onClose: () => void;
  onNotice: (tone: "ok" | "bad", text: string) => void;
}) {
  const t = useTranslations("peek");
  const ts = useTranslations("status");
  const [pending, start] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const countdown = useCountdown(slip?.holdExpiresAt ?? null);

  if (!slip) return null;

  const stamp = statusStamp(slip, slip.participantCount);
  const stampText =
    stamp.key === "openSeats"
      ? ts("openSeats", { count: stamp.count ?? 0 })
      : ts(stamp.key as "held");

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, okText: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        onNotice("ok", okText);
        onClose();
      } else {
        onNotice("bad", res.message ?? t("failed"));
      }
    });

  const live = slip.status === "held" || slip.status === "confirmed";

  return (
    <Sheet
      open
      onClose={onClose}
      title={slip.blockReason ?? slip.customerName ?? t("noName")}
      serial={
        <span className="flex flex-wrap items-center gap-3">
          <Serial value={slip.serial} />
          <Stamp tone={stamp.tone}>
            {countdown ? `${stampText} ${countdown}` : stampText}
          </Stamp>
        </span>
      }
      footer={
        <Link
          href={`/admin/bookings/${slip.id}`}
          className="board-label flex min-h-12 items-center justify-center border border-line/30 text-line transition-colors hover:border-line hover:bg-line/10"
        >
          {t("fullRecord")}
        </Link>
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Fact label={t("when")}>
          {clockOf(slip.startMinute)}–{clockOf(slip.startMinute + slip.durationMinutes)}
        </Fact>
        <Fact label={t("length")}>{t("minutes", { count: slip.durationMinutes })}</Fact>
        <Fact label={t("total")}>{formatMoney(slip.total, locale)}</Fact>
        <Fact label={t("outstanding")} tone={slip.outstanding > 0 ? "due" : "ok"}>
          {formatMoney(slip.outstanding, locale)}
        </Fact>
        <Fact label={t("party")}>
          {t("ofParty", { on: slip.participantCount, of: slip.partySize })}
        </Fact>
        <Fact label={t("source")}>{t(`sources.${slip.source}` as "sources.web")}</Fact>
        {slip.customerPhone && (
          <Fact label={t("phone")} wide>
            <a
              href={`tel:${slip.customerPhone}`}
              className="underline decoration-line/30 underline-offset-4 hover:decoration-line"
            >
              {formatPhone(slip.customerPhone)}
            </a>
          </Fact>
        )}
        {slip.isSeries && (
          <Fact label={t("series")} wide>
            {t("seriesNote")}
          </Fact>
        )}
      </dl>

      {live && (
        <div className="mt-7 flex flex-col gap-2.5">
          {slip.status === "held" && (
            <InkButton
              variant="primary"
              loading={pending}
              onClick={() => run(() => confirmHold(slip.id), t("confirmed"))}
            >
              {t("confirm")}
            </InkButton>
          )}

          <InkButton
            variant="secondary"
            loading={pending}
            onClick={() => run(() => markNoShow(slip.id), t("noShowed"))}
          >
            {t("noShow")}
          </InkButton>

          {/*
            Cancelling asks for a reason inline rather than in a confirm dialog.
            The reason is what the audit log records and what the refund rule
            reads — a modal that only asks "are you sure" collects nothing and
            trains people to dismiss it.
          */}
          {cancelling ? (
            <div className="border border-clay/45 p-4">
              <label htmlFor="cancel-reason" className="board-label mb-2 block">
                {t("cancelReason")}
              </label>
              <RuledInput
                id="cancel-reason"
                value={reason}
                autoFocus
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("cancelReasonPlaceholder")}
              />
              <div className="mt-4 flex gap-2.5">
                <InkButton
                  variant="danger"
                  loading={pending}
                  disabled={reason.trim().length < 3}
                  onClick={() =>
                    run(() => cancelBooking(slip.id, reason.trim()), t("cancelled"))
                  }
                >
                  {t("cancelConfirm")}
                </InkButton>
                <InkButton variant="quiet" onClick={() => setCancelling(false)}>
                  {t("keep")}
                </InkButton>
              </div>
            </div>
          ) : (
            <InkButton variant="danger" onClick={() => setCancelling(true)}>
              {t("cancel")}
            </InkButton>
          )}
        </div>
      )}

      {!live && <p className="board-label mt-7">{t("settled")}</p>}
    </Sheet>
  );
}

function Fact({
  label,
  children,
  tone = "ok",
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "ok" | "due";
  wide?: boolean;
}) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="board-label board-label-sm">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-board text-[16px] tabular-nums",
          tone === "due" ? "text-clay" : "text-line",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
