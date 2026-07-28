import { setRequestLocale } from "next-intl/server";
import { CourtLines } from "@/ui/court";
import { AuthForm } from "../AuthForm";
import { signUpCopy } from "../copy";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const copy = signUpCopy(locale === "ar");

  return (
    <main className="court-world court-surface relative min-h-dvh overflow-hidden">
      <CourtLines className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] w-full text-line/15" />

      <div className="relative mx-auto w-full max-w-md px-5 py-16">
        <h1 className="painted text-[clamp(2rem,7vw,3rem)]">{copy.title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-line/80">
          {copy.intro}
        </p>

        <AuthForm mode="sign-up" copy={copy} switchHref="/account/sign-in" />
      </div>
    </main>
  );
}
