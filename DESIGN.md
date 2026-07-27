# Design — Kagu Padel

<!-- impeccable:design-schema 1 -->

## Direction contract

**THESIS.** This system is a ledger, so it looks like one. Every booking is an entry, every payment a stamped receipt, every audit row a line that cannot be erased. It refuses the category default — the white-card sports SaaS console with a green accent and a generic time grid — and it refuses that default's inverse, the neon-on-black athletic dashboard. Guilloche and ruled cash books are the graphic tradition of documents that must not be forged or altered, which is precisely the promise the database's exclusion constraint makes about a 19:00 slot.

**OWN-WORLD.** Green-bar continuous-form ledger paper as the working ground, banded and red-ruled. Bottle-green card stock as the surrounding shell and chrome. Indigo as the writing ink, oxblood as the settlement colour, brass foil for serials and member tiers. Engraved hairline guilloche on receipts, member cards, and certificates only. Status is a rubber-stamp overprint — a word, set in a boxed or arced stamp, rotated a few degrees off true, in a colour that is redundant with the word. Bookings are card slips set into the ruling, with perforated stub edges where something is detachable (an open seat, a participant's share). Didone display lettering for mastheads and monumental numerals; a workhorse grotesque with tabular figures for the ledger body; typewriter mono for serials, receipts, and machine output, because carbon triplicate receipts were typed.

**STORY.** A member of staff standing at a counter sees today's page and knows, without reading, which courts are empty, which money is outstanding, and which hold is about to expire. They write a new entry by completing one sentence. The owner turns to the cash book at close and finds the variance already computed. A player opens the same ledger from a phone and sees the two empty seats in Thursday's 21:00 match.

**FIRST VIEWPORT (staff console).** A ruled day-book page fills the frame. A bottle-green masthead band across the top carries the club mark, the date in both calendars, and the page's serial. Immediately below it, the entry line: one sentence with open slots — *Book ▮court▮ for ▮customer▮ at ▮time▮ for ▮duration▮* — with the still-open slot marked and every eligible cell in the grid below it ruled to show what may fill it. The page itself is courts as ruled columns and hours as banded rows, alternating green-bar tint, red vertical rules between courts, the current time a rule that reads across the whole page with the time set in the margin. Booking slips sit in the ruling carrying serial, customer, party size, and a status stamp. The primary action is the entry line; it is always at the top and always the widest thing on the page.

**FORM.** Grounded direction 6 of 7 — club membership card and cash ledger, security-printing family — fused with the *command-sentence* staging, which is the physical act of writing a line in a day book. Seed key 83396768, scope direction, mode operate.

---

## Modes by surface

| Surface | Mode | Consequence |
|---|---|---|
| `(site)` marketing, landing | Persuade | The ledger at full scale, dramatized. Show the mechanism, not a claim. |
| `(play)` player booking, matches | Operate | Phone-first. The ledger page narrows to one court-day column; the slip is the unit. |
| `(console)` staff OS | Operate | Tablet-first, standing user, bright light. Density and state legibility outrank expression. |
| `(site)` policy, help | Read | The ledger's ruled reading column; measure over decoration. |

---

## Color

**Strategy: full palette, four named roles.** The scene decides light/dark: a front-desk tablet on a counter with a glass court wall behind it, in Gulf daylight. The working page is therefore light and high-contrast; the chrome around it is deep bottle-green card stock. Neither surface is white and neither is cream — cream is the default this world is specifically not made of.

```
--paper          #EEF2E6   green-bar ledger stock, band A
--paper-band     #E981EDA  → #E2E9D8  band B (alternating rows)
--paper-edge     #D3DCC6   rule between bands, card slip edges

--shell          #0C2B20   bottle-green card stock (chrome, masthead, nav)
--shell-raised   #123A2B
--shell-line     #1E5641   hairline on shell

--ink            #1B2447   indigo writing ink (all body text on paper)
--ink-soft       #4A5478   secondary text, column heads
--ink-faint      #8A91AC   pencil, provisional, disabled

--rule           #C24438   ledger red vertical/marginal rules
--rule-soft      #E0A79F   hairline ruling at low emphasis

--settle         #7E1B22   oxblood — paid, settled, confirmed money
--settle-bright  #A82A31   stamp ink
--brass          #A8853F   serials, member tier, foil marks
--brass-bright   #C9A85E

--void           #6B6F63   grey — released, expired, cancelled
```

**Status must never be carried by hue alone.** Every state is a stamped or ruled *word* plus a colour plus a shape treatment:

| State | Word | Colour | Treatment |
|---|---|---|---|
| Open | — | — | Ruling only, no slip |
| Held | `HELD` + countdown | `--ink-faint` | Pencil-weight slip, dashed perforated edge |
| Confirmed | `CONF` | `--ink` | Solid indigo slip |
| Paid | `PAID` | `--settle-bright` | Arced rubber stamp, rotated −6°, overprinted |
| Due | `DUE` | `--rule` | Slip with doubled red rule at the inline start |
| No-show | `NO-SHOW` | `--void` | Single diagonal strike rule across the slip |
| Blocked | `BLOCKED` | `--void` | Guilloche hatch fill, no customer line |
| Open match | `+2 SEATS` | `--brass` | Perforated detachable stub on the block edge |

Contrast floor: 4.5:1 for all text, 3:1 for the rules and stamp outlines that carry state.

---

## Type

| Role | Latin | Arabic | Notes |
|---|---|---|---|
| Masthead, monumental numerals, marketing display | **Bodoni Moda** | **Noto Naskh Arabic** | Didone is the letterform of certificates, prospectuses and banknotes. Display sizes only — never below 20px, the hairlines break. |
| Ledger body, UI, column heads | **Archivo** | **Almarai** | Workhorse grotesque with true tabular figures. `font-variant-numeric: tabular-nums` is on by default for every number in a column. |
| Serials, times, receipts, machine output, audit log | **Courier Prime** | Courier Prime + Almarai fallback | Carbon triplicate receipts were typed. Typewriter mono is world-native here, not a tech signifier. |

Arabic gets its own ramp — Almarai runs roughly 1.06× the Latin size and +0.08 line-height at every step, because an Arabic face set on a Latin ramp always reads small and cramped. Naskh display runs +0.15 line-height.

Scale (Latin, px): 11 · 12 · 13 · 15 · 17 · 21 · 28 · 40 · 64 · 96. Column heads are 11 uppercase with +0.08em tracking. Ledger body is 13. Nothing between 13 and 15 exists.

---

## Direction and RTL

RTL is structural, not a stylesheet at the end.

- **No `left`/`right` in layout code.** `padding-inline`, `margin-inline`, `inset-inline-start`, `border-inline-end`, `text-align: start`. Tailwind logical utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) only.
- The ledger's ruling mirrors: in `ar`, court columns run right-to-left and the time margin sits on the right. The *identity* does not mirror — the club mark, the stamp arc direction, and the guilloche stay as drawn.
- Physical direction is preserved where it is physical: a timeline still runs top-to-bottom; chart time axes still run left-to-right in both locales, because reversing a time axis breaks comprehension faster than it satisfies symmetry.
- Numerals: `Intl.NumberFormat` with the locale's own numbering system. Currency is always AED with the symbol on the correct side per locale.
- Both directions are checked on every screen. RTL bugs hide in the screens nobody re-opens.

---

## Component grammar

Every primitive is rebuilt in the world's vocabulary. A stock rounded card with a soft shadow inside this system is a lapse.

- **Slip** — the universal container. Card stock with a 1px `--paper-edge` border, a 3px inline-start bar in the status colour, a serial in mono at the top corner. Corner radius 2px, never more. Elevation is a hard 1px offset shadow, never a blur.
- **Entry line** — the command sentence. A ruled bar with typed slots; an open slot is an underlined blank in `--brass`, filled slots read back as words. Ill-typed input is refused *at the slot* with a reason. Only a sentence that parses can be committed.
- **Stamp** — boxed or arced word, 1.5px outline, rotated −6° to −3°, `mix-blend-mode: multiply` so it reads as overprint. Used for status and nothing else.
- **Rule** — the only divider. Red `--rule` for structural columns, `--paper-edge` for row bands. No shadows as separators.
- **Guilloche** — an SVG spirograph hairline. Appears on receipts, member cards, certificates, and the marketing masthead. Never as page background chrome.
- **Perforation** — a dashed edge with punched semicircles, used wherever something detaches: a hold that will expire, an open seat, a participant's share of the bill.
- **Column head** — 11px uppercase tracked, `--ink-soft`, with a `--rule` underline. Sortable heads carry a mono sort mark, not a chevron icon.
- **Buttons** — inked blocks with a 1px hard offset, pressed state removes the offset. Primary is `--settle`, secondary is outlined `--ink`, destructive carries a hatch.
- **Icons** — drawn in the world's grammar: 1.5px hairline strokes, square terminals, no rounded joins. Court geometry, stamps, and ledger marks are authored; nothing generic is imported for a place where an authored mark belongs.
- **Touch targets** — 44px minimum everywhere in `(console)`, 48px for anything in the calendar grid. The user is standing.

---

## Motion

The world's native motion is paper and mechanism, not easing curves.

- Stamps **land**: 90ms scale-down from 1.06 with no bounce, then settle. One per action, never decorative.
- Slips **slide into the ruling** on create; they do not fade in.
- A hold's remaining time is a perforated edge that **tears further open** as it expires.
- Drag-to-move lifts the slip 2px with a hard shadow; on conflict it snaps back along the same path in 140ms and a `TAKEN` stamp lands on the origin.
- Page transitions are a ledger page turn only on the marketing surface. The console never animates navigation — staff are mid-task.
- Everything respects `prefers-reduced-motion`: stamps appear without landing, tears set to their final state.

---

## Prohibitions

Checked against the world's own materials — each of these is absent from security printing and club stationery, not merely unfashionable.

- No blurred drop shadows. Elevation in this world is a hard offset or a paper edge.
- No corner radius above 2px. Card stock is guillotined.
- No gradients as surface fill. Ink is flat; guilloche makes tone from line.
- No glassmorphism, no glow, no neon.
- No cream, parchment, or ivory grounds. This world's paper is green-bar stock.
- No colour-only state encoding anywhere.
- No generic icon tile where an authored mark belongs.
- Didone below 20px is banned outright.

---

## Data & numbers

- Money is stored and passed as **integer minor units (fils)**; only the formatter sees a decimal. A branded `Fils` type makes a raw `number` a type error.
- All numbers in a column are tabular and right-aligned in `en` / start-aligned to the numeral column in `ar`.
- Times are stored UTC, rendered `Asia/Dubai`. The operating day runs 06:00 → 02:00, so a "day" crosses midnight and the calendar must render past-midnight hours as part of the preceding day's page.
- Charts follow the same palette and the same non-hue-alone rule: series are distinguished by ruling pattern as well as colour.
