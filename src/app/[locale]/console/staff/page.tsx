import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireManager } from "@/auth/guard";
import { getDb } from "@/data";
import { rowsOrThrow } from "@/data/query";
import type { Role } from "@/data/types";
import { formatPhone } from "@/lib/text";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import { Panel } from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";

export const dynamic = "force-dynamic";

/**
 * Permissions are a table, not a scattering of role checks â€” "who can give a
 * discount" is answerable by reading one grid, which is the question an owner
 * actually asks. This mirrors CAPABILITIES in src/auth/guard.ts.
 */
const CAPABILITIES: { key: string; label: string; roles: Role[] }[] = [
  { key: "view_console", label: "Open the console", roles: ["owner", "manager", "staff", "coach"] },
  { key: "take_payment", label: "Take a payment", roles: ["owner", "manager", "staff"] },
  { key: "cancel_booking", label: "Cancel an entry", roles: ["owner", "manager", "staff"] },
  { key: "close_till", label: "Close the shift", roles: ["owner", "manager", "staff"] },
  { key: "apply_discount", label: "Apply a discount", roles: ["owner", "manager"] },
  { key: "edit_pricing", label: "Edit the rate card", roles: ["owner", "manager"] },
  { key: "edit_courts", label: "Edit courts and hours", roles: ["owner", "manager"] },
  { key: "view_reports", label: "Read the ledgers", roles: ["owner", "manager"] },
  { key: "view_audit", label: "Read the audit log", roles: ["owner", "manager"] },
  { key: "manage_staff", label: "Manage staff", roles: ["owner"] },
];

const ROLES: Role[] = ["owner", "manager", "staff", "coach", "player"];

export default async function StaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireManager();

  const db = getDb();
  const [staff, t] = await Promise.all([
    rowsOrThrow("staff.list", db.staff.list()),
    getTranslations(),
  ]);
  const ar = locale === "ar";

  return (
    <PageShell title={t("nav.staff")} serial={`${staff.length}`}>
      <div className="space-y-6">
        <Panel title={t("nav.staff")}>
          <LedgerTable
            heads={[t("customer.name"), t("customer.phone"), "Role", ""]}
          >
            {staff.map((s) => (
              <LedgerRow key={s.id}>
                <Cell className="font-semibold">{ar ? s.nameAr : s.name}</Cell>
                <Cell className="font-board tabular-nums text-line-dim">
                  {formatPhone(s.phone)}
                </Cell>
                <Cell>
                  <span className="font-board text-[11px] uppercase tracking-[0.1em]">
                    {t(`common.roles.${s.role}` as "common.roles.owner")}
                  </span>
                </Cell>
                <Cell>
                  {!s.active && <Stamp tone="void">{t("status.blocked")}</Stamp>}
                </Cell>
              </LedgerRow>
            ))}
          </LedgerTable>
        </Panel>

        <Panel title="Permissions">
          <LedgerTable
            heads={[
              "",
              ...ROLES.map((r) => t(`common.roles.${r}` as "common.roles.owner")),
            ]}
          >
            {CAPABILITIES.map((c) => (
              <LedgerRow key={c.key}>
                <Cell className="font-semibold">{c.label}</Cell>
                {ROLES.map((r) => (
                  <Cell key={r} className="text-center">
                    {c.roles.includes(r) ? (
                      <span
                        className="font-board text-[13px] text-ball"
                        aria-label="permitted"
                      >
                        âœ“
                      </span>
                    ) : (
                      <span
                        className="font-board text-[13px] text-line-dim"
                        aria-label="not permitted"
                      >
                        â€”
                      </span>
                    )}
                  </Cell>
                ))}
              </LedgerRow>
            ))}
          </LedgerTable>
          <p className="mt-3 font-board text-[11px] leading-relaxed text-line-dim">
            These are enforced server-side per action, not by hiding buttons.
            When Supabase lands, RLS becomes the real boundary and this table
            becomes the affordance on top of it.
          </p>
        </Panel>
      </div>
    </PageShell>
  );
}
