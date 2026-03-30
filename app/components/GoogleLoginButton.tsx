"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { exchangeGoogleCode } from "@/app/lib/auth";

export function GoogleLoginButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const login = useGoogleLogin({
    flow: "auth-code",
    scope: "openid email profile",
    onSuccess: async (tokenResponse) => {
      setError(null);
      setLoading(true);
      try {
        await exchangeGoogleCode(tokenResponse.code);
        router.push("/chat");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed");
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setLoading(false);
      setError("Google sign-in failed");
    },
  });

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setLoading(true);
          login();
        }}
        disabled={loading}
        className="se-gradient-border w-full rounded-2xl bg-white/5 px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-sm)] backdrop-blur transition hover:bg-white/10 active:scale-[0.99] disabled:opacity-60"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <GoogleIcon className="h-[18px] w-[18px]" />
          <span>{loading ? "Signing in…" : "Continue with Google"}</span>
        </span>
      </button>
      {error && <p className="mt-2 text-xs text-white/60">{error}</p>}
    </div>
  );
}

function GoogleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M44.5 20H24v8.5h11.7C34.6 34.7 30 38 24 38c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.5 0 6.7 1.4 9.1 3.6l6-6C35.4 6.3 29.9 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20c10.5 0 20-7.6 20-20 0-1.3-.1-2.3-.4-4Z"
        fill="#FFC107"
      />
      <path
        d="M6.3 14.7l7 5.1C15.2 15.1 19.2 12 24 12c3.5 0 6.7 1.4 9.1 3.6l6-6C35.4 6.3 29.9 4 24 4 16.3 4 9.6 8.3 6.3 14.7Z"
        fill="#FF3D00"
      />
      <path
        d="M24 44c5.8 0 11.2-2.2 15.2-6.1l-6.9-5.7C30 34.4 27.2 35.5 24 35.5c-6 0-10.6-3.3-12.3-8.2l-7.1 5.5C7.9 39.5 15.4 44 24 44Z"
        fill="#4CAF50"
      />
      <path
        d="M44.5 20H24v8.5h11.7c-.8 2.2-2.2 4.1-4.1 5.4l.0.0 6.9 5.7C41.8 36.5 44 31.8 44 24c0-1.3-.1-2.3-.4-4Z"
        fill="#1976D2"
      />
    </svg>
  );
}

