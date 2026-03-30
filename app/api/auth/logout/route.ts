import { NextResponse } from "next/server";

type LogoutRequest = {
  refreshToken?: string;
};

type ErrorResponse = {
  error?: string;
  message?: string;
};

export async function POST(req: Request) {
  let body: LogoutRequest | null = null;
  try {
    body = (await req.json()) as LogoutRequest;
  } catch {
    // ignore
  }

  if (!body?.refreshToken) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "refreshToken is required",
      },
      { status: 400 }
    );
  }

  const backendUrl = `${getBackendBaseUrl()}/api/v1/auth/logout`;

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

    if (response.status === 204) {
      return new Response(null, { status: 204 });
    }

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

    return new Response(null, { status: 204 });
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
