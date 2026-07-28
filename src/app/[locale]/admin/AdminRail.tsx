"use client";

import type { Role } from "@/data/types";
import type { Claims } from "@/auth/claims";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import { CourtMark, Mark } from "@/ui/marks";
import { NAV_PRIMARY, NAV_REST, isCurrent, type NavEntry } from "./nav";
import { RoleSwitcher } from "./RoleSwitcher";

/**
 * The desk rail.
 *
 * It is a client component for one reason: it needs the pathname to say where
 * you are. The rail previously had a hover state and no current state, so on a
 * screen you look at for eight hours there was nothing telling you which of
 * eight modules you were in — you read the page heading and inferred it.
 */
export function AdminRail({
  locale,
  labels,
  claims,
  switchRoleLabel,
  signedInAs,
  roleLabels,
  languageLabel,
}: {
  locale: string;
  labels: Record<string, string>;
  claims: Claims | null;
  switchRoleLabel: string;
  signedInAs: string;
  roleLabels: Record<Role, string>;
  languageLabel: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-line/20 bg-board md:flex">
      <Link
        href="/admin/calendar"
        className="flex items-center gap-3 border-b border-line/20 px-5 py-5 text-line"
      >
        <CourtMark size={30} className="shrink-0 text-ball" />
        <span className="min-w-0">
          <span className="painted block text-[19px] leading-none">Kagu</span>
          <span className="mt-1 block font-board text-[11px] uppercase leading-none tracking-[0.3em] text-amber">
            Padel
          </span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_PRIMARY.map((n) => (
          <RailLink key={n.href} entry={n} label={labels[n.key]} pathname={pathname} />
        ))}

        <hr className="mx-5 my-3 border-0 border-t border-line/15" />

        {NAV_REST.map((n) => (
          <RailLink key={n.href} entry={n} label={labels[n.key]} pathname={pathname} />
        ))}
      </nav>

      <div className="border-t border-line/20 p-4">
        <RoleSwitcher
          current={claims}
          label={switchRoleLabel}
          signedInAs={signedInAs}
          roleLabels={roleLabels}
        />
        <Link
          href="/admin/calendar"
          locale={locale === "ar" ? "en" : "ar"}
          className="board-label mt-3 flex min-h-11 items-center justify-center border border-line/25 text-amber transition-colors hover:border-line/45 hover:text-ball"
        >
          {languageLabel}
        </Link>
      </div>
    </aside>
  );
}

function RailLink({
  entry,
  label,
  pathname,
}: {
  entry: NavEntry;
  label: string;
  pathname: string;
}) {
  const active = isCurrent(pathname, entry.href);

  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex min-h-12 items-center gap-3.5 border-s-2 px-5 py-2.5",
        "font-stadium text-[12px] uppercase tracking-[0.05em] transition-colors duration-100",
        active
          ? // Line paint, not optic yellow: "you are here" is not "this is free".
            "border-s-line bg-line/12 text-line"
          : "border-s-transparent text-line/70 hover:bg-line/8 hover:text-line",
      )}
    >
      <Mark
        name={entry.mark}
        size={18}
        className={cn(
          "shrink-0 transition-colors",
          active ? "text-line" : "text-line-dim group-hover:text-line",
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
