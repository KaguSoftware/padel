import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { CourtMark } from "@/ui/marks";
import { TickerProvider } from "@/ui/Ticker";
import { SiteNav } from "./SiteNav";

/**
 * The public shell.
 *
 * Marketing is Persuade, the booking flow is Operate, and both stand on the
 * same floodlit court. The nav is fence signage: wide caps, wide tracking, the
 * current route marked in optic yellow — inline on a wide screen, a drawer on
 * a phone.
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

  const [t, tc] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
  ]);

  const links = [
    { href: "/play", label: t("book") },
    { href: "/play/matches", label: t("matches") },
    { href: "/play/account", label: t("account") },
    { href: "/console/calendar", label: t("console") },
  ];

  return (
    <TickerProvider>
      <div className="court-world flex min-h-dvh flex-col bg-court-deep">
        <header className="sticky top-0 z-40 border-b border-line/20 bg-court-deep/92 text-line backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <Link href="/" className="flex shrink-0 items-center gap-3">
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

            <SiteNav
              links={links}
              locale={locale}
              languageLabel={t("language")}
              menuLabel={tc("menu")}
            />
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-line/20 bg-court-deep px-4 py-8 text-line-dim sm:px-5">
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
