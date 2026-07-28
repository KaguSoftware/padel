import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

/**
 * The 404 for a URL that DID match a locale, so the document, fonts and
 * direction all come from `[locale]/layout.tsx` and this only needs the
 * content.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("nav");

  return (
    <main className="court-world court-surface flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="board-digit text-[clamp(4rem,18vw,9rem)] leading-none">404</p>

      <h1 className="painted mt-4 text-[clamp(1.75rem,6vw,3rem)]">Out of play</h1>

      <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-line/75">
        That page is not on the board.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/play"
          className="live-block inline-flex min-h-12 items-center px-6 font-stadium text-[12px] uppercase tracking-[0.09em] transition-[filter,transform] duration-100 hover:brightness-110 active:translate-y-0.5"
        >
          {t("book")}
        </Link>
        <Link
          href="/admin/calendar"
          className="inline-flex min-h-12 items-center border border-line/35 px-6 font-stadium text-[12px] uppercase tracking-[0.09em] text-line transition-colors hover:border-line hover:bg-line/10"
        >
          {t("calendar")}
        </Link>
      </div>
    </main>
  );
}
