import { getTranslations, setRequestLocale } from "next-intl/server";
import { getClaims } from "@/auth/claims";
import { can } from "@/auth/guard";
import { FinanceNav } from "./FinanceNav";

/**
 * FINANCES — the money section.
 *
 * Four modules that answer one job: what did we take, where are the leaks, and
 * who gave that discount. Splitting them across the top-level rail made the
 * owner hunt for them one at a time.
 *
 * ⚠️ These are ROUTES, not client-side tabs, and that is deliberate — it does
 * not contradict the "tabs are client state" rule in PERFORMANCE.md. That rule
 * is about tabs over ONE dataset that already arrived in a page's single wave.
 * These four have large, independent datasets (the ledgers alone read a month
 * of bookings plus per-day payments), so folding them into one route would make
 * every visit to the cash book pay for the reports it did not ask for.
 */
export default async function FinancesLayout({
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
  const role = claims?.role ?? "player";

  // Every module is listed, always — including the ones this role cannot open.
  // Filtering them out left a front-desk session showing a lone "Cash Book",
  // which reads as a half-built product rather than as a permission.
  const managerOnly = `${tc("roles.manager")} · ${tc("roles.owner")}`;
  const items = [
    {
      href: "/console/finances/till",
      label: t("till"),
      allowed: can(role, "close_till"),
      needs: tc("roles.staff"),
    },
    {
      href: "/console/finances/ledgers",
      label: t("reports"),
      allowed: can(role, "view_reports"),
      needs: managerOnly,
    },
    {
      href: "/console/finances/rates",
      label: t("pricing"),
      allowed: can(role, "edit_pricing"),
      needs: managerOnly,
    },
    {
      href: "/console/finances/audit",
      label: t("audit"),
      allowed: can(role, "view_audit"),
      needs: managerOnly,
    },
  ];

  return (
    <div className="court-world min-h-dvh bg-court-deep">
      <FinanceNav items={items} title={t("finances")} />
      {children}
    </div>
  );
}
