import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/auth/guard";
import { loadShopPage } from "@/data/loaders";
import { clock } from "@/lib/time";
import { Counter, type ProductRow, type TabOption } from "./Counter";

export const dynamic = "force-dynamic";

export default async function ShopPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();

  const [data, t] = await Promise.all([loadShopPage(), getTranslations()]);
  const ar = locale === "ar";

  const customerName = new Map(
    data.customers.map((c) => [c.id, ar ? (c.nameAr ?? c.name) : c.name]),
  );

  const products: ProductRow[] = data.products
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: ar ? p.nameAr : p.name,
      category: p.category,
      price: p.price,
      stock: p.stock,
      low:
        p.stock !== null && p.lowStockAt !== null && p.stock <= p.lowStockAt,
    }));

  // Open court tabs a sale can be attached to — the drinks a group orders
  // mid-match belong on their booking, not on a separate anonymous receipt.
  const tabs: TabOption[] = data.bookings
    .filter((b) => b.status === "confirmed" || b.status === "held")
    .map((b) => ({
      id: b.id,
      label: `#${b.serial} · ${clock(b.start)} · ${
        b.customerId ? (customerName.get(b.customerId) ?? "—") : "—"
      }`,
      customerId: b.customerId,
    }));

  return (
    <Counter
      locale={locale}
      products={products}
      tabs={tabs}
      todaysSales={data.todaysSales.map((s) => ({
        id: s.id,
        serial: s.serial,
        total: s.total,
        lines: s.lines.length,
        soldAt: s.soldAt.toISOString(),
      }))}
      strings={{
        title: t("shop.title"),
        product: t("shop.product"),
        sku: t("shop.sku"),
        price: t("shop.price"),
        stock: t("shop.stock"),
        lowStock: t("shop.lowStock"),
        notTracked: t("shop.notTracked"),
        sell: t("shop.sell"),
        toTab: t("shop.toTab"),
        standalone: t("shop.standalone"),
        cart: t("shop.cart"),
        total: t("booking.total"),
        empty: t("common.empty"),
        search: t("common.search"),
        clear: t("common.clear"),
        all: t("common.all"),
      }}
    />
  );
}
