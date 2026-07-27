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
};

export default withNextIntl(nextConfig);
