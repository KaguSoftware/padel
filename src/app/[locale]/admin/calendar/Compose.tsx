"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createBooking } from "@/app/actions/bookings";
import { foldedIncludes, formatPhone } from "@/lib/text";
import { cn } from "@/ui/cn";
import { InkButton, RuledInput } from "@/ui/primitives";
import { Sheet } from "@/ui/Sheet";
import { clockOf } from "./geometry";
import type { CourtLane, CustomerOption } from "./types";

/**
 * WRITING AN ENTRY.
 *
 * The previous version was a sentence with typed slots — "Book [court] at
 * [time] for [member] for [duration]" — filled by pointing at the grid. The
 * idea was right and the ergonomics were not: four separate pointing gestures
 * before anything could be written, and no way at all to say "two hours" with
 * a keyboard.
 *
 * Turning the board on its side collapsed three of those four gestures into
 * one. Drag across a lane and you have named the court, the start AND the
 * length in a single movement, in the place you were already looking. So this
 * is what is left: who is it for, and hold or write.
 *
 * It opens as a sheet rather than a persistent bar, because after the drag the
 * only remaining question is the customer, and a permanently-docked strip for
 * one field is furniture that costs board.
 */
export function Compose({
  open,
  onClose,
  day,
  lane,
  startMinute,
  durationMinutes,
  customers,
  onWritten,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  day: string;
  lane: CourtLane | undefined;
  startMinute: number | undefined;
  durationMinutes: number | undefined;
  customers: CustomerOption[];
  onWritten: (serial: number) => void;
  onError: (message: string) => void;
}) {
  const t = useTranslations("compose");
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  /**
   * A fresh drag is a fresh entry — keeping the last customer selected is how
   * the wrong person ends up on the 21:00 court. The reset is NOT done here:
   * the caller keys this component on the drawn span, so a new span mounts a
   * new form and the state resets by construction. An effect that clears state
   * on open renders twice and can be seen doing it.
   *
   * The focus does need an effect, because it touches the DOM rather than
   * state, and it waits a frame for the sheet's own entrance to place the field.
   */
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Search runs over rows already in memory — no debounce, no network. A
  // debounce here would be 250ms of pure added latency, since the only thing it
  // ever rate-limited was a request that no longer happens.
  const matches = useMemo(() => {
    if (query.trim().length === 0) return [];
    const digits = query.replace(/\D/g, "");
    return customers
      .filter(
        (c) =>
          foldedIncludes(c.name, query) ||
          foldedIncludes(c.altName, query) ||
          (digits.length >= 3 && c.phone.includes(digits)),
      )
      .slice(0, 6);
  }, [customers, query]);

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const ready =
    lane !== undefined && startMinute !== undefined && durationMinutes !== undefined;

  function commit(hold: boolean) {
    if (!ready) return;
    start(async () => {
      const res = await createBooking({
        courtId: lane.id,
        day,
        startMinute,
        durationMinutes,
        customerId,
        partySize: 4,
        source: "staff",
        openMatch: false,
        hold,
        notes: "",
      });

      if (res.ok) {
        onWritten(res.data.serial);
        onClose();
      } else {
        onError(res.message);
      }
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("title")}
      serial={
        ready && (
          <span className="board-digit text-[14px]">
            {lane.name} · {clockOf(startMinute)}–{clockOf(startMinute + durationMinutes)}{" "}
            · {t("minutes", { count: durationMinutes })}
          </span>
        )
      }
      footer={
        <div className="flex flex-wrap gap-2.5">
          <InkButton
            variant="primary"
            loading={pending}
            disabled={!ready}
            onClick={() => commit(false)}
            className="flex-1"
          >
            {t("write")}
          </InkButton>
          <InkButton
            variant="secondary"
            loading={pending}
            disabled={!ready}
            onClick={() => commit(true)}
          >
            {t("hold")}
          </InkButton>
        </div>
      }
    >
      <label htmlFor="compose-search" className="board-label mb-2 block">
        {t("who")}
      </label>
      <RuledInput
        id="compose-search"
        ref={searchRef}
        type="search"
        inputMode="search"
        autoComplete="off"
        value={query}
        placeholder={t("searchPlaceholder")}
        onChange={(e) => {
          setQuery(e.target.value);
          setCustomerId(null);
        }}
      />

      {customer ? (
        <div className="mt-4 flex items-center justify-between gap-3 border border-line/25 bg-line/8 px-4 py-3">
          <span className="min-w-0">
            <span className="block truncate font-stadium text-[14px] uppercase text-line">
              {customer.name}
            </span>
            <span className="board-digit block text-[13px]">
              {formatPhone(customer.phone)}
            </span>
          </span>
          <InkButton
            size="sm"
            variant="quiet"
            onClick={() => {
              setCustomerId(null);
              setQuery("");
              searchRef.current?.focus();
            }}
          >
            {t("change")}
          </InkButton>
        </div>
      ) : (
        <ul className="mt-3">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={c.blocked}
                onClick={() => setCustomerId(c.id)}
                className={cn(
                  "flex min-h-13 w-full items-center justify-between gap-3 border-b border-line/12 px-1 text-start transition-colors",
                  c.blocked
                    ? "cursor-not-allowed opacity-45"
                    : "hover:bg-line/8 focus-visible:bg-line/10",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-line">{c.name}</span>
                  {c.blocked && (
                    <span className="board-label board-label-sm text-clay">
                      {t("blocked")}
                    </span>
                  )}
                </span>
                <span className="board-digit shrink-0 text-[13px]">
                  {formatPhone(c.phone)}
                </span>
              </button>
            </li>
          ))}

          {query.trim().length > 0 && matches.length === 0 && (
            <li className="board-label py-4">{t("noMatch", { query })}</li>
          )}
        </ul>
      )}

      {/*
        A booking with nobody on it is legitimate and common: the phone rings,
        the court goes on the board, the name arrives a minute later. Saying so
        is better than letting staff wonder whether the form is broken.
      */}
      {!customer && query.trim().length === 0 && (
        <p className="board-label mt-5 leading-relaxed">{t("anonymousNote")}</p>
      )}
    </Sheet>
  );
}
