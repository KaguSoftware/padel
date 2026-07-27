import { type VercelConfig } from "@vercel/config/v1";

/**
 * ⚠️ NO `regions` SETTING HERE, DELIBERATELY.
 *
 * Pinning compute beside the database was the single biggest win (~30%) on one
 * sibling project and would have made another one measurably SLOWER, because
 * its Supabase project was already fronted through Cloudflare in the same city.
 * Measure this project's `CF-RAY` and connect time before pinning anything, and
 * if it is ever pinned, change it in the SAME COMMIT as any database region
 * change or compute ends up stranded a continent away.
 */
export const config: VercelConfig = {
  framework: "nextjs",

  crons: [
    // Holds carry a 7–10 minute TTL. Sweeping every five minutes means a
    // stranded hold blocks a court for at most a quarter of an hour.
    { path: "/api/cron/expire-holds", schedule: "*/5 * * * *" },

    // Roll the recurring-series window forward once a night, at 03:00 Dubai
    // (23:00 UTC) — after the operating day has ended at 02:00 and before the
    // next one opens at 06:00, so it never runs against a live page.
    { path: "/api/cron/materialise-series", schedule: "0 23 * * *" },
  ],
};

export default config;
