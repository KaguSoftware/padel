import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { CourtMark } from "@/ui/marks";
import { TickerProvider } from "@/ui/Ticker";

/**
 * The public shell.
 *
 * Marketing is Persuade, the booking flow is Operate, and both stand on the
 * same floodlit court. The nav is fence signage: wide caps, wide tracking, the
 * live route marked in optic yellow.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  return (
    <TickerProvider>
      <div className="court-world flex min-h-dvh flex-col bg-court-deep">
        <header className="sticky top-0 z-40 border-b border-line/20 bg-court-deep/92 text-line backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
            <Link href="/" className="flex items-center gap-3">
              <CourtMark size={28} className="text-ball" />
              <span>
                <span className="painted block text-[19px] leading-none">
                  Kagu
                </span>
                <span className="block font-board text-[10px] uppercase leading-none tracking-[0.34em] text-amber">
                  Padel
                </span>
              </span>
            </Link>

            <nav className="scroll-x -mx-1 flex w-full items-center gap-x-0.5 px-1 sm:mx-0 sm:w-auto sm:px-0">
              <SiteLink href="/play">{t("book")}</SiteLink>
              <SiteLink href="/play/matches">{t("matches")}</SiteLink>
              <SiteLink href="/play/account">{t("account")}</SiteLink>
              <SiteLink href="/console/calendar">{t("console")}</SiteLink>
              <Link
                href="/"
                locale={locale === "ar" ? "en" : "ar"}
                className="ms-2 flex min-h-11 items-center border border-line/25 px-3 font-board text-[11px] uppercase tracking-[0.18em] text-amber transition-colors hover:border-amber hover:text-ball"
              >
                {t("language")}
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-line/20 bg-court-deep px-5 py-8 text-line-dim">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 font-board text-[10px] uppercase tracking-[0.18em]">
            <span>Kagu Padel · Al Quoz 1, Dubai</span>
            <span className="text-amber">
              Prototype — synthetic sample data throughout
            </span>
          </div>
        </footer>
      </div>
    </TickerProvider>
  );
}

function SiteLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center px-3 font-stadium text-[11px] uppercase tracking-[0.09em] text-line/75 transition-colors hover:text-ball"
    >
      {children}
    </Link>
  );
}
