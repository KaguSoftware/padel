"use client";

import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/ui/cn";

/**
 * The section rail, set as the board's own tab strip: a lit label for where you
 * are, unlit for where you could go. The active item is marked by a solid
 * optic-yellow edge as well as by weight, so it does not rely on colour alone.
 */
export function FinanceNav({
  items,
  title,
}: {
  items: { href: string; label: string }[];
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
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
