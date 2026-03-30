export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  user: AppUser;
}

type AuthSessionPayload = Omit<AuthSession, "expiresAt">;

let currentSession: AuthSession | null = null;
const STORAGE_KEY = "speaksimple_session";
const REFRESH_LEEWAY_MS = 60_000;

function saveToStorage(session: AuthSession | null) {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function loadFromStorage(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeStoredSession(JSON.parse(raw) as Partial<AuthSession>);
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode(code: string): Promise<AuthSession> {
  const session = await requestAuthSession("/api/auth/exchange", {
    provider: "google",
    code,
  });
  currentSession = session;
  saveToStorage(session);
  return session;
}

export async function getFreshSession(): Promise<AuthSession | null> {
  const session = getCurrentSession();
  if (!session) return null;
  if (!shouldRefresh(session)) return session;

  try {
    const refreshedSession = await requestAuthSession("/api/auth/refresh", {
      refreshToken: session.refreshToken,
    });
    currentSession = refreshedSession;
    saveToStorage(refreshedSession);
    return refreshedSession;
  } catch {
    clearSession();
    return null;
  }
}

export function getCurrentSession(): AuthSession | null {
  if (typeof window !== "undefined" && !currentSession) {
    currentSession = loadFromStorage();
  }
  return currentSession;
}

export function getCurrentUser(): AppUser | null {
  return getCurrentSession()?.user ?? null;
}

export function clearSession() {
  currentSession = null;
  if (typeof window !== "undefined") saveToStorage(null);
}

export async function signOut(): Promise<void> {
  const session = getCurrentSession();

  try {
    if (session?.refreshToken) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    }
  } finally {
    clearSession();
  }
}

async function requestAuthSession(
  path: string,
  body: Record<string, string>
): Promise<AuthSession> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await getErrorMessage(res));
  }

  const payload = (await res.json()) as AuthSessionPayload;
  return toAuthSession(payload);
}

async function getErrorMessage(response: Response): Promise<string> {
  let message = "Sign-in failed";
  try {
    const data = (await response.json()) as { message?: string };
    if (data?.message) message = data.message;
  } catch {
    // ignore
  }
  return message;
}

function toAuthSession(payload: AuthSessionPayload): AuthSession {
  return {
    ...payload,
    expiresAt: Date.now() + payload.expiresIn * 1000,
  };
}

function normalizeStoredSession(session: Partial<AuthSession>): AuthSession | null {
  if (
    !session.accessToken ||
    !session.refreshToken ||
    typeof session.expiresIn !== "number" ||
    !session.user
  ) {
    return null;
  }

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    expiresAt:
      typeof session.expiresAt === "number"
        ? session.expiresAt
        : Date.now() + session.expiresIn * 1000,
    user: session.user,
  };
}

function shouldRefresh(session: AuthSession): boolean {
  return session.expiresAt - Date.now() <= REFRESH_LEEWAY_MS;
}

