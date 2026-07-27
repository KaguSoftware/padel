import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { CourtMark } from "@/ui/marks";
import { TickerProvider } from "@/ui/Ticker";

/**
 * The public shell. Marketing is Persuade, the booking flow is Operate, and
 * both live inside the same bound ledger â€” the club's public face is the same
 * book its staff write in, which is the argument the product is making.
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
      <div className="flex min-h-dvh flex-col bg-court-deep">
        <header className="border-b border-line/20 bg-court-deep text-line">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <CourtMark size={26} className="text-ball" />
              <span>
                <span className="block painted text-[20px] leading-none tracking-tight">
                  Kagu
                </span>
                <span className="block font-board text-[10px] uppercase tracking-[0.22em] text-amber">
                  Padel
                </span>
              </span>
            </Link>

            <nav className="flex flex-wrap items-center gap-x-1 gap-y-1">
              <SiteLink href="/play">{t("book")}</SiteLink>
              <SiteLink href="/play/matches">{t("matches")}</SiteLink>
              <SiteLink href="/play/account">{t("account")}</SiteLink>
              <SiteLink href="/console/calendar">{t("console")}</SiteLink>
              <Link
                href="/"
                locale={locale === "ar" ? "en" : "ar"}
                className="ms-2 min-h-11 px-2 py-2 font-board text-[11px] uppercase tracking-[0.14em] text-amber hover:text-ball"
              >
                {t("language")}
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-line/20 bg-court-deep px-4 py-6 text-line-dim">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 font-board text-[11px]">
            <span>Kagu Padel Â· Al Quoz 1, Dubai</span>
            <span className="text-amber">
              Prototype â€” synthetic sample data throughout
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
      className="min-h-11 px-3 py-2 text-[13px] text-line/85 hover:text-line"
    >
      {children}
    </Link>
  );
}
