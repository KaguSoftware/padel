"use client";

import { useState } from "react";
import type { Role } from "@/data/types";
import type { Claims } from "@/auth/claims";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import { Drawer, MenuButton } from "@/ui/Drawer";
import { CourtMark, Mark } from "@/ui/marks";
import { NAV, currentEntry, isCurrent } from "./nav";
import { RoleSwitcher } from "./RoleSwitcher";

/**
 * The console's mobile navigation: a top bar with the club mark, the current
 * module's name, and a menu.
 *
 * The destinations come from `nav.ts`, which both this and the desk rail read —
 * the list used to be duplicated here byte for byte because a server component
 * cannot pass component references across the boundary. It passes a mark *name*
 * now, and the registry does the rest.
 */
export function AdminMobileNav({
  locale,
  labels,
  claims,
  switchRoleLabel,
  signedInAs,
  roleLabels,
  languageLabel,
  menuLabel,
}: {
  locale: string;
  labels: Record<string, string>;
  claims: Claims | null;
  switchRoleLabel: string;
  signedInAs: string;
  roleLabels: Record<Role, string>;
  languageLabel: string;
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = currentEntry(pathname);

  return (
    <>
      <header
        className="sticky top-0 flex items-center justify-between gap-3 border-b border-line/20 bg-board px-4 py-3 md:hidden"
        style={{ zIndex: "var(--z-topbar)" }}
      >
        <Link href="/admin/calendar" className="flex min-w-0 items-center gap-3">
          <CourtMark size={26} className="shrink-0 text-ball" />
          <span className="min-w-0">
            <span className="painted block truncate text-[17px] leading-none">
              {labels[current.key]}
            </span>
            <span className="mt-1 block font-board text-[10px] uppercase leading-none tracking-[0.24em] text-amber">
              Kagu Padel
            </span>
          </span>
        </Link>

        <MenuButton onClick={() => setOpen(true)} label={menuLabel} />
      </header>

      <Drawer open={open} onClose={() => setOpen(false)} title={menuLabel}>
        <nav className="py-2">
          {NAV.map((n) => {
            const active = isCurrent(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 items-center gap-3.5 border-s-2 px-5 py-3 font-stadium text-[13px] uppercase tracking-[0.05em] transition-colors",
                  active
                    ? "border-s-line bg-line/12 text-line"
                    : "border-s-transparent text-line/75 active:bg-line/10",
                )}
              >
                <Mark
                  name={n.mark}
                  size={19}
                  className={cn("shrink-0", active ? "text-line" : "text-line-dim")}
                />
                <span className="truncate">{labels[n.key]}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-2 border-t border-line/20 p-4">
          <RoleSwitcher
            current={claims}
            label={switchRoleLabel}
            signedInAs={signedInAs}
            roleLabels={roleLabels}
          />
          <Link
            href="/admin/calendar"
            locale={locale === "ar" ? "en" : "ar"}
            onClick={() => setOpen(false)}
            className="board-label mt-4 flex min-h-12 items-center justify-center border border-line/25 text-amber active:bg-line/10"
          >
            {languageLabel}
          </Link>
        </div>
      </Drawer>
    </>
  );
}
