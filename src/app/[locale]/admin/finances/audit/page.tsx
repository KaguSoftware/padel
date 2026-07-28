import { getTranslations, setRequestLocale } from "next-intl/server";
import { getClaims } from "@/auth/claims";
import { allowManager, MANAGER_ROLES } from "@/auth/guard";
import { Denied } from "@/ui/Denied";
import { loadAuditPage } from "@/data/loaders";
import { formatMoney } from "@/lib/money";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import { EmptyLine } from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";

export const dynamic = "force-dynamic";

/** Actions that move money get a stamp; the rest are ordinary lines. */
const MONEY_ACTIONS = new Set([
  "booking.discount",
  "booking.cancel",
  "payment.take",
  "payment.refund",
  "till.close",
  "customer.credit",
]);

export default async function AuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const claims = await allowManager();

  if (!claims) {
    const t = await getTranslations();
    return (
      <Denied
        title={t("audit.title")}
        needs={MANAGER_ROLES}
        have={(await getClaims())?.role ?? null}
        roleLabels={{
          owner: t("common.roles.owner"),
          manager: t("common.roles.manager"),
          staff: t("common.roles.staff"),
          coach: t("common.roles.coach"),
          player: t("common.roles.player"),
        }}
      />
    );
  }

  const [data, t] = await Promise.all([loadAuditPage(), getTranslations()]);
  const ar = locale === "ar";

  const staffName = (id: string) => {
    const s = data.staff.find((x) => x.id === id);
    return s ? (ar ? s.nameAr : s.name) : id;
  };

  return (
    <PageShell
      title={t("audit.title")}
      serial={`${data.entries.length} entries`}
      note={t("audit.immutable")}
    >
      {data.entries.length === 0 ? (
        <EmptyLine>{t("audit.none")}</EmptyLine>
      ) : (
        <LedgerTable
          heads={[
            t("audit.when"),
            t("audit.who"),
            t("audit.what"),
            t("audit.amount"),
            t("audit.reason"),
          ]}
        >
          {data.entries.map((e) => (
            <LedgerRow key={e.id}>
              <Cell className="whitespace-nowrap font-board text-[14px] tabular-nums text-line-dim">
                {new Date(e.at).toLocaleString(locale, {
                  timeZone: "Asia/Dubai",
                  dateStyle: "short",
                  timeStyle: "medium",
                })}
              </Cell>
              <Cell className="whitespace-nowrap">{staffName(e.actorId)}</Cell>
              <Cell>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="board-label board-label-sm text-amber">
                    {e.action}
                  </span>
                  <span>{ar ? e.summaryAr : e.summary}</span>
                  {MONEY_ACTIONS.has(e.action) && (
                    <Stamp tone="part">₣</Stamp>
                  )}
                </span>
              </Cell>
              <Cell numeric className={e.amount && e.amount < 0 ? "text-ball" : ""}>
                {e.amount === null
                  ? "—"
                  : formatMoney(e.amount, locale, { showCurrency: false })}
              </Cell>
              <Cell className="max-w-72 truncate text-[14px] text-line-dim">
                {e.reason ?? ""}
              </Cell>
            </LedgerRow>
          ))}
        </LedgerTable>
      )}
    </PageShell>
  );
}
