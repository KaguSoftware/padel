/**
 * Search folding.
 *
 * All list filtering happens in the browser over rows already in memory
 * (PERFORMANCE.md), so this runs on every keystroke and must be cheap.
 *
 * The Arabic rules are not cosmetic. A customer saved as "أحمد" is unfindable
 * by typing "احمد" without alef normalisation, and "احمد" is what a member of
 * staff actually types at speed. The same class of bug as Turkish dotted-i.
 */

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const ALEF = /[آأإٱ]/g; // آ أ إ ٱ
const ALEF_MAQSURA = /ى/g; // ى
const TA_MARBUTA = /ة/g; // ة
const ARABIC_INDIC = /[٠-٩]/g; // ٠-٩
const EASTERN_ARABIC_INDIC = /[۰-۹]/g; // ۰-۹

/** Normalise Arabic-Indic and Eastern Arabic-Indic digits to ASCII. */
export function foldDigits(input: string): string {
  return input
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Fold a string for comparison: case, diacritics, alef/ya/ta-marbuta variants,
 * tatweel, digit systems, and whitespace all collapse.
 */
export function fold(input: string): string {
  return foldDigits(input)
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(ALEF, "ا")
    .replace(ALEF_MAQSURA, "ي")
    .replace(TA_MARBUTA, "ه")
    .replace(/[̀-ͯ]/g, "") // Latin combining marks left by NFKD
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Does `haystack` contain `needle`, both folded? Empty needle matches everything. */
export function foldedIncludes(haystack: string, needle: string): boolean {
  const n = fold(needle);
  return n.length === 0 || fold(haystack).includes(n);
}

/**
 * Customers are identified by phone in practice — names are entered
 * inconsistently, so deduplication is on the number. Normalise to E.164-ish
 * digits with a UAE default so "050 123 4567", "+971501234567" and
 * "٠٥٠١٢٣٤٥٦٧" are one customer.
 */
export function normalisePhone(raw: string, defaultCountry = "971"): string {
  const digits = foldDigits(raw).replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (raw.trim().startsWith("+")) return digits;
  if (digits.startsWith(defaultCountry)) return digits;
  // Local form: drop a leading trunk zero before prefixing the country code.
  return defaultCountry + digits.replace(/^0+/, "");
}

/** Display form for a normalised UAE number: +971 50 123 4567. */
export function formatPhone(normalised: string): string {
  if (normalised.startsWith("971") && normalised.length === 12) {
    const n = normalised;
    return `+971 ${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;
  }
  return normalised ? `+${normalised}` : "";
}

/**
 * A numeric filter bound that is safe against `Number(null) === 0`.
 *
 * A booking with no price yet, a coach with no commission rate, a product with
 * no stock count: each is null, each reads as 0, and 0 passes every max filter
 * as though the thing were free.
 */
export function withinBound(
  value: number | null | undefined,
  min?: number | null,
  max?: number | null,
): boolean {
  if (value === null || value === undefined) return false;
  if (min !== null && min !== undefined && value < min) return false;
  if (max !== null && max !== undefined && value > max) return false;
  return true;
}
