"use client";

import { useMemo, useState, useTransition } from "react";
import { createBooking } from "@/app/actions/bookings";
import { foldedIncludes, formatPhone } from "@/lib/text";
import { cn } from "@/ui/cn";
import { InkButton } from "@/ui/primitives";
import type { CourtColumn, CustomerOption } from "./DayBook";

/**
 * THE ENTRY LINE — the physical act of writing a line in a day book.
 *
 * One sentence with typed slots: the verb comes from the keyboard, the objects
 * are filled by pointing at the grid below. The slot still open is marked, and
 * only a sentence that parses can be written.
 *
 * It suits the real user better than a modal form: a member of staff who is
 * interrupted mid-entry leaves a visibly unfinished line rather than a dialog
 * they must dismiss and start again.
 */

export interface EntryDraft {
  courtId?: string;
  startMinute?: number;
  customerId?: string;
  durationMinutes?: number;
  hold?: boolean;
}

const DURATIONS = [60, 90, 120];

interface Props {
  locale: string;
  day: string;
  draft: EntryDraft;
  onDraft: (d: EntryDraft | ((prev: EntryDraft) => EntryDraft)) => void;
  columns: CourtColumn[];
  customers: CustomerOption[];
  rowMinutes: number[];
  occupied: Set<string>;
  step: number;
  strings: Record<string, string>;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}

export function EntryLine({
  locale,
  day,
  draft,
  onDraft,
  columns,
  customers,
  occupied,
  step,
  strings,
  onDone,
  onError,
}: Props) {
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();

  // Search runs over rows already in memory — no debounce, no network. A
  // debounce here would be 250ms of pure added latency, since the only thing it
  // ever rate-limited was a request that no longer happens.
  const matches = useMemo(() => {
    if (query.trim().length === 0) return [];
    return customers
      .filter(
        (c) =>
          foldedIncludes(c.name, query) ||
          foldedIncludes(c.altName, query) ||
          c.phone.includes(query.replace(/\D/g, "")),
      )
      .slice(0, 6);
  }, [customers, query]);

  const court = columns.find((c) => c.id === draft.courtId);
  const customer = customers.find((c) => c.id === draft.customerId);

  // Which slot is still open decides what the grid marks below.
  const openSlot: keyof EntryDraft | null = !draft.courtId
    ? "courtId"
    : draft.startMinute === undefined
      ? "startMinute"
      : !draft.customerId
        ? "customerId"
        : !draft.durationMinutes
          ? "durationMinutes"
          : null;

  const parses = openSlot === null;

  // A duration only offers itself if every cell it would span is free.
  const durationFits = (mins: number) => {
    if (!draft.courtId || draft.startMinute === undefined) return true;
    for (let m = draft.startMinute; m < draft.startMinute + mins; m += step) {
      if (occupied.has(`${draft.courtId}:${m}`)) return false;
    }
    return true;
  };

  function commit(hold: boolean) {
    if (!parses) return;
    start(async () => {
      const res = await createBooking({
        courtId: draft.courtId!,
        day,
        startMinute: draft.startMinute!,
        durationMinutes: draft.durationMinutes!,
        customerId: draft.customerId ?? null,
        partySize: 4,
        source: "staff",
        openMatch: false,
        hold,
        notes: "",
      });

      if (res.ok) {
        onDone(`Entry #${res.data.serial} written.`);
        onDraft({});
        setQuery("");
      } else {
        onError(res.message);
      }
    });
  }

  return (
    <section
      aria-label={strings.prompt}
      className="border-b border-line/25 bg-board/40 px-4 py-3 sm:py-2.5"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2.5 font-body text-[15px] leading-none text-line">
        <span className="painted text-[17px] leading-none sm:text-[19px]">
          {strings.verb}
        </span>

        <SlotChip
          filled={court?.name}
          placeholder={strings.court}
          open={openSlot === "courtId"}
          hint={strings.pickCourt}
          onClear={() => onDraft((d) => ({ ...d, courtId: undefined, startMinute: undefined }))}
        />

        <span className="hidden text-line-dim sm:inline">·</span>

        <SlotChip
          filled={
            draft.startMinute !== undefined ? clockOf(draft.startMinute) : undefined
          }
          placeholder={strings.time}
          open={openSlot === "startMinute"}
          hint={strings.pickTime}
          onClear={() => onDraft((d) => ({ ...d, startMinute: undefined }))}
        />

        <span className="hidden text-line-dim sm:inline">·</span>

        {/* The member slot takes typing as well as pointing. */}
        {customer ? (
          <SlotChip
            filled={customer.name}
            placeholder={strings.customer}
            open={false}
            hint=""
            onClear={() => {
              onDraft((d) => ({ ...d, customerId: undefined }));
              setQuery("");
            }}
          />
        ) : (
          <span className="relative w-full sm:w-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={strings.pickCustomer}
              aria-label={strings.customer}
              className={cn(
                "min-h-11 w-full border-0 border-b bg-transparent px-1 text-[15px] placeholder:text-line-dim focus:outline-none sm:w-52",
                openSlot === "customerId"
                  ? "border-amber border-b-2"
                  : "border-line/30",
              )}
            />
            {matches.length > 0 && (
              <ul className="glass-pane absolute start-0 top-full z-30 mt-1 max-h-64 w-full overflow-y-auto bg-board py-1 sm:w-72">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onDraft((d) => ({ ...d, customerId: c.id }));
                        setQuery("");
                      }}
                      disabled={c.blocked}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-3 px-3 text-start hover:bg-ball/15",
                        c.blocked && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="truncate text-[14px]">{c.name}</span>
                      <span className="shrink-0 font-board text-[11px] tabular-nums text-line-dim">
                        {formatPhone(c.phone)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </span>
        )}

        <span className="hidden text-line-dim sm:inline">·</span>

        <span className="flex items-center gap-1">
          {DURATIONS.map((mins) => {
            const fits = durationFits(mins);
            return (
              <button
                key={mins}
                type="button"
                disabled={!fits}
                onClick={() => onDraft((d) => ({ ...d, durationMinutes: mins }))}
                className={cn(
                  "min-h-11 min-w-11 border px-2 font-board text-[12px] tabular-nums",
                  draft.durationMinutes === mins
                    ? "border-line/40 bg-line/20 text-court-deep"
                    : "border-line/30 text-line-dim",
                  openSlot === "durationMinutes" && fits && "border-amber border-b-2",
                  !fits && "cursor-not-allowed opacity-30 line-through",
                )}
              >
                {mins}
              </button>
            );
          })}
        </span>

        <span className="flex w-full items-center gap-2 sm:ms-auto sm:w-auto">
          <InkButton
            variant="quiet"
            size="sm"
            onClick={() => {
              onDraft({});
              setQuery("");
            }}
          >
            {strings.clear}
          </InkButton>
          <InkButton
            variant="secondary"
            size="sm"
            disabled={!parses || pending}
            onClick={() => commit(true)}
          >
            {locale === "ar" ? "احجز مؤقتاً" : "Hold"}
          </InkButton>
          <InkButton
            variant="primary"
            size="md"
            className="flex-1 sm:flex-none"
            disabled={!parses || pending}
            onClick={() => commit(false)}
          >
            {strings.commit}
          </InkButton>
        </span>
      </div>

      {/* The line reads back, and says what it is still waiting for. */}
      <p className="mt-1.5 font-board text-[11px] uppercase tracking-[0.1em] text-line-dim">
        {parses
          ? `${strings.verb} ${court?.name} · ${clockOf(draft.startMinute!)} · ${customer?.name} · ${draft.durationMinutes} min`
          : openSlot === "courtId"
            ? strings.pickCourt
            : openSlot === "startMinute"
              ? strings.pickTime
              : openSlot === "customerId"
                ? strings.pickCustomer
                : strings.pickDuration}
      </p>
    </section>
  );
}

function SlotChip({
  filled,
  placeholder,
  open,
  hint,
  onClear,
}: {
  filled?: string;
  placeholder: string;
  open: boolean;
  hint: string;
  onClear: () => void;
}) {
  if (filled) {
    return (
      <button
        type="button"
        onClick={onClear}
        title={hint}
        className="min-h-11 border-b border-line/40 px-1 text-[15px] font-semibold text-line hover:text-ball"
      >
        {filled}
      </button>
    );
  }
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex min-h-11 min-w-24 items-end border-b-2 px-1 pb-1.5 text-[13px] uppercase tracking-[0.08em]",
        open ? "border-amber text-amber" : "border-line/30 text-line-dim",
      )}
    >
      {placeholder}
    </span>
  );
}

function clockOf(minute: number): string {
  const h = Math.floor((minute + 6 * 60) / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
