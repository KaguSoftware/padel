import { getTranslations, setRequestLocale } from "next-intl/server";
import { getClaims } from "@/auth/claims";
import { TickerProvider } from "@/ui/Ticker";
import { AdminMobileNav } from "./AdminMobileNav";
import { AdminRail } from "./AdminRail";
import { NAV } from "./nav";

/**
 * The admin shell — the control desk at the side of the floodlit court.
 *
 * Two things the rail did not do before and now does: it says which module you
 * are standing in, and it stops spending optic yellow on a hover. Yellow means
 * available-or-live in this product and nothing else; a nav item under a cursor
 * is neither, and once yellow starts meaning "the pointer is here" the board
 * stops meaning anything.
 */
export default async function AdminLayout({
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

  const labels = Object.fromEntries(NAV.map((n) => [n.key, t(n.key)]));
  const roleLabels = {
    owner: tc("roles.owner"),
    manager: tc("roles.manager"),
    staff: tc("roles.staff"),
    coach: tc("roles.coach"),
    player: tc("roles.player"),
  };

  return (
    <TickerProvider>
      <div className="desk court-world flex min-h-dvh bg-court-deep md:items-start">
        <AdminRail
          locale={locale}
          labels={labels}
          claims={claims}
          switchRoleLabel={tc("switchRole")}
          signedInAs={tc("signedInAs")}
          roleLabels={roleLabels}
          languageLabel={t("language")}
        />

        <div className="flex min-w-0 max-w-full flex-1 flex-col self-stretch">
          <AdminMobileNav
            locale={locale}
            labels={labels}
            claims={claims}
            switchRoleLabel={tc("switchRole")}
            signedInAs={tc("signedInAs")}
            roleLabels={roleLabels}
            languageLabel={t("language")}
            menuLabel={tc("menu")}
          />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </TickerProvider>
  );
}
