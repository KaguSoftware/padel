import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import {
  Almarai,
  Archivo,
  Archivo_Black,
  Doto,
  Noto_Kufi_Arabic,
} from "next/font/google";
import { dirOf, routing } from "@/i18n/routing";
import "../globals.css";

/**
 * THE BOARD's faces. Five, and every one of them is reachable.
 *
 *   Archivo Black    stadium lettering — the heavy grotesque that court
 *                    signage and fixture posters are painted in. Painted
 *                    headings, court names, buttons.
 *   Doto             a dot-matrix variable face: the board's mechanical
 *                    readout. Departure-board digits, not a "tech mono", and
 *                    deliberately not a training-data default. It carries
 *                    FIGURES — clocks, money, serials, counters — and, since
 *                    the comfort pass, nothing else. Set as running label text
 *                    at 10px it was a texture rather than words, on a screen
 *                    somebody reads for an eight-hour shift.
 *   Archivo          workhorse grotesque with true tabular figures. Body copy,
 *                    form fields, and every label in the console.
 *   Noto Kufi        Kufi is Arabic's geometric/architectural register — the
 *                    script of signage and stadium plates. Painted headings in
 *                    Arabic. A Naskh (document) face on a scoreboard would be
 *                    the same mistake as setting the English in a book serif.
 *   Almarai          Arabic UI workhorse, on its own size and leading ramp.
 *
 * Bodoni Moda, Courier Prime and Noto Naskh were loaded here until the comfort
 * pass and referenced by no `@theme` token and no class — three Google font
 * families downloaded on every cold visit for nothing. They belonged to the
 * pre-Board ledger aesthetic and left with it.
 */

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const almarai = Almarai({
  variable: "--font-almarai",
  subsets: ["arabic"],
  display: "swap",
  weight: ["300", "400", "700", "800"],
});

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
  weight: ["400", "700", "900"],
});

const kufi = Noto_Kufi_Arabic({
  variable: "--font-kufi",
  subsets: ["arabic"],
  display: "swap",
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "Kagu Padel — Day Book",
  description:
    "Court booking and club operations for Kagu Padel. Prototype with synthetic data.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={`${archivo.variable} ${almarai.variable} ${stadium.variable} ${board.variable} ${kufi.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="bg-court-deep text-line min-h-full antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
