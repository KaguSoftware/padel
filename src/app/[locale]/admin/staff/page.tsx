import { getTranslations, setRequestLocale } from "next-intl/server";
import { getClaims } from "@/auth/claims";
import { allowManager, MANAGER_ROLES } from "@/auth/guard";
import { Denied } from "@/ui/Denied";
import { getDb } from "@/data";
import { rowsOrThrow } from "@/data/query";
import type { Role } from "@/data/types";
import { formatPhone } from "@/lib/text";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import { Panel } from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";
import { NewAccount } from "./NewAccount";

export const dynamic = "force-dynamic";

/**
 * Permissions are a table, not a scattering of role checks — "who can give a
 * discount" is answerable by reading one grid, which is the question an owner
 * actually asks. This mirrors CAPABILITIES in src/auth/guard.ts.
 */
const CAPABILITIES: { key: string; label: string; roles: Role[] }[] = [
  { key: "view_admin", label: "Open the console", roles: ["owner", "manager", "staff", "coach"] },
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
  const claims = await allowManager();

  if (!claims) {
    const t = await getTranslations();
    return (
      <Denied
        title={t("nav.staff")}
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

  const db = getDb();
  // One wave. A count for the shell and a list for the table are two reads of
  // the same thing, so they go in the same round-trip — see PERFORMANCE.md.
  const [staff, accounts, t] = await Promise.all([
    rowsOrThrow("staff.list", db.staff.list()),
    rowsOrThrow("accounts.list", db.accounts.list()),
    getTranslations(),
  ]);
  const ar = locale === "ar";

  const roleLabels: Record<string, string> = {
    owner: t("common.roles.owner"),
    manager: t("common.roles.manager"),
    staff: t("common.roles.staff"),
    coach: t("common.roles.coach"),
    player: t("common.roles.player"),
  };

  // Creating a login is creating a way into the till, so it is the owner's
  // alone — the same role `manage_staff` names in the capability table below.
  const isOwner = claims.role === "owner";

  return (
    <PageShell title={t("nav.staff")} serial={`${staff.length}`}>
      <div className="space-y-8">
        <Panel title={t("staffPage.accounts")}>
          <LedgerTable heads={[t("account.email"), t("account.role"), t("staffPage.signedIn"), ""]}>
            {accounts.map((a) => (
              <LedgerRow key={a.id}>
                <Cell className="font-semibold">{a.email}</Cell>
                <Cell>
                  <span className="board-label text-inherit">
                    {roleLabels[a.role] ?? a.role}
                  </span>
                </Cell>
                <Cell className="font-board tabular-nums text-line-dim">
                  {a.lastSignInAt
                    ? a.lastSignInAt.toISOString().slice(0, 10)
                    : "—"}
                </Cell>
                <Cell>
                  {!a.active && <Stamp tone="void">{t("status.blocked")}</Stamp>}
                </Cell>
              </LedgerRow>
            ))}
          </LedgerTable>

          {accounts.length === 0 && (
            <p className="px-4 pb-4 board-label">
              {t("staffPage.noAccounts")}
            </p>
          )}

          <NewAccount
            roleLabels={roleLabels}
            disabled={!isOwner}
            disabledNote={t("staffPage.ownerOnly")}
          />
        </Panel>

        <Panel title={t("nav.staff")}>
          <LedgerTable
            heads={[t("customer.name"), t("customer.phone"), t("account.role"), ""]}
          >
            {staff.map((s) => (
              <LedgerRow key={s.id}>
                <Cell className="font-semibold">{ar ? s.nameAr : s.name}</Cell>
                <Cell className="font-board tabular-nums text-line-dim">
                  {formatPhone(s.phone)}
                </Cell>
                <Cell>
                  <span className="board-label text-inherit">
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

        <Panel title={t("staffPage.permissions")}>
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
                        className="font-board text-[15px] text-ball"
                        aria-label={t("staffPage.permitted")}
                      >
                        ✓
                      </span>
                    ) : (
                      <span
                        className="font-board text-[15px] text-line-dim"
                        aria-label={t("staffPage.notPermitted")}
                      >
                        —
                      </span>
                    )}
                  </Cell>
                ))}
              </LedgerRow>
            ))}
          </LedgerTable>
          <p className="mt-5 board-label leading-relaxed">
            {t("staffPage.enforcementNote")}
          </p>
        </Panel>
      </div>
    </PageShell>
  );
}
