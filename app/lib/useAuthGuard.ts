"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { type AuthSession, getFreshSession } from "@/app/lib/auth";

type AuthGuardMode = "guest" | "required";

type AuthStatus = "authenticated" | "loading" | "unauthenticated";

type UseAuthGuardOptions = {
  mode: AuthGuardMode;
};

type UseAuthGuardResult = {
  session: AuthSession | null;
  status: AuthStatus;
};

export function useAuthGuard({
  mode,
}: UseAuthGuardOptions): UseAuthGuardResult {
  const router = useRouter();
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>("loading");

  React.useEffect(() => {
    let isActive = true;

    void (async () => {
      const nextSession = await getFreshSession();
      if (!isActive) return;

      if (nextSession) {
        setSession(nextSession);
        setStatus("authenticated");

        if (mode === "guest") {
          router.replace("/chat");
        }
        return;
      }

      setSession(null);
      setStatus("unauthenticated");

      if (mode === "required") {
        router.replace("/login");
      }
    })();

    return () => {
      isActive = false;
    };
  }, [mode, router]);

  return { session, status };
}
