import { Link } from "@/i18n/routing";
import type { Role } from "@/data/types";
import { CourtLines } from "./court";
import { PageShell } from "./PageShell";

/**
 * "Not permitted", said calmly.
 *
 * A front-desk member of staff opening the ledgers or the audit log is not an
 * error condition — it is someone navigating. The screen names the capability
 * they lack and who does have it, because the next thing they will do is ask a
 * colleague, and a page that says only "forbidden" makes them ask twice.
 */
export function Denied({
  title,
  needs,
  have,
  roleLabels,
}: {
  title: string;
  needs: Role[];
  have: Role | null;
  roleLabels: Record<Role, string>;
}) {
  return (
    <PageShell title={title}>
      <div className="board-panel relative mx-auto max-w-xl overflow-hidden p-8">
        <CourtLines className="pointer-events-none absolute inset-x-6 bottom-5 h-14 w-auto text-line/12" />

        <p className="painted relative text-[clamp(1.5rem,4vw,2.25rem)]">
          Not your board
        </p>

        <dl className="relative mt-6 space-y-3 border-t border-line/20 pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-board text-[10px] uppercase tracking-[0.22em] text-line-dim">
              Needs
            </dt>
            <dd className="font-stadium text-[13px] uppercase tracking-[0.06em] text-ball">
              {needs.map((r) => roleLabels[r]).join(" · ")}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-board text-[10px] uppercase tracking-[0.22em] text-line-dim">
              You are
            </dt>
            <dd className="font-stadium text-[13px] uppercase tracking-[0.06em] text-line">
              {have ? roleLabels[have] : "—"}
            </dd>
          </div>
        </dl>

        <Link
          href="/console/calendar"
          className="relative mt-7 inline-flex min-h-12 items-center border border-line/35 px-5 font-stadium text-[12px] uppercase tracking-[0.09em] text-line transition-colors hover:border-line hover:bg-line/10"
        >
          Back to the day book
        </Link>
      </div>
    </PageShell>
  );
}
