"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import { Drawer, MenuButton } from "@/ui/Drawer";

export interface SiteLink {
  href: string;
  label: string;
}

/**
 * The public nav: links inline on a wide screen, a drawer on a phone.
 *
 * On a phone the four destinations used to wrap into a second ragged row under
 * the wordmark, which pushed the first viewport — the thing the whole landing
 * page is built around — below the fold on the device most players use.
 */
export function SiteNav({
  links,
  locale,
  languageLabel,
  menuLabel,
}: {
  links: SiteLink[];
  locale: string;
  languageLabel: string;
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Longest match wins. Prefix matching alone lit "Book a court" (/play) on
  // /play/matches and /play/account too, so the nav claimed the wrong room on
  // every page but one. Segment boundaries keep /play off /playground; the
  // longest-wins step keeps it off its own siblings while still lighting it for
  // its genuine children, e.g. /play/checkout/<id>.
  const activeHref = links
    .filter(
      (l) => pathname === l.href || pathname.startsWith(`${l.href}/`),
    )
    .reduce<string | null>(
      (best, l) => (best && best.length >= l.href.length ? best : l.href),
      null,
    );

  const isActive = (href: string) => href === activeHref;

  return (
    <>
      {/* Wide: inline. */}
      <nav className="hidden items-center gap-x-0.5 md:flex">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center px-3 font-stadium text-[11px] uppercase tracking-[0.09em] transition-colors",
              isActive(l.href) ? "text-ball" : "text-line/75 hover:text-ball",
            )}
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="/"
          locale={locale === "ar" ? "en" : "ar"}
          className="ms-2 flex min-h-11 items-center border border-line/25 px-3 font-board text-[11px] uppercase tracking-[0.18em] text-amber transition-colors hover:border-amber hover:text-ball"
        >
          {languageLabel}
        </Link>
      </nav>

      {/* Narrow: one button. */}
      <MenuButton onClick={() => setOpen(true)} label={menuLabel} />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={menuLabel}
        side="end"
      >
        <nav className="py-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "flex min-h-13 items-center border-s-2 px-4 py-3.5 font-stadium text-[14px] uppercase tracking-[0.07em] transition-colors",
                isActive(l.href)
                  ? "border-s-ball bg-line/8 text-line"
                  : "border-s-transparent text-line/75 active:bg-line/10",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-line/20 p-4">
          <Link
            href="/"
            locale={locale === "ar" ? "en" : "ar"}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center justify-center border border-line/25 font-board text-[11px] uppercase tracking-[0.18em] text-amber active:bg-line/10"
          >
            {languageLabel}
          </Link>
        </div>
      </Drawer>
    </>
  );
}
