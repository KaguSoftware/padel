"use client";

import { useMemo, useState, useTransition } from "react";
import { recordSale } from "@/app/actions/money";
import type { ProductCategory } from "@/data/types";
import { addFils, formatMoney, type Fils, ZERO } from "@/lib/money";
import { foldedIncludes } from "@/lib/text";
import { cn } from "@/ui/cn";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import {
  EmptyLine,
  InkButton,
  Panel,
  Reading,
  RuledInput,
  RuledSelect,
} from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  price: Fils;
  stock: number | null;
  low: boolean;
}

export interface TabOption {
  id: string;
  label: string;
  customerId: string | null;
}

export function Counter({
  locale,
  products,
  tabs,
  todaysSales,
  strings,
}: {
  locale: string;
  products: ProductRow[];
  tabs: TabOption[];
  todaysSales: { id: string; serial: number; total: Fils; lines: number; soldAt: string }[];
  strings: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProductCategory | "">("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tabId, setTabId] = useState("");
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  // Options built from the full list, not the visible rows.
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );

  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          (!category || p.category === category) &&
          (query.trim() === "" ||
            foldedIncludes(p.name, query) ||
            p.sku.toLowerCase().includes(query.toLowerCase())),
      ),
    [products, query, category],
  );

  const lines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const p = products.find((x) => x.id === id)!;
      return { product: p, qty, amount: (p.price * qty) as Fils };
    });

  const total = lines.length
    ? addFils(...lines.map((l) => l.amount))
    : ZERO;

  function add(id: string, delta: number) {
    setCart((c) => {
      const next = Math.max(0, (c[id] ?? 0) + delta);
      return { ...c, [id]: next };
    });
  }

  return (
    <PageShell
      title={strings.title}
      serial={`${todaysSales.length} sales today`}
      note={notice}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <RuledInput
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={strings.search}
              aria-label={strings.search}
            />
            <RuledSelect
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory | "")}
              aria-label="Category"
            >
              <option value="">{strings.all}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </RuledSelect>
          </div>

          <Panel title={strings.product}>
            {visible.length === 0 ? (
              <EmptyLine>{strings.empty}</EmptyLine>
            ) : (
              <LedgerTable
                heads={[strings.sku, strings.product, strings.price, strings.stock, ""]}
              >
                {visible.map((p) => (
                  <LedgerRow key={p.id}>
                    <Cell className="font-board text-[11px] tracking-[0.06em] text-line-dim">
                      {p.sku}
                    </Cell>
                    <Cell className="font-semibold">{p.name}</Cell>
                    <Cell numeric>
                      {formatMoney(p.price, locale, { showCurrency: false })}
                    </Cell>
                    <Cell numeric>
                      {p.stock === null ? (
                        <span className="text-line-dim">—</span>
                      ) : (
                        <span className={cn(p.low && "text-clay")}>{p.stock}</span>
                      )}
                    </Cell>
                    <Cell>
                      <span className="flex items-center justify-end gap-2">
                        {p.low && <Stamp tone="due">{strings.lowStock}</Stamp>}
                        <span className="flex items-center">
                          <button
                            onClick={() => add(p.id, -1)}
                            className="min-h-11 min-w-11 border border-line/30 font-board"
                            aria-label={`Remove ${p.name}`}
                          >
                            −
                          </button>
                          <span className="min-w-9 text-center font-board tabular-nums">
                            {cart[p.id] ?? 0}
                          </span>
                          <button
                            onClick={() => add(p.id, 1)}
                            className="min-h-11 min-w-11 border border-line/40 font-board"
                            aria-label={`Add ${p.name}`}
                          >
                            +
                          </button>
                        </span>
                      </span>
                    </Cell>
                  </LedgerRow>
                ))}
              </LedgerTable>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title={strings.cart}>
            {lines.length === 0 ? (
              <EmptyLine>{strings.empty}</EmptyLine>
            ) : (
              <>
                <ul className="space-y-1">
                  {lines.map((l) => (
                    <li
                      key={l.product.id}
                      className="flex items-baseline justify-between gap-3 border-b border-line/15 py-1.5 text-[13px]"
                    >
                      <span className="truncate">
                        {l.qty} × {l.product.name}
                      </span>
                      <span className="shrink-0 font-board tabular-nums">
                        {formatMoney(l.amount, locale, { showCurrency: false })}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 border-t-2 border-line/25 pt-3">
                  <Reading
                    label={strings.total}
                    value={formatMoney(total, locale)}
                    tone="settle"
                  />
                </div>

                <div className="mt-4">
                  <RuledSelect
                    value={tabId}
                    onChange={(e) => setTabId(e.target.value)}
                    aria-label={strings.toTab}
                  >
                    <option value="">{strings.standalone}</option>
                    {tabs.map((tb) => (
                      <option key={tb.id} value={tb.id}>
                        {tb.label}
                      </option>
                    ))}
                  </RuledSelect>
                </div>

                <InkButton
                  variant="primary"
                  className="mt-4 w-full"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const tab = tabs.find((x) => x.id === tabId) ?? null;
                      const res = await recordSale({
                        bookingId: tab?.id ?? null,
                        customerId: tab?.customerId ?? null,
                        lines: lines.map((l) => ({
                          productId: l.product.id,
                          qty: l.qty,
                          unitPriceFils: l.product.price,
                        })),
                      });
                      setNotice(
                        res.ok ? `Sale #${res.data.serial} recorded.` : res.message,
                      );
                      if (res.ok) {
                        setCart({});
                        setTabId("");
                      }
                    })
                  }
                >
                  {strings.sell}
                </InkButton>

                <InkButton
                  variant="quiet"
                  className="mt-2 w-full"
                  onClick={() => setCart({})}
                >
                  {strings.clear}
                </InkButton>
              </>
            )}
          </Panel>

          {todaysSales.length > 0 && (
            <Panel title="Today">
              <ul className="space-y-1">
                {todaysSales.slice(0, 8).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-baseline justify-between gap-3 border-b border-line/15 py-1.5 font-board text-[11px]"
                  >
                    <span className="text-amber">No. {s.serial}</span>
                    <span className="tabular-nums">
                      {formatMoney(s.total, locale, { showCurrency: false })}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
