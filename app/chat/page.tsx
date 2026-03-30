"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/lib/auth";
import { useAuthGuard } from "@/app/lib/useAuthGuard";

export default function ChatPlaceholder() {
  const router = useRouter();
  const { session, status } = useAuthGuard({ mode: "required" });
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  if (status === "loading") {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/65 shadow-[var(--shadow-md)] backdrop-blur">
            Restoring your session...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[var(--shadow-md)] backdrop-blur">
          <h1 className="text-xl font-semibold text-white">Chat</h1>
          <p className="mt-2 text-sm text-white/65">
            Login is wired. Next step: we’ll bring back the full chat UI.
          </p>
          {session && (
            <p className="mt-3 text-xs text-white/55">
              Signed in as{" "}
              <span className="text-white/75">{session.user.email}</span>
            </p>
          )}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setIsSigningOut(true);
                void signOut().finally(() => {
                  router.replace("/login");
                  setIsSigningOut(false);
                });
              }}
              disabled={isSigningOut}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
