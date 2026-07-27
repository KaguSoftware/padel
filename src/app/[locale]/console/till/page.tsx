import { getTranslations, setRequestLocale } from "next-intl/server";
import { getClaims } from "@/auth/claims";
import { can, requireConsole } from "@/auth/guard";
import { loadTillPage } from "@/data/loaders";
import { todayInDubai } from "@/lib/time";
import { CashBook } from "./CashBook";

export const dynamic = "force-dynamic";

export default async function TillPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireConsole();

  const [data, claims, t] = await Promise.all([
    loadTillPage(todayInDubai()),
    getClaims(),
    getTranslations(),
  ]);

  const staffName = (id: string | null) => {
    if (!id) return "—";
    const s = data.staff.find((x) => x.id === id);
    return s ? (locale === "ar" ? s.nameAr : s.name) : id;
  };

  return (
    <CashBook
      locale={locale}
      day={data.day}
      session={
        data.session
          ? {
              id: data.session.id,
              openingFloat: data.session.openingFloat,
              openedBy: staffName(data.session.openedBy),
              openedAt: data.session.openedAt.toISOString(),
            }
          : null
      }
      byMethod={data.byMethod}
      expected={data.expected}
      history={data.recent
        .filter((s) => s.closedAt !== null)
        .map((s) => ({
          id: s.id,
          day: s.operatingDay,
          openingFloat: s.openingFloat,
          countedCash: s.countedCash,
          variance: s.variance,
          closedBy: staffName(s.closedBy),
          note: s.varianceNote,
        }))}
      canClose={can(claims?.role ?? "player", "close_till")}
      strings={{
        title: t("till.title"),
        open: t("till.open"),
        close: t("till.close"),
        openingFloat: t("till.openingFloat"),
        cashTaken: t("till.cashTaken"),
        cardTaken: t("till.cardTaken"),
        walletTaken: t("till.walletTaken"),
        expected: t("till.expected"),
        counted: t("till.counted"),
        variance: t("till.variance"),
        over: t("till.over"),
        short: t("till.short"),
        balanced: t("till.balanced"),
        closedBy: t("till.closedBy"),
        openedBy: t("till.openedBy"),
        varianceNote: t("till.varianceNote"),
        noSession: t("till.noSession"),
        countPrompt: t("till.countPrompt"),
        empty: t("common.empty"),
      }}
    />
  );
}
