import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/data";
import { rowsOrThrow } from "@/data/query";
import { resolveAvailability } from "@/domain/availability";
import { bookableStarts, computeDayGrid, utilisation } from "@/domain/slots";
import { quote } from "@/domain/pricing";
import { openSeats } from "@/domain/split";
import { formatMoney } from "@/lib/money";
import { clock, todayInDubai } from "@/lib/time";
import { Link } from "@/i18n/routing";
import {
  BoardChip,
  BoardHead,
  BoardPanel,
  BoardRow,
  Digits,
  PaintedFigure,
} from "@/ui/board";
import { CourtLines, CourtPlate, ReboundTrace } from "@/ui/court";

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
  const busy = Math.round(utilisation(grid) * 100);
  const ar = locale === "ar";

  // Tonight's board: for each court, the next open 90-minute starts after
  // 18:00, priced by the same engine the counter uses. A player must never be
  // quoted one figure here and charged another at the desk.
  const EVENING = 720;
  const board = courts.map((court) => {
    const starts = bookableStarts(grid, court.id, 90).filter((m) => m >= EVENING);
    const live = bookings.find(
      (b) =>
        b.courtId === court.id &&
        b.status === "confirmed" &&
        b.start.getTime() <= Date.now() &&
        b.end.getTime() > Date.now(),
    );
    return {
      id: court.id,
      name: ar ? court.nameAr : court.name,
      ordinal: court.ordinal,
      live: Boolean(live),
      liveUntil: live ? clock(live.end) : null,
      starts: starts.slice(0, 4).map((startMinute) => ({
        startMinute,
        clock: clockOf(startMinute),
        price: quote({
          day,
          startMinute,
          durationMinutes: 90,
          court,
          tier: "guest",
          rules,
        }).total,
      })),
      more: Math.max(0, starts.length - 4),
    };
  });

  const openTonight = board.reduce((n, c) => n + c.starts.length + c.more, 0);
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
        <CourtLines className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] w-full text-line/20" />
        <ReboundTrace className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] w-full text-ball/70" />

        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[minmax(0,1fr)_27rem] lg:items-center lg:py-20">
          <div>
            <h1 className="painted text-[clamp(3rem,8.5vw,7rem)]">
              {ar ? (
                <>
                  أربعة لاعبين.
                  <br />
                  ملعب واحد.
                  <br />
                  <span className="live">تسعون دقيقة.</span>
                </>
              ) : (
                <>
                  Four players.
                  <br />
                  One court.
                  <br />
                  <span className="live">Ninety minutes.</span>
                </>
              )}
            </h1>

            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-line/80">
              {t("site.heroBody")}
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/play"
                className="live-block inline-flex min-h-14 items-center px-8 font-stadium text-[13px] uppercase tracking-[0.1em] transition-[filter,transform] duration-100 hover:brightness-110 active:translate-y-0.5"
              >
                {t("site.bookNow")}
              </Link>
              <Link
                href="/play/matches"
                className="inline-flex min-h-14 items-center gap-3 border border-line/35 px-7 font-stadium text-[13px] uppercase tracking-[0.1em] text-line transition-colors duration-100 hover:border-line hover:bg-line/10"
              >
                {t("site.seeMatches")}
                {seatsGoing > 0 && (
                  <span className="live-block px-2 py-1 text-[11px] leading-none">
                    {seatsGoing}
                  </span>
                )}
              </Link>
            </div>

            <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-8 border-t border-line/20 pt-8 sm:grid-cols-4">
              <PaintedFigure
                label={ar ? "متاح الليلة" : "Free tonight"}
                value={openTonight}
                sub={ar ? "فترات" : "slots"}
                live={openTonight > 0}
              />
              <PaintedFigure
                label={ar ? "مشغول اليوم" : "Booked today"}
                value={`${busy}%`}
                sub={ar ? "من الساعات" : "of open hours"}
              />
              <PaintedFigure
                label={ar ? "الملاعب" : "Courts"}
                value={courts.length}
                sub={ar ? "داخلي وخارجي" : "indoor & out"}
              />
              <PaintedFigure
                label={ar ? "مقاعد شاغرة" : "Seats going"}
                value={seatsGoing}
                sub={ar ? "مباريات مفتوحة" : "open matches"}
                live={seatsGoing > 0}
              />
            </dl>
          </div>

          {/* The board itself — the mechanism, at the scale it has in life. */}
          <BoardPanel className="lg:sticky lg:top-6">
            <BoardHead className="flex items-center justify-between">
              <span>{ar ? "ترتيب اللعب" : "Order of play"}</span>
              <span className="tabular-nums text-line-dim">{day}</span>
            </BoardHead>

            <div className="max-h-[30rem] overflow-y-auto">
              {board.map((court) => (
                <BoardRow key={court.id} flipKey={court.id} className="px-3 py-3">
                  <div className="flex items-start gap-3">
                    <Digits className="w-10 shrink-0 text-[26px] leading-none">
                      {String(court.ordinal).padStart(2, "0")}
                    </Digits>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-stadium text-[12px] uppercase tracking-[0.08em] text-line">
                          {court.name}
                        </span>
                        {court.live ? (
                          <BoardChip state="live">
                            {ar ? "يلعب" : "On court"} · {court.liveUntil}
                          </BoardChip>
                        ) : court.starts.length === 0 ? (
                          <BoardChip state="full">
                            {ar ? "مكتمل" : "Full"}
                          </BoardChip>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {court.starts.map((s) => (
                          <Link
                            key={s.startMinute}
                            href={`/play?d=${day}&mins=90`}
                            className="slot flex min-h-11 flex-col justify-center px-2.5 py-1"
                          >
                            <span className="font-board text-[14px] font-bold leading-none tabular-nums">
                              {s.clock}
                            </span>
                            <span className="mt-1 font-board text-[10px] leading-none tabular-nums opacity-70">
                              {formatMoney(s.price, locale, { showCurrency: false })}
                            </span>
                          </Link>
                        ))}
                        {court.more > 0 && (
                          <span className="flex min-h-11 items-center px-2 font-board text-[11px] text-line-dim">
                            +{court.more}
                          </span>
                        )}
                        {court.starts.length === 0 && (
                          <span className="font-board text-[11px] text-line-dim">
                            {ar ? "لا يوجد متاح مساءً" : "nothing left this evening"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </BoardRow>
              ))}
            </div>

            <div className="border-t border-line/20 px-3 py-2.5 font-board text-[10px] uppercase tracking-[0.16em] text-line-dim">
              {ar
                ? "الأسعار لكل ملعب · ٩٠ دقيقة"
                : "Per court · 90 min · split four ways"}
            </div>
          </BoardPanel>
        </div>
      </section>

      {/* ================= COURTS ================= */}
      <section className="border-t border-line/15 bg-court-deep">
        <div className="mx-auto w-full max-w-7xl px-5 py-16">
          <h2 className="painted text-[clamp(1.8rem,4vw,2.75rem)]">
            {t("site.courtsTitle")}
          </h2>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {courts.map((c) => {
              const free = bookableStarts(grid, c.id, 90).filter(
                (m) => m >= EVENING,
              ).length;
              return (
                <article
                  key={c.id}
                  className="glass-pane relative min-h-52 overflow-hidden p-5"
                >
                  <CourtPlate
                    n={c.ordinal}
                    className="pointer-events-none absolute -end-2 -top-5 text-[6.5rem]"
                  />
                  <CourtLines className="pointer-events-none absolute inset-x-4 bottom-12 h-9 text-line/20" />

                  <h3 className="relative font-stadium text-[15px] uppercase tracking-[0.06em] text-line">
                    {ar ? c.nameAr : c.name}
                  </h3>
                  <p className="relative mt-1.5 font-board text-[10px] uppercase tracking-[0.14em] text-line-dim">
                    {t(
                      `courts.enclosures.${c.enclosure}` as "courts.enclosures.indoor",
                    )}
                    {" · "}
                    {t(`courts.surfaces.${c.surface}` as "courts.surfaces.glass")}
                  </p>

                  <p className="absolute inset-inline-start-5 bottom-5 font-board text-[11px] uppercase tracking-[0.12em]">
                    {free > 0 ? (
                      <span className="live">
                        {free} {ar ? "متاح مساءً" : "open tonight"}
                      </span>
                    ) : (
                      <span className="text-line-dim">
                        {ar ? "المساء مكتمل" : "evening full"}
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
            <h2 className="painted text-[clamp(1.8rem,4vw,2.75rem)]">
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
            <h2 className="painted text-[clamp(1.8rem,4vw,2.75rem)]">
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
        <CourtLines className="pointer-events-none absolute inset-0 h-full w-full text-line/12" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-5 py-20">
          <h2 className="painted max-w-3xl text-[clamp(2rem,6vw,4rem)]">
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
