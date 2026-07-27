"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * ONE CLOCK, NOT SIXTY.
 *
 * Sixty expiring holds each owning a `setInterval` is a guaranteed jank source
 * on the front-desk tablet, and the tablet is the whole product. A single 1Hz
 * ticker broadcasts `now`; every countdown subscribes to it.
 */

const TickContext = createContext<number>(0);

export function TickerProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <TickContext.Provider value={now}>{children}</TickContext.Provider>;
}

export function useNow(): number {
  return useContext(TickContext);
}

/** mm:ss remaining, or null once it has lapsed. */
export function useCountdown(until: Date | string | null): string | null {
  const now = useNow();
  if (!until) return null;
  const target = typeof until === "string" ? Date.parse(until) : until.getTime();
  const ms = target - (now || Date.now());
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 0 → 1 as a hold runs out. Drives how far the perforated edge has torn. */
export function useHoldProgress(
  issuedAt: Date | string | null,
  expiresAt: Date | string | null,
): number {
  const now = useNow();
  if (!issuedAt || !expiresAt) return 0;
  const from = typeof issuedAt === "string" ? Date.parse(issuedAt) : issuedAt.getTime();
  const to = typeof expiresAt === "string" ? Date.parse(expiresAt) : expiresAt.getTime();
  const span = to - from;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, ((now || Date.now()) - from) / span));
}
