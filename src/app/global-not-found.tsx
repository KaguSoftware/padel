import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Archivo_Black, Doto } from "next/font/google";
import "./globals.css";

/**
 * The 404 that renders OUTSIDE any locale segment.
 *
 * `app/layout.tsx` deliberately has no <html>/<body> — those live in
 * `[locale]/layout.tsx`, because `lang` and `dir` must be decided by the locale
 * and set before first paint. That leaves exactly one gap: a URL that matches
 * no locale segment at all renders through the root layout only, with no
 * document around it. This file is that document.
 *
 * It carries its own fonts because it is outside the locale layout that
 * normally loads them.
 */

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], display: "swap" });
const stadium = Archivo_Black({
  variable: "--font-stadium",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
});
const board = Doto({
  variable: "--font-board",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Out of play — Kagu Padel",
  description: "That page is not on the board.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${archivo.variable} ${stadium.variable} ${board.variable} h-full`}>
      <body className="court-world min-h-full antialiased">
        <main className="court-surface flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          {/* The out-of-court call: the ball landed outside the lines. */}
          <p className="board-digit text-[clamp(4rem,18vw,9rem)] leading-none">404</p>

          <h1 className="painted mt-4 text-[clamp(1.75rem,6vw,3rem)]">
            Out of play
          </h1>

          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-line/75">
            That page is not on the board. It may have moved — the cash book,
            ledgers, rate card and audit log now live together under Finances.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/en"
              className="live-block inline-flex min-h-12 items-center px-6 font-stadium text-[12px] uppercase tracking-[0.09em] transition-[filter,transform] duration-100 hover:brightness-110 active:translate-y-0.5"
            >
              Book a court
            </Link>
            <Link
              href="/en/console/calendar"
              className="inline-flex min-h-12 items-center border border-line/35 px-6 font-stadium text-[12px] uppercase tracking-[0.09em] text-line transition-colors hover:border-line hover:bg-line/10"
            >
              Day book
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
