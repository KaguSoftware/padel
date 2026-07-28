import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // Next defaults `dynamic` to 0, so even pressing Back re-runs the server
    // component. See PERFORMANCE.md — verify this survives into
    // .next/required-server-files.json rather than assuming it was honoured.
    staleTimes: { dynamic: 30, static: 180 },
  },

  async redirects() {
    // The money modules moved under /admin/finances. Anyone with a bookmark,
    // an open tab, or a link in a WhatsApp thread should land on the page, not
    // on a 404.
    const moved = [
      ["till", "finances/till"],
      ["reports", "finances/ledgers"],
      ["pricing", "finances/rates"],
      ["audit", "finances/audit"],
    ];

    return [
      ...moved.map(([from, to]) => ({
        source: `/:locale/admin/${from}`,
        destination: `/:locale/admin/${to}`,
        // Not permanent: a browser that caches a 308 keeps redirecting long
        // after the route could legitimately come back, and this product has
        // not shipped to anyone yet.
        permanent: false,
      })),

      // The whole staff surface moved from /console to /admin. Front-desk
      // tablets sit on one pinned tab for weeks, so the old path has to keep
      // working — and it has to carry the deep path with it, or everyone lands
      // on the day book regardless of where they were.
      {
        source: "/:locale/console/:path*",
        destination: "/:locale/admin/:path*",
        permanent: false,
      },
      {
        source: "/:locale/console",
        destination: "/:locale/admin",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
