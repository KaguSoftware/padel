import { redirect } from "next/navigation";
import { getClaims } from "@/auth/claims";
import { can } from "@/auth/guard";

/**
 * Land on the module this person can actually open.
 *
 * Front desk can close a shift but cannot read the ledgers, so sending
 * everyone to the same default would greet half the staff with a refusal.
 */
export default async function FinancesIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const claims = await getClaims();
  const role = claims?.role ?? "player";

  if (can(role, "close_till")) redirect(`/${locale}/console/finances/till`);
  if (can(role, "view_reports")) redirect(`/${locale}/console/finances/ledgers`);
  redirect(`/${locale}/console/calendar`);
}
