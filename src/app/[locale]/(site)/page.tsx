import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/data";
import { rowsOrThrow } from "@/data/query";
import { resolveAvailability } from "@/domain/availability";
import { computeDayGrid, utilisation } from "@/domain/slots";
import { formatMoney } from "@/lib/money";
import { todayInDubai } from "@/lib/time";
import { Link } from "@/i18n/routing";
import { Guilloche } from "@/ui/Guilloche";
import { CourtMark } from "@/ui/marks";

export const dynamic = "force-dynamic";

/**
 * The landing page is Persuade, but the argument is not a claim â€” it is the
 * book itself. The first viewport shows tonight's actual page: which courts are
 * free, at what price, with how many seats open on the listed matches. A
 * visitor who leaves after one screen has seen the mechanism work.
 */
export default async function Landing({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const day = todayInDubai();

  const [courts, bookings, templates, exceptions, rules, matches, t] =
    await Promise.all([
      rowsOrThrow("site.courts", db.courts.list()),
      rowsOrThrow("site.bookings", db.bookings.listForDay(day)),
      rowsOrThrow("site.templates", db.availability.templates()),
      rowsOrThrow("site.exceptions", db.availability.exceptionsForRange(day, day)),
      rowsOrThrow("site.rules", db.pricing.rules()),
      rowsOrThrow("site.matches", db.bookings.listOpenMatches(day, day)),
      getTranslations(),
    ]);

  const availability = resolveAvailability(day, courts, templates, exceptions);
  const grid = computeDayGrid({ day, courts, availability, bookings });
  const busy = Math.round(utilisation(grid) * 100);

  const ar = locale === "ar";
  const peakRule = rules.find((r) => r.id === "px-peak-90");
  const offPeakRule = rules.find((r) => r.id === "px-base-90");

  // Which courts still have a free evening slot tonight â€” a real fact, read
  // from the same grid the front desk is looking at.
  const freeTonight = courts.filter((c) =>
    [720, 810, 900, 990].some(
      (m) => grid.cells.get(`${c.id}:${m}`)?.state === "open",
    ),
  );

  return (
    <main className="court-world court-surface">
      {/* First viewport: the page itself, at the scale it has in life. */}
      <section className="relative overflow-hidden border-b-2 border-line/25">
        <Guilloche
          className="pointer-events-none absolute -end-24 -top-24 size-[28rem] text-amber/20"
          petals={11}
          ratio={0.58}
        />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
          <p className="font-board text-[11px] uppercase tracking-[0.24em] text-amber">
            {ar ? "Ø¯ÙØªØ± Ø§Ù„ÙŠÙˆÙ…" : "The day book"} Â· {day}
          </p>

          <h1 className="mt-4 max-w-3xl painted text-[clamp(2.5rem,7vw,5rem)] leading-[0.95] tracking-tight text-line">
            {t("site.hero")}
          </h1>

          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-line-dim">
            {t("site.heroBody")}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/play"
              className="ink-button inline-flex min-h-12 items-center border-ball live-block px-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-court-deep"
            >
              {t("site.bookNow")}
            </Link>
            <Link
              href="/play/matches"
              className="ink-button inline-flex min-h-12 items-center border-line/40 bg-transparent px-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-line"
            >
              {t("site.seeMatches")}
              {matches.length > 0 && (
                <span className="ms-2 font-board text-amber">
                  {matches.length}
                </span>
              )}
            </Link>
          </div>

          {/* Live readings, not claims. */}
          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-6 border-t-2 border-line/25 pt-6 sm:grid-cols-4">
            <Reading
              label={ar ? "Ø§Ù„Ù…Ù„Ø§Ø¹Ø¨" : "Courts"}
              value={String(courts.length)}
              sub={ar ? "Ø¯Ø§Ø®Ù„ÙŠ ÙˆØ®Ø§Ø±Ø¬ÙŠ" : "indoor & outdoor"}
            />
            <Reading
              label={ar ? "Ù…Ø´ØºÙˆÙ„ Ø§Ù„ÙŠÙˆÙ…" : "Booked today"}
              value={`${busy}%`}
              sub={ar ? "Ù…Ù† Ø§Ù„Ø³Ø§Ø¹Ø§Øª Ø§Ù„Ù…ØªØ§Ø­Ø©" : "of open hours"}
            />
            <Reading
              label={ar ? "Ù…ØªØ§Ø­ Ø§Ù„Ù„ÙŠÙ„Ø©" : "Free tonight"}
              value={String(freeTonight.length)}
              sub={ar ? "Ù…Ù„Ø§Ø¹Ø¨" : "courts"}
            />
            <Reading
              label={ar ? "Ù…Ø¨Ø§Ø±ÙŠØ§Øª Ù…ÙØªÙˆØ­Ø©" : "Open matches"}
              value={String(matches.length)}
              sub={ar ? "ØªÙ†ØªØ¸Ø± Ù„Ø§Ø¹Ø¨ÙŠÙ†" : "need players"}
            />
          </dl>
        </div>
      </section>

      {/* Courts â€” the club's own geometry, drawn. */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h2 className="painted text-[28px] leading-none text-line">
          {t("site.courtsTitle")}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {courts.map((c) => {
            const free = [720, 810, 900, 990].filter(
              (m) => grid.cells.get(`${c.id}:${m}`)?.state === "open",
            ).length;
            return (
              <article key={c.id} className="slip bg-transparent p-4">
                <CourtMark size={34} className="text-line-dim" />
                <h3 className="mt-3 painted text-[21px] leading-none">
                  {ar ? c.nameAr : c.name}
                </h3>
                <p className="mt-1 font-board text-[11px] uppercase tracking-[0.1em] text-line-dim">
                  {t(`courts.enclosures.${c.enclosure}` as "courts.enclosures.indoor")}
                  {" Â· "}
                  {t(`courts.surfaces.${c.surface}` as "courts.surfaces.glass")}
                </p>
                <p className="mt-3 border-t border-line/15 pt-2 font-board text-[11px] text-line">
                  {free > 0
                    ? `${free} ${ar ? "ÙØªØ±Ø§Øª Ù…Ø³Ø§Ø¦ÙŠØ© Ù…ØªØ§Ø­Ø©" : "evening slots open"}`
                    : ar
                      ? "Ø§Ù„Ù…Ø³Ø§Ø¡ Ù…ÙƒØªÙ…Ù„"
                      : "evening full"}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Rates and policy, read straight from the config the club edits. */}
      <section className="border-t border-line/15 bg-court/40">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 md:grid-cols-2">
          <div>
            <h2 className="painted text-[28px] leading-none text-line">
              {t("site.ratesTitle")}
            </h2>
            <dl className="mt-5 space-y-2">
              <RateLine
                label={ar ? "Ø®Ø§Ø±Ø¬ Ø§Ù„Ø°Ø±ÙˆØ© Â· Ù©Ù  Ø¯Ù‚ÙŠÙ‚Ø©" : "Off-peak Â· 90 min"}
                value={
                  offPeakRule
                    ? formatMoney(offPeakRule.amount, locale)
                    : "â€”"
                }
              />
              <RateLine
                label={ar ? "Ø°Ø±ÙˆØ© Ø§Ù„Ù…Ø³Ø§Ø¡ Â· Ù©Ù  Ø¯Ù‚ÙŠÙ‚Ø©" : "Evening peak Â· 90 min"}
                value={peakRule ? formatMoney(peakRule.amount, locale) : "â€”"}
              />
              <RateLine
                label={ar ? "Ø£Ø¹Ø¶Ø§Ø¡ Â· Ø°Ø±ÙˆØ© Ø§Ù„Ù…Ø³Ø§Ø¡" : "Members Â· evening peak"}
                value={
                  formatMoney(
                    rules.find((r) => r.id === "px-member-peak-90")?.amount ??
                      (0 as never),
                    locale,
                  )
                }
              />
            </dl>
            <p className="mt-4 font-board text-[11px] leading-relaxed text-line-dim">
              {ar
                ? "Ø§Ù„Ø£Ø³Ø¹Ø§Ø± Ù…ÙˆØ¶Ø­Ø© Ù„ÙƒÙ„ Ù…Ù„Ø¹Ø¨. ØªÙÙ‚Ø³Ù… Ø¨ÙŠÙ† Ø£Ø±Ø¨Ø¹Ø© Ù„Ø§Ø¹Ø¨ÙŠÙ†."
                : "Prices are per court. Split four ways, that is roughly a coffee each."}
            </p>
          </div>

          <div>
            <h2 className="painted text-[28px] leading-none text-line">
              {t("site.hoursTitle")}
            </h2>
            <dl className="mt-5 space-y-2">
              <RateLine
                label={ar ? "Ø§Ù„Ø£Ø­Ø¯ â€“ Ø§Ù„Ø®Ù…ÙŠØ³" : "Sunday â€“ Thursday"}
                value="06:00 â€“ 00:00"
              />
              <RateLine
                label={ar ? "Ø§Ù„Ø¬Ù…Ø¹Ø© â€“ Ø§Ù„Ø³Ø¨Øª" : "Friday â€“ Saturday"}
                value="06:00 â€“ 02:00"
              />
              <RateLine
                label={ar ? "Ø§Ù„Ù…Ù„Ø¹Ø¨ Ø§Ù„Ø®Ø§Ø±Ø¬ÙŠ" : "Outdoor court"}
                value="06:00 â€“ 22:00"
              />
            </dl>
            <p className="mt-4 font-board text-[11px] leading-relaxed text-line-dim">
              {ar
                ? "ØªØªØºÙŠÙ‘Ø± Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø±Ù…Ø¶Ø§Ù† ÙƒÙ„ Ø¹Ø§Ù… ÙˆØªÙÙ†Ø´Ø± Ù‡Ù†Ø§."
                : "Ramadan hours change each year and are published here."}
            </p>
          </div>
        </div>
      </section>

      <section className="border-t-2 border-line/25 px-4 py-10">
        <p className="mx-auto max-w-3xl text-center font-board text-[11px] leading-relaxed text-line-dim">
          {t("site.syntheticNotice")}
        </p>
      </section>
    </main>
  );
}

function Reading({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <dt className="font-board text-[10px] uppercase tracking-[0.14em] text-line-dim">
        {label}
      </dt>
      <dd className="mt-1 painted text-[40px] leading-none tabular-nums text-line">
        {value}
      </dd>
      <dd className="font-board text-[10px] uppercase tracking-[0.1em] text-line-dim">
        {sub}
      </dd>
    </div>
  );
}

function RateLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/15 pb-1.5">
      <dt className="text-[14px] text-line">{label}</dt>
      <dd className="font-board text-[14px] tabular-nums text-line">{value}</dd>
    </div>
  );
}
