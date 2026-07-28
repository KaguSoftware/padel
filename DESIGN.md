# Design — Kagu Padel

<!-- impeccable:design-schema 1 -->

## Direction contract

**THESIS.** Padel is played inside a floodlit glass box, and the object that
governs a club's evening is the order-of-play board hanging over it: which
court, what time, who is on, how many seats are open. A booking system *is*
that board, so it looks like one. It refuses the category default — the white
sports-SaaS console with a green accent, a stock photo of smiling players and a
generic time grid — and it refuses that default's two predictable escapes:
neon-on-black "athletic performance" glassmorphism, and the quiet editorial
paper-and-serif treatment that any model reaches for when asked to be tasteful.

**OWN-WORLD.** Saturated court blue as the page's ground, not an accent —
drenched, at the scale a court has in life, lit by four hard floodlight pools
falling from the top edge. White line paint for type and rules. **Optic yellow
is reserved**: it means *available to take* or *live*, and nothing else in the
product may use it. Amber belongs to the board's mechanical digits. Clay is the
alert. Panels are glass with a lit top edge; the board itself is a near-black
panel that sits on top of the court. Headlines are painted onto the surface in
heavy wide caps, not set on a page. The court's own line plan — service lines,
centre line, net — is the structural graphic, and padel's signature rebound off
the back glass is drawn once, live, in the first viewport.

**STORY.** A player opens the site in the evening and sees tonight's real board:
five courts, the hours still free, the price of each, and how many seats are
going on the listed matches. They take one. A member of staff opens the same
board from the control desk and writes an entry into it. The owner turns to the
ledgers and finds which hour to price up.

**FIRST VIEWPORT (public).** Full-bleed floodlit court. The court line plan and
one rebound trace across the lower two-thirds, drawn live on load. A painted
three-line headline at `clamp(3rem, 8.5vw, 7rem)` with its last line in optic
yellow. Two actions — a solid optic-yellow block and an outlined one carrying
the live seat count. Beneath them, four painted figures read from the same grid
the front desk sees. To the right, sticky, **the board itself**: a near-black
panel, one flap row per court, each carrying a monumental court number in amber
dot-matrix and the next open start times as lit, tappable panels at their real
price.

**FORM.** Grounded direction 4 of 7 — the scoreboard and order-of-play board,
fabricated-signage family — sited in its own habitat, the floodlit glass box.
Seed key 5e6b9045, scope direction, mode persuade.

---

## One world, two rooms

The admin is **not** a separate back-office aesthetic. It is the same
floodlit court seen from the control desk: same palette, same faces, same
components, more density. A club whose staff screen looks nothing like its
public screen is two products; this is one.

| Surface | Mode | Consequence |
|---|---|---|
| `(site)` landing | Persuade | The board at full scale, live. Show the mechanism, never claim it. |
| `(site)` play, matches, checkout | Operate | Phone-first. The slot panel is the unit; price is always visible on it. |
| `(site)` sign up, sign in | Operate | One measured column on court surface, the court plan low behind it. Four fields at most, the refusal beside the form rather than at the top of the page, and it names what to do next — a taken email says "sign in instead". |
| `admin` all modules | Operate | Tablet-first, standing user, bright light. Density and state legibility outrank expression. |

Two things the public surface affords and the console does not, because the
scene is different — one person, standing, under bright counter lighting, on the
same screen for a whole shift:

- **No floodlight bloom on admin heads.** The four hard light pools of
  `.court-surface` are the world at the door and glare at the counter. Admin
  pages open on the board itself: flat, near-black, hairline-ruled.
- **No backdrop blur behind panels.** The glass pane keeps its lit edge and
  hairline; it drops the blur, which forces a compositing layer per panel and
  buys nothing over an opaque ground.

Same palette, same faces, same components. The console is still the same
floodlit court — it is just seen from indoors.
| `(site)` policy, help | Read | A single measured column on court surface. |

---

## Colour

**Strategy: drenched.** The surface *is* the colour. The scene decides it: a
padel court is a saturated blue field under floodlights against a dark Gulf
sky, and both the player choosing a slot at 21:00 and the front desk working
under bright light are looking at that. Light-on-dark is the physical truth
here, not a dark-mode preference.

```
--court        #0b2f7a   court blue — the ground
--court-deep   #05122f   the dark end, and the page behind the court
--court-lit    #1a4fb8   lit panel, unlit-but-free slot
--court-glass  #2f6ad4   the glass wall
--line         #eaf1ff   line paint — all type, all rules
--line-dim     #94aede   secondary type
--ball         #d9f227   OPTIC YELLOW — available / live. Nothing else.
--amber        #ffb020   the board's mechanical digits
--clay         #e4482f   alert, overdue, conflict
--board        #04101f   the board panel itself
```

**Optic yellow is the product's scarcest resource.** If it appears on something
that is not takeable or not currently happening, the whole board stops meaning
anything. Amber is for digits; clay is for alerts; neither substitutes.

**State is never carried by hue alone.** Every status is a WORD plus a colour
plus a treatment, because the board is read at a glance across a room, in
floodlight or sunlight, sometimes by someone who does not distinguish red from
green:

| State | Word | Colour | Treatment |
|---|---|---|---|
| Open | — | `--court-lit` at 12% | Unlit panel; lights to optic yellow under the cursor |
| Held | `HELD` + countdown | `--amber` | Amber leading edge that burns down as the TTL runs |
| Confirmed | `CONF` | `--line` at 15% | Solid card |
| Paid | `PAID` | `--ball` | Optic-yellow leading edge |
| Due | `DUE` | `--clay` | Clay leading edge |
| No-show | `NO-SHOW` | `--line-dim` | Desaturated, struck |
| Blocked | `BLOCKED` | `--line-dim` | Hatched fill |
| Open match | `+N SEATS` | `--ball` | Detachable stub on the card edge |

Contrast floor: 4.5:1 for text, 3:1 for any edge or chip carrying state.

---

## Type

| Role | Latin | Arabic | Notes |
|---|---|---|---|
| Painted headings, court names, buttons | **Archivo Black** | **Noto Kufi Arabic** | Stadium lettering — the heavy grotesque of court signage and fixture posters. Kufi is Arabic's architectural/signage register; it is the correct counterpart, and Naskh (a document face) would be the same error as setting the English in a book serif. |
| Board readout — **figures only** | **Doto** | Doto + Almarai fallback | A dot-matrix variable face. This is a *departure board*, not a "tech mono" — no other face reads as a live mechanical board, which is why it earns its place over a default mono. |
| Labels, body copy, form fields | **Archivo** | **Almarai** | Workhorse grotesque with true tabular figures. |

**The board face carries figures, not words.** Clocks, money, serials,
counters, court numerals, countdowns — anything that is a figure on a
mechanical board. It does not carry running label text. Set at 9–11px,
uppercase, tracked between 0.07em and 0.28em, a dot-matrix face stops being
words and becomes texture; word-shape is what reading at a glance runs on, and
a front-desk shift is eight hours of reading at a glance. `.board-label` is the
one label style: 13px, sentence case, 0.01em, in the body grotesque. It replaced
ten different ad-hoc tracking values for a single idiom.

Arabic runs its own ramp: ~1.06× the Latin size and +0.08 line-height at every
step, because an Arabic face set on a Latin ramp always reads small and cramped.
Kufi display runs +0.18 line-height and zero tracking.

Scale (px): 12 · 13 · 14 · 16 · 20 · 26 · 30 · 34 · then `clamp()` for painted
display on the public surface. Admin type is a fixed rem ramp and never fluid —
a heading that shrinks inside a panel looks worse, not better, and the reader is
at a fixed distance from a fixed screen. Painted headings are −0.015em with 0.86
line-height. Form fields are 16px, because anything smaller makes iOS zoom the
page on focus and the tablet is the product.

---

## Direction and RTL

RTL is structural, not a stylesheet at the end.

- **No `left`/`right` in layout code.** `padding-inline`, `inset-inline-start`,
  `border-inline-end`; Tailwind logical utilities (`ps-`, `pe-`, `ms-`, `me-`,
  `start-`, `end-`) only.
- ⚠️ **The CSS property names are not the utility names.** `inset-inline-start-0`
  and `inset-inline-0` are not Tailwind v4 utilities and compile to *nothing* —
  four of them shipped and were silently dead, one of which was why the mobile
  drawer never pinned to an edge. The utilities are `start-*` / `end-*`,
  `inset-s-*` / `inset-e-*`, and `inset-x-*`. A class name that reads like the
  property is the easiest one to get wrong; generate it and check.
- Everything with words in it mirrors: the rail, the cards, the sheets, the
  ledgers, the shell. The *identity* does not — the club mark, the court plan,
  and the rebound trace stay as drawn, because they are physical objects.
- Physical axes stay physical. Chart time axes run left-to-right in both locales
  (`dir="ltr"` on the plot), and **so does the day board**, which since courts
  became lanes is exactly that case: a time axis. `dir="ltr"` sits on the board's
  scroller; the court rail, the card contents and every panel around it mirror
  normally. Reversing a time axis breaks comprehension faster than it satisfies
  symmetry.
- Money is Latin digits in both locales — figures get compared down a column and
  copied onto receipts, and mixing ١٢٣ with 123 in a money column is unreadable.
  Prose numbers may use the locale's own digits.
- Both directions are checked on every screen. RTL bugs hide in the screens
  nobody re-opens.

---

## Component grammar

- **Board panel** — near-black, hairline border, deep drop shadow. The only
  element allowed to sit *on top of* the court rather than in it.
- **Flap row** — a board row with the faint horizontal seam of a real split-flap,
  and a 260ms `rotateX` flap on change. Content changes flip; nothing fades.
- **Slot** — a lit panel carrying its time and its real price. Free slots light
  to optic yellow and rise 2px on hover; taken slots are inert; closed slots are
  hatched. The whole panel is the hit area, ≥44px.
- **Card** (a booking) — a panel whose leading edge carries the state colour, with
  the serial in amber dot-matrix in the corner. Content tiers off the booking's
  own length, not a pixel count, so it survives the band growing: ≥90 min gets
  name, serial, stamp, clock and price; 60 min drops to name and stamp; 30 min
  is the stamp alone.
- **Lane** — one court, running the whole width of the day. **Courts are rows
  and time runs across them.** Courts-as-columns made a 06:00–02:00 day roughly
  forty bands tall: four hours visible at a time, and a 90-minute booking was a
  96px-tall, 120px-wide sliver that had to abbreviate everything on it. On its
  side, the whole club is four to six lanes and seven hours fit across a tablet.
- **Time ruling** — the day board's axis, now vertical rules along a horizontal
  day. Every 30-minute band is bounded, not only every hour: half of all starts
  are on the `:30`, and a rule only on the hour leaves those cards floating with
  nothing naming where they began. The hour rule is `line/24` and prints the bare
  hour in board digits; the half-hour rule is `line/8` and prints nothing —
  forty printed `:30`s is texture, not an axis. **Three tokens, `--lane-h`,
  `--slot-w` and `--rail-w`, drive the ruling, the lane heights and every card's
  inline offset and width**, so a card cannot drift off the band it starts on.
- **Now** — a 2px optic-yellow rule at the actual minute, down every lane at
  once, with the clock riding its head. It moves off the one 1Hz ticker, and the
  board scrolls to it on open rather than starting the reader at 06:00 on a day
  that has already happened. It is never rounded to the nearest band: "is court 3
  free right now" is the question this screen exists to answer.
- **Peek sheet** — a record opened *over* the board rather than *instead of* it.
  A side sheet from `lg`, a bottom sheet below. It carries the four things the
  front desk does to a booking between one customer and the next — confirm,
  no-show, cancel with a reason, move — and links to the full record for
  everything else. Staff open bookings dozens of times a shift, usually
  mid-sentence with somebody at the counter; the board must not leave the screen
  to do it.
- **Attention filter** — chips that DIM what does not match, never hide it.
  Hiding a booking on an operations board is a hazard: the court is still taken
  whether or not the filter agrees.
- **Court plate** — the monumental outlined number bolted to the fence, used as
  wayfinding wherever a court is named.
- **Glass pane** — the section container: a translucent blue pane with a lit top
  edge and a hairline border. Panels do not nest.
- **Court line plan** — the structural graphic. Appears where a surface needs to
  read as a court; never as page-wide wallpaper.
- **Rebound trace** — drawn ONCE, in the first viewport. It is padel's signature
  and it stops being one if it is repeated.
- **Buttons** — painted blocks. Primary is solid optic yellow on court-deep;
  secondary is an outlined line-paint block. ≥48px in the admin.
- **Icons** — authored in the world's grammar: 1.5px hairline strokes, square
  terminals, mitred joins, no filled pictograms. The club mark is a padel court
  in plan with its net and service lines.

---

## Motion

The world's native motion is mechanical, not eased-and-floaty.

- **Flaps land.** A row whose content changed flips in over 260ms on `rotateX`,
  from −92° through a 12° overshoot. One per change.
- **The rebound trace draws once** on first paint, 2.6s, then stays.
- **Paint goes down ahead of the reader.** On the landing page the court's line
  plan marks itself out as you descend — perimeter, then net, then service
  lines, the order a court is actually marked in. It is tied to scroll position
  rather than to a timer, because the meaning is spatial: you are walking the
  length of a court. `pathLength="1"` normalises every line so they draw at one
  rate. The rebound trace is never reused for this; it is spent on load.
- **A court arriving is a row arriving.** Sections do not fade and rise. The
  court cards land on the board's own 260ms flap, driven by the same scroll
  timeline. There is no third entrance verb, and no section gets an entrance
  merely for existing.
- Scroll-driven motion lives entirely inside `@supports (animation-timeline:
  view())`, so a browser without scroll timelines renders the finished state.
  Nothing is ever hidden by a reveal that might not fire.
- **Holds burn down.** A held slot's amber edge shortens in real time; on
  checkout it is a bar across the head of the card. It is not a progress
  indicator — the slot is physically going away.
- **Slots light, they do not glow.** 120ms background and 2px lift. No blur, no
  halo, no pulse.
- **The admin never animates navigation.** Staff are mid-task. The peek sheet is
  the one exception and it lands in 160ms from the edge it is attached to — a
  sheet you wait for is a sheet you resent.
- **Working is three board lamps stepping, not a spinning ring.** A rotating
  circle is a motion this world does not contain. The label keeps its box while a
  button works, so no toolbar jumps on any action.
- **Every gesture is Pointer Events.** Move, resize and draw-to-book run one code
  path for finger, stylus and mouse. HTML5 drag-and-drop does not fire on touch,
  which meant the board's central gesture did not exist on the device the product
  is named after. A press becomes a drag only after 6px, so a tap stays a tap.
  During a drag only `transform` and `background-color` move; nothing relayouts.
- **Everything the pointer does, the keyboard does.** Arrows walk the bands on a
  roving tabindex (one tab stop for the grid, not two hundred); `m` picks a
  booking up, arrows place it, Enter drops it, Esc leaves it where it was.
- One 1Hz ticker drives every countdown on the page. Sixty `setInterval`s on a
  front-desk tablet is a jank generator, and the tablet is the whole product.
- Everything respects `prefers-reduced-motion`: flaps and the trace resolve to
  their final state immediately.

---

## Responsive

Phone first, and not as an afterthought — a player choosing a court at 21:00 is
on a phone, and the front desk's tablet is a narrow viewport in portrait.

- **The page never scrolls sideways.** `body { overflow-x: clip }`. Anything
  genuinely wider than a phone — the day board, every ledger table, the
  utilisation chart, the section rails — scrolls inside its own `.scroll-x`
  container. `clip` and not `hidden`, because `hidden` makes body a scroll
  container and silently breaks every sticky header in the app.
- **The day board's court rail is sticky** at the inline start; the day scrolls
  under it. Band width is `--slot-w` (5rem, 6rem from 640px) and lane height is
  `--lane-h` (4.5rem, 5rem from 640px) — both go UP on the wider screen, because
  the wider screen here is the front desk's tablet and its user is standing at a
  counter, not leaning into a laptop. The rail narrows to `8.5rem` below 640px so
  three hours and the court names fit on a 375px screen.
- **Page bodies cap at `--desk-max` (110rem) and centre.** A ledger stretched
  across a 27-inch desk monitor is a ledger nobody can follow a row across. The
  day board is the one exception: it takes the full width, because more visible
  hours is the entire point of it.
- **The mobile rail carries every destination.** A bottom bar that silently
  drops its last entries hides part of the product. `.pad-for-bar` reserves its
  height so the last row of any page is reachable, and `.safe-bottom` keeps it
  above the iOS home indicator.
- **Touch targets: 44px minimum, 48px for anything in the board grid or a
  primary action.** The console user is standing.
- Separators that are page furniture on a wide screen (the `·` between entry-line
  slots) are hidden below `sm`, where the slots already wrap onto their own
  lines.
- Side panels stack under their content at `lg`, never sit in a squeezed column.
- Type scales with `clamp()` at display sizes; body text does not scale.

---

## Prohibitions

Each of these is absent from the world itself, not merely unfashionable.

- **No optic yellow on anything that is not available or live.** The one rule
  that keeps the board readable.
- No blurred coloured glows, no neon halo, no "glassmorphism" as a decorative
  effect — the glass pane here is a real wall with a lit edge and a hairline.
- No gradients as decoration. The only gradients are the court's own lighting.
- No corner radius above 2px. Boards and plates are cut, not rounded.
- No cream, paper, parchment or ivory grounds anywhere.
- No colour-only state encoding.
- No stock icon set where an authored mark belongs.
- No eyebrow labels: the small pill or dot-plus-caption above a headline. The
  first thing on a page is the thing itself.
- No decorative photography standing in for the mechanism. If a screen can show
  real availability, it shows real availability.

---

## Data & numbers

- Money is stored and passed as **integer minor units (fils)**; only the
  formatter sees a decimal, and a branded `Fils` type makes a raw `number` a
  compile error.
- All numbers in a column are tabular and set in the board face.
- Times are stored UTC, rendered `Asia/Dubai`. The operating day runs 06:00 →
  02:00, so a day crosses midnight and a 01:00 booking belongs to the previous
  day's board and the previous day's till.
- Charts follow the same rules: the peak column is distinguished by a hatch and
  a printed figure as well as by colour, and the time axis stays LTR.
