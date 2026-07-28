"use client";

import { useState, useTransition } from "react";
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
        text: `Account created for ${String(form.get("email") ?? "")}.`,
      });
      router.refresh();
    });
  }

  if (disabled) {
    return (
      <p className="px-4 py-6 font-board text-[11px] uppercase tracking-[0.14em] text-line-dim">
        {disabledNote}
      </p>
    );
  }

  return (
    <form action={onSubmit} className="grid gap-4 px-4 py-5 sm:grid-cols-2">
      <div>
        <FieldLabel htmlFor="acc-name">Name</FieldLabel>
        <RuledInput id="acc-name" name="name" required disabled={pending} />
      </div>

      <div>
        <FieldLabel htmlFor="acc-phone">Phone</FieldLabel>
        <RuledInput
          id="acc-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          disabled={pending}
        />
      </div>

      <div>
        <FieldLabel htmlFor="acc-email">Email</FieldLabel>
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
        <FieldLabel htmlFor="acc-role">Role</FieldLabel>
        <RuledSelect id="acc-role" name="role" defaultValue="staff" disabled={pending}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r] ?? r}
            </option>
          ))}
        </RuledSelect>
      </div>

      <div className="sm:col-span-2">
        <FieldLabel htmlFor="acc-password">Password</FieldLabel>
        <RuledInput
          id="acc-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          disabled={pending}
        />
        <p className="mt-1.5 font-board text-[10px] uppercase tracking-[0.14em] text-line-dim">
          At least {MIN_PASSWORD_LENGTH} characters · read it out, they change it
        </p>
      </div>

      {notice && (
        <p
          role="status"
          className={`sm:col-span-2 border-s-2 px-3 py-2 font-board text-[12px] leading-relaxed ${
            notice.tone === "ok"
              ? "border-s-ball bg-line/5 text-line"
              : "border-s-clay bg-clay/10 text-line"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="sm:col-span-2">
        <InkButton type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </InkButton>
      </div>
    </form>
  );
}
