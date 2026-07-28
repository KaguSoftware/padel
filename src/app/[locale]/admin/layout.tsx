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
import { AdminMobileNav } from "./AdminMobileNav";
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
  { href: "/admin/calendar", key: "calendar", Mark: LedgerMark },
  { href: "/admin/customers", key: "customers", Mark: CardMark },
  { href: "/admin/finances", key: "finances", Mark: DrawerMark },
  { href: "/admin/courts", key: "courts", Mark: CourtsMark },
  { href: "/admin/academy", key: "coaching", Mark: RacketMark },
  { href: "/admin/shop", key: "shop", Mark: ShelfMark },
  { href: "/admin/tournaments", key: "tournaments", Mark: BracketMark },
  { href: "/admin/staff", key: "staff", Mark: StaffMark },
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
            href="/admin/calendar"
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
              href="/admin/calendar"
              locale={locale === "ar" ? "en" : "ar"}
              className="mt-2 block px-1 font-board text-[11px] uppercase tracking-[0.14em] text-amber hover:text-ball"
            >
              {t("language")}
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 max-w-full flex-1 flex-col self-stretch">
          <AdminMobileNav
            locale={locale}
            labels={Object.fromEntries(NAV.map((n) => [n.key, t(n.key)]))}
            claims={claims}
            switchRoleLabel={tc("switchRole")}
            signedInAs={tc("signedInAs")}
            roleLabels={{
              owner: tc("roles.owner"),
              manager: tc("roles.manager"),
              staff: tc("roles.staff"),
              coach: tc("roles.coach"),
              player: tc("roles.player"),
            }}
            languageLabel={t("language")}
            menuLabel={tc("menu")}
          />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </TickerProvider>
  );
}
