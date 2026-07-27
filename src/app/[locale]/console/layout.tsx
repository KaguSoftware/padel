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
  RacketMark,
  ShelfMark,
  StaffMark,
} from "@/ui/marks";
import { RoleSwitcher } from "./RoleSwitcher";

/**
 * The console shell — the control desk at the side of the floodlit court.
 *
 * The rail is deliberately short. The cash book, the ledgers, the rate card and
 * the audit log are four views of ONE job — what did we take, where are the
 * leaks, who gave that discount — so they live behind a single FINANCES entry
 * with its own section rail, instead of as four siblings the owner has to hunt
 * through one at a time.
 */

const NAV = [
  { href: "/console/calendar", key: "calendar", Mark: LedgerMark },
  { href: "/console/customers", key: "customers", Mark: CardMark },
  { href: "/console/finances", key: "finances", Mark: DrawerMark },
  { href: "/console/courts", key: "courts", Mark: CourtsMark },
  { href: "/console/academy", key: "coaching", Mark: RacketMark },
  { href: "/console/shop", key: "shop", Mark: ShelfMark },
  { href: "/console/tournaments", key: "tournaments", Mark: BracketMark },
  { href: "/console/staff", key: "staff", Mark: StaffMark },
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
      <div className="court-world flex min-h-dvh bg-court-deep md:items-start">
        {/* The control desk's rail, alongside the court. */}
        <aside className="sticky top-0 hidden h-dvh w-[13.5rem] shrink-0 flex-col border-e border-line/20 bg-board md:flex">
          <Link
            href="/console/calendar"
            className="flex items-center gap-3 border-b border-line/20 px-4 py-4 text-line"
          >
            <CourtMark size={28} className="text-ball" />
            <span className="min-w-0">
              <span className="painted block text-[18px] leading-none">Kagu</span>
              <span className="block font-board text-[10px] uppercase leading-none tracking-[0.34em] text-amber">
                Padel
              </span>
            </span>
          </Link>

          <nav className="flex-1 overflow-y-auto py-2">
            {NAV.map(({ href, key, Mark }) => (
              <Link
                key={href}
                href={href}
                className="group flex min-h-11 items-center gap-3 border-s-2 border-transparent px-4 py-2 font-stadium text-[11px] uppercase tracking-[0.07em] text-line/70 transition-colors hover:border-s-ball hover:bg-line/8 hover:text-line"
              >
                <Mark
                  size={17}
                  className="shrink-0 text-line-dim transition-colors group-hover:text-ball"
                />
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

        {/* Mobile: the same rail along the bottom edge, within thumb reach.
            EVERY destination is here — a rail that silently drops the last
            entries is a rail that hides half the product on a phone. */}
        <nav className="safe-bottom scroll-x fixed inset-x-0 bottom-0 z-40 flex border-t border-line/20 bg-board md:hidden">
          {NAV.map(({ href, key, Mark }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-15 min-w-[4.75rem] shrink-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-line/75 active:bg-line/10"
            >
              <Mark size={18} className="text-line-dim" />
              <span className="font-board text-[9px] uppercase leading-none tracking-[0.1em]">
                {t(key)}
              </span>
            </Link>
          ))}
        </nav>

        {/* The bar's height is reserved here, so the last row of any page is
            reachable rather than trapped under it. */}
        <main className="pad-for-bar min-w-0 max-w-full flex-1 self-stretch md:pb-0">
          {children}
        </main>
      </div>
    </TickerProvider>
  );
}
