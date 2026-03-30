"use client";

import { GoogleLoginButton } from "@/app/components/GoogleLoginButton";
import { LogoIcon } from "@/app/components/icons/LogoIcon";
import { useAuthGuard } from "@/app/lib/useAuthGuard";

export default function LoginPage() {
  const { status } = useAuthGuard({ mode: "guest" });

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-14">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white/65 shadow-[var(--shadow-md)] backdrop-blur">
          Checking your session...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center px-6 py-14">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white/85">
              <LogoIcon className="h-4 w-4" />
            </span>
            SpeakSimple
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Sound natural. Fast
          </h1>
          <p className="max-w-xl text-sm text-white/65">
            Record a voice message. Get instant corrections, tips, and a fluency
            score.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Audio messages", "Instant feedback", "Smooth UX"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        <section className="se-gradient-border rounded-3xl bg-white/5 p-7 shadow-[var(--shadow-lg)] backdrop-blur">
          <div className="space-y-2 text-center">
            <p className="text-xl font-semibold text-white sm:text-2xl">
              Welcome
            </p>
            <p className="mx-auto max-w-sm text-sm text-white/65">
              Sign in to continue to your practice room.
            </p>
          </div>
          <div className="mt-6 flex justify-center">
            <GoogleLoginButton />
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-white/55">
            By continuing, you agree to the agreements.
          </p>
        </section>
      </div>
    </main>
  );
}
