import { dirhams, ZERO } from "@/lib/money";
import { normalisePhone } from "@/lib/text";
import { localDate } from "@/lib/time";
import type {
  AvailabilityException,
  AvailabilityTemplate,
  CancellationPolicy,
  Coach,
  CoachAvailability,
  Court,
  Customer,
  PricingRule,
  Product,
  PromoCode,
  StaffUser,
} from "../types";

/**
 * ⚠️ SYNTHETIC DATA — every name, phone number, price and balance below is
 * authored for the prototype. None of it is a real customer, a real rate card,
 * or a real member of staff. Replace wholesale before the client's data lands;
 * see HANDOFF.md's replacement list.
 *
 * It is authored at production fidelity on purpose: a booking system demoed on
 * "Customer 1 / Court A / 100.00" hides every layout problem that real Arabic
 * names, real 4-digit serials and real awkward totals expose immediately.
 */

export const VENUE = {
  name: "Kagu Padel",
  nameAr: "كاجو بادل",
  city: "Dubai",
  cityAr: "دبي",
  // SYNTHETIC placeholder — replace with the client's real details.
  phone: "+971 4 000 0000",
  address: "Al Quoz 1, Dubai",
  addressAr: "القوز ١، دبي",
} as const;

export const COURTS: Court[] = [
  {
    id: "crt-1",
    name: "Court 1",
    nameAr: "الملعب ١",
    ordinal: 1,
    surface: "panoramic",
    enclosure: "indoor",
    tags: ["indoor", "panoramic", "premium"],
    active: true,
  },
  {
    id: "crt-2",
    name: "Court 2",
    nameAr: "الملعب ٢",
    ordinal: 2,
    // Distinct from court 1: covered rather than indoor, and not the premium
    // tier — a glass-walled court that stays bright and playable all day. Two
    // identical premium courts made the line-up read as one court printed five
    // times; every court now has its own character.
    surface: "panoramic",
    enclosure: "covered",
    tags: ["covered", "panoramic"],
    active: true,
  },
  {
    id: "crt-3",
    name: "Court 3",
    nameAr: "الملعب ٣",
    ordinal: 3,
    surface: "glass",
    enclosure: "indoor",
    tags: ["indoor", "glass"],
    active: true,
  },
  {
    id: "crt-4",
    name: "Court 4",
    nameAr: "الملعب ٤",
    ordinal: 4,
    surface: "glass",
    enclosure: "covered",
    tags: ["covered", "glass"],
    active: true,
  },
  {
    id: "crt-5",
    name: "Court 5",
    nameAr: "الملعب ٥",
    ordinal: 5,
    surface: "wall",
    enclosure: "outdoor",
    tags: ["outdoor", "wall", "budget"],
    active: true,
  },
];

/**
 * Opening hours. Minutes are measured from the operating day's 06:00 start, so
 * 0 = 06:00 and 1200 = 02:00 the following calendar morning.
 *
 * Fri/Sat run later; the outdoor court closes earlier in summer heat.
 */
export const TEMPLATES: AvailabilityTemplate[] = [
  // Every court, Sun–Thu: 06:00 → 00:00
  ...[0, 1, 2, 3, 4].map((weekday, i) => ({
    id: `tpl-all-${i}`,
    courtId: null,
    weekday,
    openMinute: 0,
    closeMinute: 1080,
  })),
  // Every court, Fri–Sat: 06:00 → 02:00
  ...[5, 6].map((weekday, i) => ({
    id: `tpl-all-we-${i}`,
    courtId: null,
    weekday,
    openMinute: 0,
    closeMinute: 1200,
  })),
  // Court 5 is outdoor — closes at 22:00 every day.
  ...[0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    id: `tpl-c5-${weekday}`,
    courtId: "crt-5",
    weekday,
    openMinute: 0,
    closeMinute: 960,
  })),
];

/**
 * Exceptions. Ramadan hours are rows, never a code branch — the dates move
 * ~11 days earlier each Gregorian year and the client edits them in the UI.
 */
export const EXCEPTIONS: AvailabilityException[] = [
  {
    id: "exc-ramadan-2027",
    courtId: null,
    from: localDate("2027-02-08"),
    to: localDate("2027-03-09"),
    kind: "ramadan",
    // 14:00 → 02:00 — the club opens after Asr and runs deep into the night.
    openMinute: 480,
    closeMinute: 1200,
    note: "Ramadan hours — 14:00 to 02:00",
    noteAr: "توقيت رمضان — من ٢:٠٠ ظهراً حتى ٢:٠٠ صباحاً",
  },
  {
    id: "exc-natday",
    courtId: null,
    from: localDate("2026-12-02"),
    to: localDate("2026-12-03"),
    kind: "holiday",
    openMinute: 240,
    closeMinute: 1200,
    note: "UAE National Day — late opening",
    noteAr: "اليوم الوطني — افتتاح متأخر",
  },
];

/**
 * Rate card. Priority resolves overlaps; a higher number wins.
 *
 * Deliberately messy in the way a real one is: peak is by hour band and
 * weekday, the outdoor court is cheaper, members get a discount, and the
 * 120-minute rate is not simply double the 60.
 *
 * ⚠️ SYNTHETIC — these are not the client's rates.
 */
export const PRICING_RULES: PricingRule[] = [
  {
    id: "px-base-60",
    label: "Off-peak · 60 min",
    labelAr: "خارج الذروة · ٦٠ دقيقة",
    priority: 10,
    weekdays: [],
    fromMinute: null,
    toMinute: null,
    courtIds: [],
    courtTags: [],
    tiers: [],
    durations: [60],
    amount: dirhams(90),
    active: true,
  },
  {
    id: "px-base-90",
    label: "Off-peak · 90 min",
    labelAr: "خارج الذروة · ٩٠ دقيقة",
    priority: 10,
    weekdays: [],
    fromMinute: null,
    toMinute: null,
    courtIds: [],
    courtTags: [],
    tiers: [],
    durations: [90],
    amount: dirhams(130),
    active: true,
  },
  {
    id: "px-base-120",
    label: "Off-peak · 120 min",
    labelAr: "خارج الذروة · ١٢٠ دقيقة",
    priority: 10,
    weekdays: [],
    fromMinute: null,
    toMinute: null,
    courtIds: [],
    courtTags: [],
    tiers: [],
    durations: [120],
    amount: dirhams(170),
    active: true,
  },
  // Evening peak, 18:00–23:00 = minutes 720–1020.
  {
    id: "px-peak-60",
    label: "Evening peak · 60 min",
    labelAr: "ذروة المساء · ٦٠ دقيقة",
    priority: 40,
    weekdays: [],
    fromMinute: 720,
    toMinute: 1020,
    courtIds: [],
    courtTags: [],
    tiers: [],
    durations: [60],
    amount: dirhams(140),
    active: true,
  },
  {
    id: "px-peak-90",
    label: "Evening peak · 90 min",
    labelAr: "ذروة المساء · ٩٠ دقيقة",
    priority: 40,
    weekdays: [],
    fromMinute: 720,
    toMinute: 1020,
    courtIds: [],
    courtTags: [],
    tiers: [],
    durations: [90],
    amount: dirhams(200),
    active: true,
  },
  {
    id: "px-peak-120",
    label: "Evening peak · 120 min",
    labelAr: "ذروة المساء · ١٢٠ دقيقة",
    priority: 40,
    weekdays: [],
    fromMinute: 720,
    toMinute: 1020,
    courtIds: [],
    courtTags: [],
    tiers: [],
    durations: [120],
    amount: dirhams(260),
    active: true,
  },
  // Thursday and Friday evenings carry a premium — the week's busiest slots.
  {
    id: "px-weekend-peak-90",
    label: "Weekend peak · 90 min",
    labelAr: "ذروة نهاية الأسبوع · ٩٠ دقيقة",
    priority: 60,
    weekdays: [4, 5],
    fromMinute: 720,
    toMinute: 1080,
    courtIds: [],
    courtTags: [],
    tiers: [],
    durations: [90],
    amount: dirhams(240),
    active: true,
  },
  // Outdoor court is cheaper at every hour.
  {
    id: "px-outdoor-90",
    label: "Outdoor court · 90 min",
    labelAr: "ملعب خارجي · ٩٠ دقيقة",
    priority: 70,
    weekdays: [],
    fromMinute: null,
    toMinute: null,
    courtIds: [],
    courtTags: ["outdoor"],
    tiers: [],
    durations: [90],
    amount: dirhams(110),
    active: true,
  },
  // Members pay less at peak. Highest priority: tier beats court and hour.
  {
    id: "px-member-peak-90",
    label: "Member · evening peak · 90 min",
    labelAr: "عضو · ذروة المساء · ٩٠ دقيقة",
    priority: 90,
    weekdays: [],
    fromMinute: 720,
    toMinute: 1020,
    courtIds: [],
    courtTags: [],
    tiers: ["member", "premium"],
    durations: [90],
    amount: dirhams(170),
    active: true,
  },
  // Early birds: 06:00–09:00 = minutes 0–180.
  {
    id: "px-early-90",
    label: "Early bird · 90 min",
    labelAr: "الطائر المبكر · ٩٠ دقيقة",
    priority: 50,
    weekdays: [],
    fromMinute: 0,
    toMinute: 180,
    courtIds: [],
    courtTags: [],
    tiers: [],
    durations: [90],
    amount: dirhams(100),
    active: true,
  },
];

export const PROMOS: PromoCode[] = [
  {
    id: "promo-first",
    code: "FIRSTGAME",
    label: "First booking — 25% off",
    labelAr: "أول حجز — خصم ٢٥٪",
    kind: "percent",
    value: 25,
    from: null,
    to: null,
    maxUses: null,
    uses: 47,
    active: true,
  },
  {
    id: "promo-summer",
    code: "SUMMER26",
    label: "Summer indoor — AED 30 off",
    labelAr: "صيف داخلي — خصم ٣٠ درهم",
    kind: "amount",
    value: dirhams(30),
    from: localDate("2026-06-01"),
    to: localDate("2026-09-15"),
    maxUses: 500,
    uses: 212,
    active: true,
  },
  {
    id: "promo-expired",
    code: "RAMADAN26",
    label: "Ramadan nights — 20% off",
    labelAr: "ليالي رمضان — خصم ٢٠٪",
    kind: "percent",
    value: 20,
    from: localDate("2026-02-18"),
    to: localDate("2026-03-19"),
    maxUses: null,
    uses: 388,
    active: true,
  },
];

/**
 * Cancellation tiers. The applicable tier is the largest `hoursBefore` the
 * customer still satisfies — cancelling 50 hours out gets the 48h tier.
 */
export const CANCELLATION_POLICIES: CancellationPolicy[] = [
  {
    id: "cx-48",
    label: "48 hours or more",
    labelAr: "٤٨ ساعة أو أكثر",
    hoursBefore: 48,
    refundPercent: 100,
    outcome: "refund",
    priority: 30,
    active: true,
  },
  {
    id: "cx-12",
    label: "12 to 48 hours",
    labelAr: "من ١٢ إلى ٤٨ ساعة",
    hoursBefore: 12,
    refundPercent: 100,
    outcome: "credit",
    priority: 20,
    active: true,
  },
  {
    id: "cx-4",
    label: "4 to 12 hours",
    labelAr: "من ٤ إلى ١٢ ساعة",
    hoursBefore: 4,
    refundPercent: 50,
    outcome: "credit",
    priority: 10,
    active: true,
  },
  // Under 4 hours no tier matches, so nothing is returned. That is the rule,
  // expressed by absence rather than by a row with 0% — which keeps the UI's
  // "no policy applies" copy honest.
];

export const STAFF: StaffUser[] = [
  {
    id: "usr-owner",
    name: "Layla Al Mheiri",
    nameAr: "ليلى المهيري",
    role: "owner",
    phone: normalisePhone("050 111 2233"),
    active: true,
  },
  {
    id: "usr-manager",
    name: "Omar Haddad",
    nameAr: "عمر حداد",
    role: "manager",
    phone: normalisePhone("055 222 3344"),
    active: true,
  },
  {
    id: "usr-desk-1",
    name: "Rania Saeed",
    nameAr: "رانيا سعيد",
    role: "staff",
    phone: normalisePhone("052 333 4455"),
    active: true,
  },
  {
    id: "usr-desk-2",
    name: "Bilal Karim",
    nameAr: "بلال كريم",
    role: "staff",
    phone: normalisePhone("056 444 5566"),
    active: true,
  },
  {
    id: "usr-coach-1",
    name: "Diego Márquez",
    nameAr: "دييغو ماركيز",
    role: "coach",
    phone: normalisePhone("058 555 6677"),
    active: true,
  },
];

export const COACHES: Coach[] = [
  {
    id: "coa-1",
    name: "Diego Márquez",
    nameAr: "دييغو ماركيز",
    phone: normalisePhone("058 555 6677"),
    commissionPercent: 60,
    active: true,
  },
  {
    id: "coa-2",
    name: "Sara Lindqvist",
    nameAr: "سارة ليندكفيست",
    phone: normalisePhone("058 777 8899"),
    commissionPercent: 55,
    active: true,
  },
  {
    id: "coa-3",
    name: "Youssef Amrani",
    nameAr: "يوسف العمراني",
    phone: normalisePhone("059 888 9900"),
    commissionPercent: 50,
    active: true,
  },
];

export const COACH_AVAILABILITY: CoachAvailability[] = [
  ...[0, 1, 2, 3, 4].map((weekday) => ({
    id: `cav-1-${weekday}`,
    coachId: "coa-1",
    weekday,
    fromMinute: 60,
    toMinute: 720,
  })),
  ...[1, 3, 5].map((weekday) => ({
    id: `cav-2-${weekday}`,
    coachId: "coa-2",
    weekday,
    fromMinute: 600,
    toMinute: 1020,
  })),
  ...[0, 2, 4, 6].map((weekday) => ({
    id: `cav-3-${weekday}`,
    coachId: "coa-3",
    weekday,
    fromMinute: 480,
    toMinute: 960,
  })),
];

export const PRODUCTS: Product[] = [
  { id: "prd-1", sku: "BALL-HEAD-3", name: "Head Padel Pro balls (3)", nameAr: "كرات هيد برو (٣)", category: "consumable", price: dirhams(35), stock: 84, lowStockAt: 24, active: true },
  { id: "prd-2", sku: "GRIP-OVER", name: "Overgrip", nameAr: "شريط المقبض", category: "consumable", price: dirhams(20), stock: 130, lowStockAt: 40, active: true },
  { id: "prd-3", sku: "RENT-RACK", name: "Racket rental", nameAr: "استئجار مضرب", category: "rental", price: dirhams(25), stock: null, lowStockAt: null, active: true },
  { id: "prd-4", sku: "WTR-500", name: "Water 500ml", nameAr: "ماء ٥٠٠ مل", category: "drink", price: dirhams(5), stock: 240, lowStockAt: 60, active: true },
  { id: "prd-5", sku: "ISO-DRINK", name: "Isotonic drink", nameAr: "مشروب رياضي", category: "drink", price: dirhams(12), stock: 96, lowStockAt: 24, active: true },
  { id: "prd-6", sku: "COF-ICE", name: "Iced coffee", nameAr: "قهوة مثلجة", category: "drink", price: dirhams(18), stock: null, lowStockAt: null, active: true },
  { id: "prd-7", sku: "SND-CHK", name: "Chicken sandwich", nameAr: "ساندويتش دجاج", category: "food", price: dirhams(28), stock: 14, lowStockAt: 6, active: true },
  { id: "prd-8", sku: "TEE-KAGU", name: "Kagu club tee", nameAr: "تي شيرت النادي", category: "equipment", price: dirhams(120), stock: 22, lowStockAt: 8, active: true },
  { id: "prd-9", sku: "RACK-BULL", name: "Bullpadel Vertex racket", nameAr: "مضرب بولبادل فيرتكس", category: "equipment", price: dirhams(1_450), stock: 4, lowStockAt: 2, active: true },
  { id: "prd-10", sku: "SOCK-PRO", name: "Padel socks", nameAr: "جوارب بادل", category: "equipment", price: dirhams(35), stock: 3, lowStockAt: 10, active: true },
];

/**
 * Customers. Deliberately includes the messes a real list has: the same person
 * entered twice under different spellings, a blocked no-show, a member with a
 * credit balance from a cancellation, and unrated players.
 */
export const CUSTOMERS: Customer[] = [
  cust("cus-1", "050 123 4567", "Ahmed Al Nasr", "أحمد النصر", 4.5, "premium", dirhams(0), 0, dirhams(18_400)),
  cust("cus-2", "055 234 5678", "Mariam Haddad", "مريم حداد", 3.5, "member", dirhams(240), 1, dirhams(9_120)),
  cust("cus-3", "052 345 6789", "Khalid Omar", "خالد عمر", 5.0, "premium", ZERO, 0, dirhams(24_600)),
  cust("cus-4", "056 456 7890", "Fatima Al Suwaidi", "فاطمة السويدي", 3.0, "member", ZERO, 0, dirhams(6_300)),
  cust("cus-5", "058 567 8901", "Rami Chahine", "رامي شاهين", 4.0, "guest", ZERO, 2, dirhams(1_820)),
  cust("cus-6", "050 678 9012", "Noura Al Kaabi", "نورة الكعبي", 2.5, "member", dirhams(130), 0, dirhams(4_450)),
  cust("cus-7", "055 789 0123", "James Whitfield", null, 4.0, "guest", ZERO, 0, dirhams(2_600)),
  cust("cus-8", "052 890 1234", "Ibrahim Mansour", "إبراهيم منصور", 3.5, "member", ZERO, 1, dirhams(7_800)),
  cust("cus-9", "056 901 2345", "Elena Petrova", null, 5.5, "premium", ZERO, 0, dirhams(31_200)),
  cust("cus-10", "058 012 3456", "Yousef Al Blooshi", "يوسف البلوشي", null, "guest", ZERO, 0, dirhams(390)),
  cust("cus-11", "050 234 6780", "Hessa Al Marri", "حصة المري", 3.0, "member", ZERO, 0, dirhams(5_460)),
  cust("cus-12", "055 345 7891", "Tarek Bishara", "طارق بشارة", 4.5, "premium", ZERO, 0, dirhams(20_150)),
  cust("cus-13", "052 456 8902", "Priya Nair", null, 2.5, "guest", ZERO, 0, dirhams(910)),
  cust("cus-14", "056 567 9013", "Abdulla Al Zaabi", "عبدالله الزعابي", 5.0, "member", ZERO, 0, dirhams(13_650)),
  cust("cus-15", "058 678 0124", "Lina Farouk", "لينا فاروق", 3.5, "member", dirhams(65), 0, dirhams(4_680)),
  cust("cus-16", "050 789 1235", "Marco Bianchi", null, 4.0, "guest", ZERO, 1, dirhams(1_560)),
  cust("cus-17", "055 890 2346", "Shaikha Al Falasi", "شيخة الفلاسي", 2.0, "member", ZERO, 0, dirhams(3_120)),
  cust("cus-18", "052 901 3457", "Hassan Al Rashid", "حسن الراشد", 4.5, "premium", ZERO, 0, dirhams(17_030)),
  cust("cus-19", "056 012 4568", "Dana Aoun", "دانا عون", 3.0, "guest", ZERO, 0, dirhams(650)),
  cust("cus-20", "058 123 5679", "Salem Al Hosani", "سالم الحوسني", 5.5, "premium", ZERO, 0, dirhams(28_080)),
  cust("cus-21", "050 345 7892", "Reem Sultan", "ريم سلطان", 3.5, "member", ZERO, 0, dirhams(5_070)),
  cust("cus-22", "055 456 8903", "Nabil Toure", null, 4.0, "guest", ZERO, 0, dirhams(1_170)),
  cust("cus-23", "052 567 9014", "Aisha Al Muhairi", "عائشة المهيري", 2.5, "member", ZERO, 0, dirhams(2_990)),
  cust("cus-24", "056 678 0125", "Peter Lindgren", null, 4.5, "premium", ZERO, 0, dirhams(15_600)),
  // The same person as cus-1, entered by a different member of staff on the
  // phone. The dedupe screen exists for exactly this row.
  cust("cus-25", "050 123 4567", "Ahmad Alnasr", "احمد النصر", null, "guest", ZERO, 0, dirhams(390)),
  // Blocked after repeated no-shows.
  {
    ...cust("cus-26", "055 999 0000", "Faisal Darwish", "فيصل درويش", 3.0, "guest", ZERO, 5, dirhams(2_340)),
    blocked: true,
    blockedReason: "Five no-shows in eight weeks; blocked by O. Haddad",
  },
];

function cust(
  id: string,
  phone: string,
  name: string,
  nameAr: string | null,
  level: number | null,
  tier: Customer["tier"],
  creditBalance: Customer["creditBalance"],
  noShowCount: number,
  totalSpend: Customer["totalSpend"],
): Customer {
  return {
    id,
    phone: normalisePhone(phone),
    name,
    nameAr,
    email: null,
    level,
    tier,
    creditBalance,
    noShowCount,
    totalSpend,
    blocked: false,
    blockedReason: null,
    notes: "",
    createdAt: new Date("2025-11-01T08:00:00Z"),
  };
}
