"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { createStaffAccount } from "@/app/actions/account";
import type { Role } from "@/data/types";
import { MIN_PASSWORD_LENGTH } from "@/auth/policy";
import {
  FieldLabel,
  InkButton,
  RuledInput,
  RuledSelect,
} from "@/ui/primitives";

/**
 * Handing out a login.
 *
 * Owner-only, and the action re-checks that server-side rather than trusting
 * this form to have been rendered for the right person — an owner-only screen
 * that guards only in the page is one `fetch` away from not being owner-only.
 *
 * The password is set here rather than emailed, because there is no mail
 * channel in this product yet and inventing one would be a fiction. The person
 * creating the account reads it out and the new member of staff changes it —
 * which is on the scope ledger, not built.
 */
export function NewAccount({
  roleLabels,
  disabled,
  disabledNote,
}: {
  roleLabels: Record<string, string>;
  disabled: boolean;
  disabledNote: string;
}) {
  const t = useTranslations("account");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<
    { tone: "ok" | "bad"; text: string } | null
  >(null);

  const roles: Role[] = ["owner", "manager", "staff", "coach"];

  function onSubmit(form: FormData) {
    setNotice(null);
    startTransition(async () => {
      const res = await createStaffAccount({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        role: String(form.get("role") ?? "staff") as Role as
          | "owner"
          | "manager"
          | "staff"
          | "coach",
        phone: String(form.get("phone") ?? ""),
      });

      if (!res.ok) {
        setNotice({ tone: "bad", text: res.message });
        return;
      }
      setNotice({
        tone: "ok",
        text: t("created", { email: String(form.get("email") ?? "") }),
      });
      router.refresh();
    });
  }

  if (disabled) {
    return (
      <p className="board-label px-5 py-8">
        {disabledNote}
      </p>
    );
  }

  return (
    <form action={onSubmit} className="grid gap-6 px-5 py-6 sm:grid-cols-2">
      <div>
        <FieldLabel htmlFor="acc-name">{t("name")}</FieldLabel>
        <RuledInput id="acc-name" name="name" required disabled={pending} />
      </div>

      <div>
        <FieldLabel htmlFor="acc-phone">{t("phone")}</FieldLabel>
        <RuledInput
          id="acc-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          disabled={pending}
        />
      </div>

      <div>
        <FieldLabel htmlFor="acc-email">{t("email")}</FieldLabel>
        <RuledInput
          id="acc-email"
          name="email"
          type="email"
          inputMode="email"
          required
          disabled={pending}
        />
      </div>

      <div>
        <FieldLabel htmlFor="acc-role">{t("role")}</FieldLabel>
        <RuledSelect id="acc-role" name="role" defaultValue="staff" disabled={pending}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r] ?? r}
            </option>
          ))}
        </RuledSelect>
      </div>

      <div className="sm:col-span-2">
        <FieldLabel htmlFor="acc-password">{t("password")}</FieldLabel>
        <RuledInput
          id="acc-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          disabled={pending}
        />
        <p className="mt-1.5 board-label board-label-sm">
          {t("passwordHint", { min: MIN_PASSWORD_LENGTH })}
        </p>
      </div>

      {/* State is never carried by hue alone (a product principle): the mark
          says which outcome this is, the colour only agrees. A full border, the
          one notice grammar the product uses everywhere else, not a lone edge. */}
      {notice && (
        <p
          role="status"
          className={`flex items-start gap-2.5 border px-3.5 py-2.5 text-[14px] leading-relaxed text-line sm:col-span-2 ${
            notice.tone === "ok"
              ? "border-ball/60 bg-ball/10"
              : "border-clay/70 bg-clay/10"
          }`}
        >
          <span
            aria-hidden
            className={`mt-px shrink-0 font-bold ${
              notice.tone === "ok" ? "text-ball" : "text-clay"
            }`}
          >
            {notice.tone === "ok" ? "✓" : "!"}
          </span>
          <span>{notice.text}</span>
        </p>
      )}

      <div className="sm:col-span-2">
        <InkButton type="submit" variant="primary" disabled={pending}>
          {pending ? t("creating") : t("create")}
        </InkButton>
      </div>
    </form>
  );
}
