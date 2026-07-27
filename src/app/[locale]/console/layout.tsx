import { getTranslations, setRequestLocale } from "next-intl/server";
import { getClaims } from "@/auth/claims";
import { Link } from "@/i18n/routing";
import { TickerProvider } from "@/ui/Ticker";
import {
  BracketMark,
  CardMark,
  CourtsMark,
  CourtMark,
  DrawerMark,
  LedgerMark,
  LedgersMark,
  RacketMark,
  ShelfMark,
  StaffMark,
  StampMark,
  TariffMark,
} from "@/ui/marks";
import { RoleSwitcher } from "./RoleSwitcher";

/**
 * The console shell â€” bottle-green card stock around the ledger page.
 *
 * The scene decides the treatment: a front-desk tablet on a counter with a
 * glass court wall behind it, in Gulf daylight. The working page is light and
 * high-contrast; the chrome that frames it is the card stock the page was
 * bound into.
 */

const NAV = [
  { href: "/console/calendar", key: "calendar", Mark: LedgerMark },
  { href: "/console/customers", key: "customers", Mark: CardMark },
  { href: "/console/till", key: "till", Mark: DrawerMark },
  { href: "/console/pricing", key: "pricing", Mark: TariffMark },
  { href: "/console/courts", key: "courts", Mark: CourtsMark },
  { href: "/console/academy", key: "coaching", Mark: RacketMark },
  { href: "/console/shop", key: "shop", Mark: ShelfMark },
  { href: "/console/tournaments", key: "tournaments", Mark: BracketMark },
  { href: "/console/reports", key: "reports", Mark: LedgersMark },
  { href: "/console/staff", key: "staff", Mark: StaffMark },
  { href: "/console/audit", key: "audit", Mark: StampMark },
] as const;

export default async function ConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tc, claims] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
    getClaims(),
  ]);

  return (
    <TickerProvider>
      <div className="flex min-h-dvh bg-court-deep md:items-start">
        {/* The spine of the bound ledger. */}
        <aside className="sticky top-0 hidden h-dvh w-[13.5rem] shrink-0 flex-col border-e border-line/20 bg-court-deep md:flex">
          <Link
            href="/console/calendar"
            className="flex items-center gap-2.5 border-b border-line/20 px-4 py-4 text-line"
          >
            <CourtMark size={26} className="text-ball" />
            <span className="min-w-0">
              <span className="block painted text-[19px] leading-none tracking-tight">
                Kagu
              </span>
              <span className="block font-board text-[10px] uppercase tracking-[0.22em] text-amber">
                Padel
              </span>
            </span>
          </Link>

          <nav className="flex-1 overflow-y-auto py-2">
            {NAV.map(({ href, key, Mark }) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-11 items-center gap-3 px-4 py-2 text-[13px] text-line/80 transition-colors hover:bg-court-lit/30 hover:text-line"
              >
                <Mark size={17} className="shrink-0 text-amber/80" />
                <span className="truncate">{t(key)}</span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-line/20 p-3">
            <RoleSwitcher
              current={claims}
              label={tc("switchRole")}
              signedInAs={tc("signedInAs")}
              roleLabels={{
                owner: tc("roles.owner"),
                manager: tc("roles.manager"),
                staff: tc("roles.staff"),
                coach: tc("roles.coach"),
                player: tc("roles.player"),
              }}
            />
            <Link
              href="/console/calendar"
              locale={locale === "ar" ? "en" : "ar"}
              className="mt-2 block px-1 font-board text-[11px] uppercase tracking-[0.14em] text-amber hover:text-ball"
            >
              {t("language")}
            </Link>
          </div>
        </aside>

        {/* Mobile spine: the same nav, laid along the bottom edge. */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-line/20 bg-court-deep md:hidden">
          {NAV.slice(0, 6).map(({ href, key, Mark }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 px-2 text-line/80"
            >
              <Mark size={18} className="text-amber/80" />
              <span className="text-[10px] leading-none">{t(key)}</span>
            </Link>
          ))}
        </nav>

        <main className="min-w-0 flex-1 self-stretch pb-16 md:pb-0">
          {children}
        </main>
      </div>
    </TickerProvider>
  );
}
