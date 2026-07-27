"use client";

import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import { LockMark } from "@/ui/marks";

export interface FinanceItem {
  href: string;
  label: string;
  /** False when this role may not open it. */
  allowed: boolean;
  /** Who can, e.g. "Manager · Owner". Shown on the locked item. */
  needs: string;
}

/**
 * The section rail.
 *
 * ⚠️ Every module is ALWAYS listed, including the ones this role cannot open.
 * An earlier version filtered them out, and a front-desk session then showed a
 * lone "Cash Book" — which reads as a half-built product rather than as a
 * permission. A locked entry that names who can open it teaches the rule; a
 * missing entry teaches nothing and looks broken.
 *
 * The active item is marked by a solid optic-yellow edge as well as by weight,
 * and locked items by a padlock as well as by dimming — never colour alone.
 */
export function FinanceNav({
  items,
  title,
}: {
  items: FinanceItem[];
  title: string;
}) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-30 border-b border-line/20 bg-board">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-3 sm:px-5">
        <span className="font-board text-[10px] uppercase tracking-[0.28em] text-amber">
          {title}
        </span>
      </div>

      <nav className="scroll-x flex gap-1 px-4 pb-0 pt-2 sm:px-5">
        {items.map((item) => {
          // usePathname() from next-intl is already locale-stripped.
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (!item.allowed) {
            return (
              <span
                key={item.href}
                title={`${item.label} — ${item.needs}`}
                aria-disabled="true"
                className="flex min-h-11 cursor-not-allowed items-center gap-1.5 whitespace-nowrap border-b-2 border-b-transparent px-4 font-stadium text-[11px] uppercase tracking-[0.08em] text-line-dim/55"
              >
                <LockMark size={13} className="shrink-0" />
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center whitespace-nowrap border-b-2 px-4 font-stadium text-[11px] uppercase tracking-[0.08em] transition-colors",
                active
                  ? "border-b-ball text-line"
                  : "border-b-transparent text-line-dim hover:border-b-line/30 hover:text-line",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
