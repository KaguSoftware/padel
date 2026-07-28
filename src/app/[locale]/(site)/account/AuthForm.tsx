"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { signIn, signUp } from "@/app/actions/account";
import { Link } from "@/i18n/routing";
import { FieldLabel, InkButton, RuledInput } from "@/ui/primitives";

/**
 * Getting in, and getting an account.
 *
 * One component for both because they are the same object at different lengths
 * — the same fields in the same order, the same failure line in the same place.
 * Two separate forms drift, and the one nobody is looking at is the one that
 * ends up with the error message in a different spot.
 *
 * The form posts through a server action, so it works before hydration and the
 * password never lands in a client-side fetch this file has to get right.
 */

export interface AuthCopy {
  title: string;
  intro: string;
  name: string;
  phone: string;
  phoneHint: string;
  email: string;
  password: string;
  passwordHint: string;
  submit: string;
  working: string;
  switchPrompt: string;
  switchAction: string;
}

export function AuthForm({
  mode,
  copy,
  switchHref,
}: {
  mode: "sign-in" | "sign-up";
  copy: AuthCopy;
  switchHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const joining = mode === "sign-up";

  function onSubmit(form: FormData) {
    setError(null);
    startTransition(async () => {
      const res = joining
        ? await signUp({
            name: String(form.get("name") ?? ""),
            phone: String(form.get("phone") ?? ""),
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          })
        : await signIn({
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          });

      if (!res.ok) {
        setError(res.message);
        return;
      }
      // Staff land where they work; a player lands on their own account.
      const to =
        !joining && res.data && "role" in res.data && res.data.role !== "player"
          ? "/admin/calendar"
          : "/play/account";
      router.push(to);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="mt-8 flex flex-col gap-5">
      {joining && (
        <div>
          <FieldLabel htmlFor="name">{copy.name}</FieldLabel>
          <RuledInput
            id="name"
            name="name"
            autoComplete="name"
            required
            disabled={pending}
          />
        </div>
      )}

      {joining && (
        <div>
          <FieldLabel htmlFor="phone">{copy.phone}</FieldLabel>
          <RuledInput
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            disabled={pending}
          />
          <p className="mt-1.5 font-board text-[10px] uppercase tracking-[0.14em] text-line-dim">
            {copy.phoneHint}
          </p>
        </div>
      )}

      <div>
        <FieldLabel htmlFor="email">{copy.email}</FieldLabel>
        <RuledInput
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          disabled={pending}
        />
      </div>

      <div>
        <FieldLabel htmlFor="password">{copy.password}</FieldLabel>
        <RuledInput
          id="password"
          name="password"
          type="password"
          autoComplete={joining ? "new-password" : "current-password"}
          required
          disabled={pending}
        />
        {joining && (
          <p className="mt-1.5 font-board text-[10px] uppercase tracking-[0.14em] text-line-dim">
            {copy.passwordHint}
          </p>
        )}
      </div>

      {/* The refusal sits with the form, not at the top of the page, and it
          names what to do next rather than only what went wrong. A full clay
          border, the way every other notice in the product is drawn — a single
          coloured edge is the SaaS alert cliché, and this world has one alert
          grammar, not two. */}
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2.5 border border-clay/70 bg-clay/10 px-3.5 py-2.5 font-board text-[12px] leading-relaxed text-line"
        >
          <span aria-hidden className="mt-px shrink-0 font-bold text-clay">!</span>
          <span>{error}</span>
        </p>
      )}

      <InkButton type="submit" variant="primary" disabled={pending}>
        {pending ? copy.working : copy.submit}
      </InkButton>

      <p className="font-board text-[11px] uppercase tracking-[0.14em] text-line-dim">
        {copy.switchPrompt}{" "}
        <Link href={switchHref} className="text-ball hover:underline">
          {copy.switchAction}
        </Link>
      </p>
    </form>
  );
}
