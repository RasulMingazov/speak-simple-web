import { NextResponse } from "next/server";

type ExchangeRequest = {
  provider?: string;
  code?: string;
};

type ErrorResponse = {
  error?: string;
  message?: string;
};

export async function POST(req: Request) {
  let body: ExchangeRequest | null = null;
  try {
    body = (await req.json()) as ExchangeRequest;
  } catch {
    // ignore
  }

  if (body?.provider !== "google" || !body.code) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "provider='google' and code are required",
      },
      { status: 400 }
    );
  }

  const backendUrl = `${getBackendBaseUrl()}/api/v1/auth/google/exchange`;

  try {
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        payload ?? {
          error: "internal_error",
          message: "Authentication backend returned an invalid response",
        },
        { status: response.status }
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Authentication backend is unavailable",
      } satisfies ErrorResponse,
      { status: 500 }
    );
  }
}

function getBackendBaseUrl() {
  return process.env.BACKEND_URL?.replace(/\/+$/, "") ?? "http://localhost:8080";
}

