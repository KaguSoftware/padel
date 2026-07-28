import { MIN_PASSWORD_LENGTH } from "@/auth/policy";
import type { AuthCopy } from "./AuthForm";

/**
 * The words on the two auth screens, both languages, in one file.
 *
 * Arabic is a first-class direction here rather than a translation layer, so
 * the two read as written rather than converted — "ادخل" is what a sign-in
 * button says in Arabic, not a rendering of "sign in".
 */

export function signUpCopy(ar: boolean): AuthCopy {
  return ar
    ? {
        title: "أنشئ حساباً",
        intro:
          "احجز أسرع، تابع مبارياتك، وانضم إلى المباريات المفتوحة. رقم الهاتف هو ما يعرفك به النادي.",
        name: "الاسم",
        phone: "رقم الهاتف",
        phoneHint: "إن سبق أن حجز لك النادي بهذا الرقم، سنربط سجلك الحالي",
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        passwordHint: `${MIN_PASSWORD_LENGTH} أحرف على الأقل`,
        submit: "أنشئ الحساب",
        working: "جارٍ الإنشاء…",
        switchPrompt: "لديك حساب؟",
        switchAction: "سجّل الدخول",
      }
    : {
        title: "Create an account",
        intro:
          "Book faster, keep your entries in one place, and join open matches. Your phone number is what the club knows you by.",
        name: "Name",
        phone: "Phone",
        phoneHint: "If the club has booked you in on this number, we'll link your existing record",
        email: "Email",
        password: "Password",
        passwordHint: `At least ${MIN_PASSWORD_LENGTH} characters`,
        submit: "Create account",
        working: "Creating…",
        switchPrompt: "Already have one?",
        switchAction: "Sign in",
      };
}

export function signInCopy(ar: boolean): AuthCopy {
  return ar
    ? {
        title: "سجّل الدخول",
        intro: "للاعبين والعاملين في النادي على حد سواء.",
        name: "الاسم",
        phone: "رقم الهاتف",
        phoneHint: "",
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        passwordHint: "",
        submit: "دخول",
        working: "جارٍ الدخول…",
        switchPrompt: "ليس لديك حساب؟",
        switchAction: "أنشئ حساباً",
      }
    : {
        title: "Sign in",
        intro: "For players and for anyone who works here.",
        name: "Name",
        phone: "Phone",
        phoneHint: "",
        email: "Email",
        password: "Password",
        passwordHint: "",
        submit: "Sign in",
        working: "Signing in…",
        switchPrompt: "No account yet?",
        switchAction: "Create one",
      };
}
