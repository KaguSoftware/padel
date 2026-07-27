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

  const [t, claims] = await Promise.all([getTranslations("nav"), getClaims()]);
  const role = claims?.role ?? "player";

  // The sub-nav only offers what this person can actually open. A rail full of
  // doors that answer "not your board" is worse than a shorter rail.
  const items = [
    { href: "/console/finances/till", label: t("till"), show: can(role, "close_till") },
    { href: "/console/finances/ledgers", label: t("reports"), show: can(role, "view_reports") },
    { href: "/console/finances/rates", label: t("pricing"), show: can(role, "edit_pricing") },
    { href: "/console/finances/audit", label: t("audit"), show: can(role, "view_audit") },
  ].filter((i) => i.show);

  return (
    <div className="court-world min-h-dvh bg-court-deep">
      <FinanceNav items={items} title={t("finances")} />
      {children}
    </div>
  );
}
