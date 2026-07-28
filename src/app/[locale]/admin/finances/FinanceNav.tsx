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
 * The active item is marked by a solid line-paint edge as well as by weight,
 * and locked items by a padlock as well as by dimming — never colour alone.
 * The edge is line paint and not optic yellow: yellow is reserved for
 * available-or-live, and a tab you are standing on is neither.
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
    <div
      className="sticky top-0 border-b border-line/20 bg-board"
      style={{ zIndex: "var(--z-section)" }}
    >
      <div className="mx-auto flex w-full max-w-[var(--desk-max)] flex-wrap items-center gap-x-6 gap-y-2 px-5 pt-4 sm:px-8">
        <span className="board-label text-amber">{title}</span>
      </div>

      <nav className="scroll-x mx-auto flex w-full max-w-[var(--desk-max)] gap-1 px-5 pb-0 pt-2.5 sm:px-8">
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
                className="flex min-h-12 cursor-not-allowed items-center gap-2 whitespace-nowrap border-b-2 border-b-transparent px-4 font-stadium text-[12px] uppercase tracking-[0.05em] text-line-dim/55"
              >
                <LockMark size={14} className="shrink-0" />
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
                "flex min-h-12 items-center whitespace-nowrap border-b-2 px-4 font-stadium text-[12px] uppercase tracking-[0.05em] transition-colors",
                active
                  ? "border-b-line text-line"
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
