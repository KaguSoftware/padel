import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/data";
import { rowsOrThrow } from "@/data/query";
import { resolveAvailability } from "@/domain/availability";
import { bookableStarts, computeDayGrid } from "@/domain/slots";
import { quote } from "@/domain/pricing";
import { openSeats } from "@/domain/split";
import { formatMoney, type Fils } from "@/lib/money";
import { addDaysToLocalDate, minutesIntoDay, todayInDubai } from "@/lib/time";
import { Link } from "@/i18n/routing";
import { CourtLines, CourtPlate } from "@/ui/court";

export const dynamic = "force-dynamic";

/**
 * FIRST VIEWPORT IS THE THESIS.
 *
 * Not a hero with a claim in it — the order-of-play board itself, showing
 * tonight's real courts, real prices and real open seats, hanging over the
 * floodlit court. A visitor who leaves after one screen has watched the
 * mechanism work rather than read a promise about it.
 *
 * Every figure below is read from the same grid the front desk is looking at.
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

  const participants = await rowsOrThrow(
    "site.participants",
    db.participants.listForBookings(matches.map((m) => m.id)),
  );

  const availability = resolveAvailability(day, courts, templates, exceptions);
  const grid = computeDayGrid({ day, courts, availability, bookings });
  const ar = locale === "ar";

  const nowMinute = minutesIntoDay(new Date(), day);
  const tomorrow = addDaysToLocalDate(day, 1);

  // Today's remaining openings, for the inline reading.
  const openToday = courts.reduce(
    (n, court) =>
      n +
      bookableStarts(grid, court.id, 90).filter((m) => m >= nowMinute).length,
    0,
  );

  // THE TICKET — the club's next genuinely-bookable 90-minute slot. It scans
  // forward day by day so the hero always leads with a real opening rather than
  // an empty state; today is filtered to slots still ahead, later days are
  // whole. Priced by the same engine the counter uses, so a player is never
  // quoted one figure here and charged another.
  async function nextOpening() {
    for (let d = 0; d < 7; d++) {
      const scanDay = d === 0 ? day : addDaysToLocalDate(day, d);
      let dayGrid = grid;
      if (d > 0) {
        const [dayBookings, dayExceptions] = await Promise.all([
          rowsOrThrow(`site.scan.${d}.bookings`, db.bookings.listForDay(scanDay)),
          rowsOrThrow(
            `site.scan.${d}.exceptions`,
            db.availability.exceptionsForRange(scanDay, scanDay),
          ),
        ]);
        dayGrid = computeDayGrid({
          day: scanDay,
          courts,
          availability: resolveAvailability(scanDay, courts, templates, dayExceptions),
          bookings: dayBookings,
        });
      }
      const floor = d === 0 ? nowMinute : Number.NEGATIVE_INFINITY;
      const best = courts
        .flatMap((court) => {
          const startMinute = bookableStarts(dayGrid, court.id, 90).find(
            (m) => m >= floor,
          );
          return startMinute === undefined ? [] : [{ court, startMinute }];
        })
        .sort((a, b) => a.startMinute - b.startMinute)[0];

      if (best) {
        return {
          day: scanDay,
          court: best.court,
          startMinute: best.startMinute,
          price: quote({
            day: scanDay,
            startMinute: best.startMinute,
            durationMinutes: 90,
            court: best.court,
            tier: "guest",
            rules,
          }).total,
        };
      }
    }
    return null;
  }
  const nextUp = await nextOpening();

  const seatsGoing = matches.reduce(
    (n, m) =>
      n +
      openSeats(
        m.partySize,
        participants.filter((p) => p.bookingId === m.id).length,
      ),
    0,
  );

  const peak = rules.find((r) => r.id === "px-peak-90");
  const offPeak = rules.find((r) => r.id === "px-base-90");
  const member = rules.find((r) => r.id === "px-member-peak-90");

  return (
    <main className="court-world">
      {/* ================= THE BOARD, ON THE COURT ================= */}
      <section className="court-surface relative overflow-hidden">
        <HeroCourt />

        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 py-16 lg:min-h-[86vh] lg:grid-cols-[minmax(0,1fr)_27rem] lg:items-center lg:py-24">
          <div>
            <h1 className="painted text-[clamp(3rem,8vw,6rem)]">
              {ar ? (
                <>
                  ملعبك
                  <br />
                  <span className="live">بانتظارك.</span>
                </>
              ) : (
                <>
                  Your court
                  <br />
                  is <span className="live">waiting.</span>
                </>
              )}
            </h1>

            <p className="mt-6 max-w-sm text-[17px] leading-relaxed text-line/90">
              {ar
                ? "نقرة واحدة تحجز الفترة التالية المتاحة لثماني دقائق. توافر حقيقي، سعر حقيقي، مقسوم على أربعة."
                : "One tap holds the next open slot for eight minutes. Real availability, real price, split four ways."}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href="/play"
                className="live-block inline-flex min-h-14 items-center px-8 font-stadium text-[13px] uppercase tracking-[0.1em] transition-[filter,transform] duration-100 hover:brightness-110 active:translate-y-0.5"
              >
                {t("site.bookNow")}
              </Link>

              {/* The two live figures as one calm line, not a wall of giant
                  numbers — informative, still optic-yellow where it's takeable. */}
              <p className="font-board text-[13px] uppercase tracking-[0.08em] text-line/70">
                <span
                  className={
                    openToday > 0 ? "live tabular-nums" : "tabular-nums text-line/50"
                  }
                >
                  {openToday}
                </span>{" "}
                {ar ? "متاح اليوم" : "open today"}
                {seatsGoing > 0 && (
                  <>
                    {" · "}
                    <Link
                      href="/play/matches"
                      className="transition-colors hover:text-ball"
                    >
                      <span className="live tabular-nums">{seatsGoing}</span>{" "}
                      {ar ? "مقاعد شاغرة" : "seats going"}{" "}
                      <span aria-hidden>{ar ? "←" : "→"}</span>
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* THE TICKET — the club's single next-bookable slot as one tactile
              object, not a scannable list. The dashed net-line splits the hero
              the way padel's own centre line splits the court. */}
          <div className="relative lg:border-s-2 lg:border-dashed lg:border-line/30 lg:ps-12">
            {nextUp ? (
              <article className="board-panel relative mx-auto max-w-sm">
                <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
                  <div className="min-w-0">
                    <h2 className="truncate font-stadium text-[16px] uppercase tracking-[0.04em] text-line">
                      {ar ? nextUp.court.nameAr : nextUp.court.name}
                    </h2>
                    <p className="mt-1 font-board text-[11px] uppercase tracking-[0.12em] text-line/65">
                      {t(
                        `courts.enclosures.${nextUp.court.enclosure}` as "courts.enclosures.indoor",
                      )}
                      {" · "}
                      {t(
                        `courts.surfaces.${nextUp.court.surface}` as "courts.surfaces.glass",
                      )}
                    </p>
                  </div>
                  <CourtPlate
                    n={nextUp.court.ordinal}
                    className="shrink-0 text-[3.25rem] leading-none"
                  />
                </header>

                {/* The tear line. */}
                <div className="border-t border-dashed border-line/25" />

                <dl className="space-y-3.5 px-5 py-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-board text-[11px] uppercase tracking-[0.12em] text-line/65">
                      {ar ? "متى" : "When"}
                    </dt>
                    <dd className="font-board text-[15px] tabular-nums text-line">
                      {nextUp.day === day
                        ? ar
                          ? "اليوم"
                          : "Today"
                        : nextUp.day === tomorrow
                          ? ar
                            ? "غداً"
                            : "Tomorrow"
                          : nextUp.day}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-board text-[11px] uppercase tracking-[0.12em] text-line/65">
                      {ar ? "التالي المتاح" : "Next free"}
                    </dt>
                    <dd className="live font-board text-[30px] font-bold leading-none tabular-nums">
                      {clockOf(nextUp.startMinute)}
                      <span className="ms-1 text-[15px] text-line/45">
                        –{clockOf(nextUp.startMinute + 90)}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-board text-[11px] uppercase tracking-[0.12em] text-line/65">
                      {ar ? "٩٠ دقيقة · لكل ملعب" : "90 min · per court"}
                    </dt>
                    <dd className="font-board text-[17px] tabular-nums text-line">
                      {formatMoney(nextUp.price, locale)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-line/15 pt-3">
                    <dt className="font-board text-[11px] uppercase tracking-[0.12em] text-line/65">
                      {ar ? "مقسوم على أربعة" : "Split four ways"}
                    </dt>
                    <dd className="font-board text-[15px] tabular-nums text-line/85">
                      {formatMoney(
                        Math.round(nextUp.price / 4) as Fils,
                        locale,
                      )}{" "}
                      {ar ? "للاعب" : "each"}
                    </dd>
                  </div>
                </dl>

                <Link
                  href={`/play?d=${nextUp.day}&mins=90`}
                  className="live-block flex min-h-14 items-center justify-center gap-2 font-stadium text-[13px] uppercase tracking-[0.1em] transition-[filter] duration-100 hover:brightness-110"
                >
                  {ar ? "احجز هذه الفترة" : "Hold this slot"}
                  <span aria-hidden>{ar ? "←" : "→"}</span>
                </Link>
              </article>
            ) : (
              <article className="board-panel mx-auto max-w-sm px-6 py-9 text-center">
                <p className="font-stadium text-[15px] uppercase tracking-[0.04em] text-line">
                  {ar ? "مكتمل اليوم" : "Full today"}
                </p>
                <p className="mx-auto mt-2 max-w-[26ch] font-board text-[12px] leading-relaxed text-line/65">
                  {ar
                    ? "جرّب يوماً آخر، أو خذ مقعداً في مباراة مفتوحة."
                    : "Try another day, or take a seat in an open match."}
                </p>
                <Link
                  href="/play"
                  className="mt-5 inline-flex min-h-12 items-center border border-line/35 px-6 font-stadium text-[12px] uppercase tracking-[0.09em] text-line transition-colors hover:border-line hover:bg-line/10"
                >
                  {ar ? "ابحث عن ملعب" : "Find a court"}
                </Link>
              </article>
            )}
          </div>
        </div>
      </section>

      {/* ================= COURTS ================= */}
      <section className="border-t border-line/15 bg-court-deep">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:py-20">
          <h2 className="painted paint-in text-[clamp(1.8rem,4vw,2.75rem)]">
            {t("site.courtsTitle")}
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-line/75">
            {ar
              ? "خمسة ملاعب، لكلٍّ طابعه — من ملعب العروض البانورامي إلى ملعب الغروب في الهواء الطلق."
              : "Five courts, each with its own character — from the panoramic show court to the open-air one you play under floodlights."}
          </p>

          <div className="flap-stage mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {courts.map((c) => {
              const free = bookableStarts(grid, c.id, 90).filter(
                (m) => m >= nowMinute,
              ).length;
              const ch = courtCharacter(c, ar);
              const premium = c.tags.includes("premium");
              return (
                <article
                  key={c.id}
                  className={`glass-pane flap-scroll relative flex min-h-60 flex-col overflow-hidden p-5 ${
                    premium ? "ring-1 ring-line/30" : ""
                  }`}
                >
                  <CourtPlate
                    n={c.ordinal}
                    className="pointer-events-none absolute -end-2 -top-5 text-[6.5rem]"
                  />

                  <div className="relative flex-1">
                    {ch.chip && (
                      <span className="inline-flex items-center border border-line/35 px-2 py-0.5 font-board text-[9px] uppercase tracking-[0.16em] text-line/85">
                        {ch.chip}
                      </span>
                    )}
                    <h3 className="painted mt-2.5 text-[21px] leading-none text-line">
                      {ch.title}
                    </h3>
                    <p className="mt-2 font-board text-[10px] uppercase tracking-[0.13em] text-line/55">
                      {ar ? c.nameAr : c.name}
                      {" · "}
                      {t(
                        `courts.enclosures.${c.enclosure}` as "courts.enclosures.indoor",
                      )}
                    </p>
                    <p className="mt-3 text-[13px] leading-relaxed text-line/75">
                      {ch.blurb}
                    </p>
                  </div>

                  <p className="relative mt-4 font-board text-[11px] uppercase tracking-[0.12em]">
                    {free > 0 ? (
                      <span className="live">
                        {free} {ar ? "متاح اليوم" : "open today"}
                      </span>
                    ) : (
                      <span className="text-line/50">
                        {ar ? "مكتمل اليوم" : "full today"}
                      </span>
                    )}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= RATES & HOURS ================= */}
      <section className="court-surface relative overflow-hidden border-t border-line/15">
        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-5 py-16 md:grid-cols-2">
          <div>
            <h2 className="painted paint-in text-[clamp(1.8rem,4vw,2.75rem)]">
              {t("site.ratesTitle")}
            </h2>
            <dl className="mt-7">
              <Rate
                label={ar ? "خارج الذروة · ٩٠ دقيقة" : "Off-peak · 90 min"}
                value={offPeak ? formatMoney(offPeak.amount, locale) : "—"}
              />
              <Rate
                label={ar ? "ذروة المساء · ٩٠ دقيقة" : "Evening peak · 90 min"}
                value={peak ? formatMoney(peak.amount, locale) : "—"}
                loud
              />
              <Rate
                label={ar ? "أعضاء · ذروة المساء" : "Members · evening peak"}
                value={member ? formatMoney(member.amount, locale) : "—"}
              />
            </dl>
            <p className="mt-5 max-w-sm font-board text-[11px] leading-relaxed text-line-dim">
              {ar
                ? "السعر لكل ملعب. مقسوماً على أربعة، هذا ثمن قهوة للاعب."
                : "Per court, not per player. Split four ways that is about the price of a coffee each."}
            </p>
          </div>

          <div>
            <h2 className="painted paint-in text-[clamp(1.8rem,4vw,2.75rem)]">
              {t("site.hoursTitle")}
            </h2>
            <dl className="mt-7">
              <Rate
                label={ar ? "الأحد – الخميس" : "Sunday – Thursday"}
                value="06:00 – 00:00"
              />
              <Rate
                label={ar ? "الجمعة – السبت" : "Friday – Saturday"}
                value="06:00 – 02:00"
                loud
              />
              <Rate
                label={ar ? "الملعب الخارجي" : "Outdoor court"}
                value="06:00 – 22:00"
              />
            </dl>
            <p className="mt-5 max-w-sm font-board text-[11px] leading-relaxed text-line-dim">
              {ar
                ? "تتغيّر مواعيد رمضان كل عام وتُنشر هنا."
                : "Ramadan hours change every year and are published here."}
            </p>
          </div>
        </div>
      </section>

      {/* ================= CLOSE ================= */}
      <section className="relative overflow-hidden border-t border-line/15 bg-court-deep">
        {/* The closing court marks itself out at full page width as the reader
            arrives — the one large draw on the way down, and the counterpart to
            the trace at the top. */}
        <CourtLines
          paint
          className="pointer-events-none absolute inset-0 h-full w-full text-line/12"
        />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-5 py-20">
          <h2 className="painted paint-in max-w-3xl text-[clamp(2rem,6vw,4rem)]">
            {ar ? (
              <>
                لديك لاعبان؟ <span className="live">اطرح المباراة.</span>
              </>
            ) : (
              <>
                Two of you? <span className="live">List the match.</span>
              </>
            )}
          </h2>
          <p className="max-w-lg text-[16px] leading-relaxed text-line/75">
            {ar
              ? "احجز الملعب، اذكر مستواك، ودع لاعبَين ينضمان. تُقسم التكلفة على أربعة تلقائياً."
              : "Book the court, state your level, and let two strangers take the empty seats. The cost divides four ways on its own."}
          </p>
          <Link
            href="/play/matches"
            className="live-block inline-flex min-h-14 items-center px-8 font-stadium text-[13px] uppercase tracking-[0.1em] transition-[filter,transform] duration-100 hover:brightness-110 active:translate-y-0.5"
          >
            {t("site.seeMatches")}
          </Link>
        </div>
      </section>

      <p className="border-t border-line/15 bg-court-deep px-5 py-6 text-center font-board text-[10px] uppercase tracking-[0.18em] text-line-dim">
        {t("site.syntheticNotice")}
      </p>
    </main>
  );
}

/**
 * The hero's court, in perspective — a real padel plan seen from behind the
 * baseline, so it fills a wide hero without the plan-view stretch that made the
 * flat court read wrong, plus the arc of a single point drawn over it.
 *
 * Coordinates are a hand-built perspective: a 20×10m court, near baseline wide
 * at the bottom, far baseline narrow at the top, net at the half, a service
 * line 6.95m each side of it, and the centre service line down the middle.
 *
 * The ball's path is a point: struck from the near baseline, up and over the
 * net, bouncing in the far court (the cusp is the bounce), up off the bounce
 * toward the back glass and back down into the near court. Drawn once on load.
 */
function HeroCourt() {
  return (
    <>
      {/* The court, in line paint. */}
      <svg
        viewBox="0 0 1200 520"
        preserveAspectRatio="xMidYMax meet"
        className="pointer-events-none absolute inset-0 h-full w-full text-line/18"
        aria-hidden
        role="presentation"
      >
        <g fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke">
          {/* perimeter — the glass box */}
          <path d="M160 470 L1040 470 L760 90 L440 90 Z" strokeWidth="2" />
          {/* net */}
          <path d="M300 280 L900 280" strokeWidth="3.25" />
          {/* service lines */}
          <path d="M202 413 L998 413" strokeWidth="1.5" />
          <path d="M342 223 L858 223" strokeWidth="1.5" />
          {/* centre service line */}
          <path d="M600 223 L600 413" strokeWidth="1.5" />
        </g>
      </svg>

      {/* The point: bottom → over the net → bounce in the far court → up → back.
          Optic yellow, because the ball in play is the one live thing. */}
      <svg
        viewBox="0 0 1200 520"
        preserveAspectRatio="xMidYMax meet"
        className="pointer-events-none absolute inset-0 h-full w-full text-ball/80"
        aria-hidden
        role="presentation"
      >
        <path
          className="trace"
          d="M322 452 Q 452 96 616 214 Q 700 150 736 178 Q 646 252 540 322"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* the ball, at the near end of its return */}
        <circle cx="540" cy="322" r="6.5" fill="currentColor" />
      </svg>
    </>
  );
}

/**
 * What makes each court its own court. Read off the real attributes — premium
 * tier, enclosure, surface — so the five cards stop being one card printed five
 * times. Grounded in the court's physical character (glass, roof, open sky),
 * not invented amenities; specific perks are the client's to fill in.
 */
function courtCharacter(
  c: { tags: string[]; surface: string; enclosure: string },
  ar: boolean,
): { title: string; blurb: string; chip: string | null } {
  if (c.tags.includes("premium")) {
    return {
      title: ar ? "ملعب العروض" : "Show court",
      blurb: ar
        ? "بانوراما زجاجية بالكامل، ملعب النادي المميّز."
        : "Panoramic all-glass, the club's premium court.",
      chip: ar ? "مميّز" : "Premium",
    };
  }
  if (c.enclosure === "outdoor") {
    return {
      title: ar ? "ملعب الغروب" : "Sunset court",
      blurb: ar
        ? "في الهواء الطلق ومضاء ليلاً — أفضل قيمة على اللوحة."
        : "Open-air and floodlit after dark, the best value on the sheet.",
      chip: ar ? "أفضل قيمة" : "Best value",
    };
  }
  if (c.surface === "panoramic") {
    return {
      title: ar ? "الملعب الزجاجي" : "Garden court",
      blurb: ar
        ? "مغطّى لكن بجدران زجاجية، يبقى مضيئاً طوال اليوم."
        : "Covered, but glass on every wall, so it stays bright all day.",
      chip: null,
    };
  }
  if (c.enclosure === "covered") {
    return {
      title: ar ? "ملعب كل الأجواء" : "All-weather court",
      blurb: ar
        ? "مسقوف، يُلعب في المطر وفي حرّ يوليو."
        : "Roofed, so it plays straight through rain and the July heat.",
      chip: null,
    };
  }
  return {
    title: ar ? "ملعب المباريات" : "Match court",
    blurb: ar
      ? "زجاجي داخلي — ملعب النادي اليومي."
      : "Indoor glass, the club's steady everyday court.",
    chip: null,
  };
}

function Rate({
  label,
  value,
  loud = false,
}: {
  label: string;
  value: string;
  loud?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/15 py-3">
      <dt className="text-[15px] text-line/85">{label}</dt>
      <dd
        className={
          loud
            ? "live font-stadium text-[22px] tabular-nums"
            : "font-board text-[17px] tabular-nums text-line"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function clockOf(minute: number): string {
  const h = Math.floor((minute + 360) / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
