# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Front-desk staff** are the highest-frequency users. They work standing, on a tablet, at a counter, under bright light, often mid-conversation with a customer who is holding a racket and wants to know if court 3 is free at nine. They take cash. They answer the phone. They are interrupted constantly and rarely finish a task in one pass. Their day is spent in one screen: the court calendar.

**The club manager / owner** uses the same system a few times a day for different reasons: what did we take yesterday, which hours are empty, who gave that discount, did the till balance. They set prices and policy. They are the person who decides whether the system is worth paying for, and the reason is almost always money control rather than convenience.

**Players** are the public. They book from a phone, usually in the evening, usually for a slot in the next 48 hours. A large share are regulars who play the same slot every week with the same three people. A meaningful minority are looking for a game rather than a court — they have two players and need two more.

**Coaches** check their own schedule and roster; they do not administer the club.

## Product Purpose

Kagu Padel runs a padel club: it sells court time and it accounts for the money that comes back. Players find and book slots; staff run the day; the owner sees where the revenue and the leaks are.

Success is measured in three places. Staff stop keeping a parallel paper book or WhatsApp thread. The till reconciles at close with an explained variance. Court utilization by hour becomes a number the owner acts on when setting prices.

## Positioning

Two things separate this from a generic room/resource booker.

**Padel is a four-person sport played on a two-person booking.** The booking is not the unit of truth — the participants are. Who is playing, what level, who has paid their quarter, and whether there is room for two more. A court booker that models one customer per booking cannot express a match that two strangers join, and player-fill is the feature that generates bookings rather than merely recording them.

**The recurring slot is the business.** A large share of revenue is the same four players at 21:00 every Tuesday for a year. Recurring series are a first-class object with per-instance exceptions, not a convenience feature bolted on later.

## Operating Context

Single club, 4–6 courts, indoor and outdoor mixed. Operating hours roughly 06:00–02:00 local, so a "day" on the calendar crosses midnight. Slots are 60, 90, or 120 minutes; 90 is the norm.

Timezone Asia/Dubai. Currency AED. Bilingual Arabic and English with full RTL — Arabic is not a translation layer over an English product, it is a first-class direction the entire interface must work in.

Ramadan changes operating hours substantially and predictably every year. Public holidays and maintenance close courts. All three are exception rows against a normal template, never a code branch.

Cash is a major payment channel, which makes the daily till reconciliation — opening float, takings by method, expected versus counted, variance, who closed the shift — a core module rather than an accounting nicety.

WhatsApp is the notification channel customers actually read. Email is not. SMS via a local aggregator is the fallback.

Staff take walk-ins and phone bookings alongside web bookings, so every booking record carries its source and its creator.

## Capabilities and Constraints

**Confirmed scope:** court booking with holds; recurring series with per-instance exceptions; open matches with participant-level payment; customers; pricing engine; payments and daily till; courts and maintenance blocks; coaching and group classes; pro shop and F&B; tournaments and leagues; reports; staff roles and audit log; notifications.

**Concurrency is a correctness requirement, not a scale requirement.** Two people can tap the same 19:00 slot at the same moment. The system must make that impossible to get wrong at the data layer rather than checking for it in application code.

**Availability is computed, never stored.** Opening hours plus a per-court template plus exception rows, resolved on read. There is no table of pre-materialized slots.

**Rules the client will change are data.** Prices, cancellation thresholds and refund percentages, opening hours, membership tiers. Each has an editing UI. Changing Friday evening rates must not require a deploy.

**Money touching actions are audited immutably.** Who cancelled, who discounted, by how much, why, and when.

**Customers are identified by phone in practice.** Names are entered inconsistently. Deduplication is on phone number.

**Undecided:** payment provider; WhatsApp Business API eligibility for the client's entity; whether the club will run an academy in year one (built anyway, since the answer is usually yes within six months).

**No database exists yet.** The build runs on authored sample data behind a repository boundary; Supabase Postgres is the intended destination and its schema is authored alongside.

## Brand Commitments

Name: **Kagu Padel**. No existing logo, palette, typography, or prior interface. Nothing to preserve.

## Evidence on Hand

None. There are no real customers, bookings, prices, photographs, testimonials, or utilization figures. Every price, player name, match, and figure in the build is authored sample data and must be labeled as such wherever a viewer could mistake it for real. Commercial claims — actual rates, real customer counts, provider integrations — are not to be invented; they ship as marked placeholders on the client's replacement list.

## Product Principles

1. **The database enforces the truth.** Anything that must never happen — double bookings, negative stock, overfilled classes — is prevented by a constraint, not by a check in application code.
2. **Rules that change are rows, not code.** If the client could plausibly want it different next month, it has a table and an editing screen.
3. **The calendar is the product.** Front-desk staff spend 90% of their time in one screen. If it is fast and touch-correct on a tablet, they will forgive weaknesses everywhere else. If it is not, nothing else matters.
4. **Model the four players, not the one booker.** Participants, levels, and per-person payment status are core to the data model, not an add-on.
5. **Arabic is a direction, not a translation.** Every layout is built to work mirrored from the start.

## Accessibility & Inclusion

Bilingual AR/EN with complete RTL layout, including in the calendar grid and every chart axis.

Booking status must never be encoded by hue alone — the calendar is read at speed, sometimes in sunlight, sometimes by someone who does not distinguish red from green.

Touch targets sized for a standing user on a tablet, not a mouse. Full keyboard operability through the booking and payment flows.
