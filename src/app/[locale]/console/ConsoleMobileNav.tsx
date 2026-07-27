"use client";

import { useState } from "react";
import type { Role } from "@/data/types";
import type { Claims } from "@/auth/claims";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import { Drawer, MenuButton } from "@/ui/Drawer";
import {
  BracketMark,
  CardMark,
  CourtMark,
  CourtsMark,
  DrawerMark,
  LedgerMark,
  RacketMark,
  ShelfMark,
  StaffMark,
} from "@/ui/marks";
import { RoleSwitcher } from "./RoleSwitcher";

/**
 * The console's mobile navigation: a top bar with the club mark, the current
 * module's name, and a menu.
 *
 * The marks are declared here rather than passed in, because a server component
 * cannot hand component references to a client one. Labels come across as plain
 * strings, which keeps the translations on the server where they belong.
 */
const NAV = [
  { href: "/console/calendar", key: "calendar", Mark: LedgerMark },
  { href: "/console/customers", key: "customers", Mark: CardMark },
  { href: "/console/finances", key: "finances", Mark: DrawerMark },
  { href: "/console/courts", key: "courts", Mark: CourtsMark },
  { href: "/console/academy", key: "coaching", Mark: RacketMark },
  { href: "/console/shop", key: "shop", Mark: ShelfMark },
  { href: "/console/tournaments", key: "tournaments", Mark: BracketMark },
  { href: "/console/staff", key: "staff", Mark: StaffMark },
] as const;

export function ConsoleMobileNav({
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

  const current =
    NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`)) ??
    NAV[0];

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line/20 bg-board px-4 py-2.5 md:hidden">
        <Link href="/console/calendar" className="flex items-center gap-2.5">
          <CourtMark size={24} className="shrink-0 text-ball" />
          <span className="min-w-0">
            <span className="painted block text-[15px] leading-none">
              {labels[current.key]}
            </span>
            <span className="block font-board text-[9px] uppercase leading-none tracking-[0.28em] text-amber">
              Kagu Padel
            </span>
          </span>
        </Link>

        <MenuButton onClick={() => setOpen(true)} label={menuLabel} />
      </header>

      <Drawer open={open} onClose={() => setOpen(false)} title={menuLabel}>
        <nav className="py-2">
          {NAV.map(({ href, key, Mark }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-13 items-center gap-3.5 border-s-2 px-4 py-3 font-stadium text-[13px] uppercase tracking-[0.07em] transition-colors",
                  active
                    ? "border-s-ball bg-line/8 text-line"
                    : "border-s-transparent text-line/75 active:bg-line/10",
                )}
              >
                <Mark
                  size={19}
                  className={cn(
                    "shrink-0",
                    active ? "text-ball" : "text-line-dim",
                  )}
                />
                <span className="truncate">{labels[key]}</span>
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
            href="/console/calendar"
            locale={locale === "ar" ? "en" : "ar"}
            onClick={() => setOpen(false)}
            className="mt-4 flex min-h-11 items-center justify-center border border-line/25 font-board text-[11px] uppercase tracking-[0.18em] text-amber active:bg-line/10"
          >
            {languageLabel}
          </Link>
        </div>
      </Drawer>
    </>
  );
}
