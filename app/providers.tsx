"use client";

import React from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

export function Providers({
  children,
  googleClientId,
}: {
  children: React.ReactNode;
  googleClientId: string;
}) {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {children}
    </GoogleOAuthProvider>
  );
}

