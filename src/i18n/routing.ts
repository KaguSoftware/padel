import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

/**
 * Arabic is a direction, not a translation layer. `ar` is listed first because
 * it is the club's primary language; `en` is the default only because the
 * prototype is reviewed in English.
 */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

export function dirOf(locale: string): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
