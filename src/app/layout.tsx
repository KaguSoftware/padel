/**
 * The real document lives in `[locale]/layout.tsx`, because `lang` and `dir`
 * must be decided by the locale segment and set before first paint. This file
 * exists only because Next requires a root layout.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
