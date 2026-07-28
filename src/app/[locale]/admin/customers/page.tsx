import { getTranslations, setRequestLocale } from "next-intl/server";
import { loadCustomersPage } from "@/data/loaders";
import { requireAdmin } from "@/auth/guard";
import { normalisePhone } from "@/lib/text";
import { CustomerLedger, type CustomerRow } from "./CustomerLedger";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();

  const [{ customers, bookings, participants }, t] = await Promise.all([
    loadCustomersPage(),
    getTranslations(),
  ]);

  const bookingCount = new Map<string, number>();
  for (const b of bookings) {
    if (b.customerId) {
      bookingCount.set(b.customerId, (bookingCount.get(b.customerId) ?? 0) + 1);
    }
  }
  for (const p of participants) {
    if (p.customerId) {
      bookingCount.set(p.customerId, (bookingCount.get(p.customerId) ?? 0) + 1);
    }
  }

  // Duplicate detection is the same rule the create action uses: the
  // normalised phone number, not the name. Surfacing it here is how the club
  // stops accumulating two spellings of the same person.
  const byPhone = new Map<string, string[]>();
  for (const c of customers) {
    const key = normalisePhone(c.phone);
    byPhone.set(key, [...(byPhone.get(key) ?? []), c.id]);
  }
  const duplicates = new Set(
    [...byPhone.values()].filter((ids) => ids.length > 1).flat(),
  );

  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    name: locale === "ar" ? (c.nameAr ?? c.name) : c.name,
    altName: locale === "ar" ? c.name : (c.nameAr ?? ""),
    phone: c.phone,
    level: c.level,
    tier: c.tier,
    creditBalance: c.creditBalance,
    noShowCount: c.noShowCount,
    totalSpend: c.totalSpend,
    blocked: c.blocked,
    blockedReason: c.blockedReason,
    bookings: bookingCount.get(c.id) ?? 0,
    duplicate: duplicates.has(c.id),
  }));

  return (
    <CustomerLedger
      locale={locale}
      rows={rows}
      strings={{
        title: t("customer.title"),
        search: t("customer.search"),
        phone: t("customer.phone"),
        name: t("customer.name"),
        level: t("customer.level"),
        tier: t("customer.tier"),
        credit: t("customer.credit"),
        noShows: t("customer.noShows"),
        spend: t("customer.spend"),
        blocked: t("customer.blocked"),
        unrated: t("customer.unrated"),
        mergeSuggestion: t("customer.mergeSuggestion"),
        empty: t("customer.noMatch"),
        all: t("common.all"),
        bookings: t("customer.bookings"),
        needsAttention: t("customer.needsAttention"),
        duplicateShort: t("customer.duplicateShort"),
        tiers: {
          guest: t("customer.tiers.guest"),
          member: t("customer.tiers.member"),
          premium: t("customer.tiers.premium"),
        },
      }}
    />
  );
}
