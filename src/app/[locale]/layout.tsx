import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import {
  Almarai,
  Archivo,
  Archivo_Black,
  Bodoni_Moda,
  Courier_Prime,
  Doto,
  Noto_Kufi_Arabic,
  Noto_Naskh_Arabic,
} from "next/font/google";
import { dirOf, routing } from "@/i18n/routing";
import "../globals.css";

/**
 * Faces chosen as objects from the subject's world, per DESIGN.md:
 *
 *   Bodoni Moda      didone — the letterform of certificates, prospectuses and
 *                    banknotes. Display sizes only; its hairlines break small.
 *   Archivo          workhorse grotesque with true tabular figures, for the
 *                    ledger body and every column of numbers.
 *   Courier Prime    typewriter — carbon triplicate receipts were typed. Serials,
 *                    times, receipts, audit log.
 *   Noto Naskh       the register of official Gulf documents.
 *   Almarai          Arabic UI workhorse, on its own size and leading ramp.
 */

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700", "900"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const courier = Courier_Prime({
  variable: "--font-courier",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

const naskh = Noto_Naskh_Arabic({
  variable: "--font-naskh",
  subsets: ["arabic"],
  display: "swap",
  weight: ["400", "700"],
});

const almarai = Almarai({
  variable: "--font-almarai",
  subsets: ["arabic"],
  display: "swap",
  weight: ["300", "400", "700", "800"],
});

/**
 * THE BOARD's faces (public surface).
 *
 *   Archivo Black    stadium lettering — the heavy grotesque that court
 *                    signage and fixture posters are painted in.
 *   Doto             a dot-matrix variable face. This is the board's
 *                    mechanical readout: departure-board digits, not a
 *                    "tech mono". It is deliberately not a training-data
 *                    default, and no other face reads as a live board.
 *   Noto Kufi        Kufi is the geometric/architectural register of Arabic —
 *                    the script of signage and stadium plates. Naskh (used in
 *                    the console) is the register of documents; putting a
 *                    document face on a scoreboard would be the same mistake
 *                    as setting the English in a book serif.
 */
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
      className={`${bodoni.variable} ${archivo.variable} ${courier.variable} ${naskh.variable} ${almarai.variable} ${stadium.variable} ${board.variable} ${kufi.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="bg-court-deep text-line min-h-full antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
