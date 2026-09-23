import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export interface SessionPayload {
  sub: string;
  username: string;
  loginMethod: 'local' | 'oidc';
  // Large tokens (idToken, accessToken, refreshToken) are NOT stored here — cookie size limit.
  // idToken + accessToken → oidc_tokens DB table. refreshToken → oidc_rt httpOnly cookie.
  endSessionEndpoint?: string;
  accessTokenExpiresAt?: number; // Unix seconds
  tokenEndpoint?: string;
  jwksUri?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcAuthMethod?: string;
}

export const OIDC_RT_COOKIE = 'oidc_rt';

export function oidcRtCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

const COOKIE_NAME = 'session';
const LOCAL_SESSION_DURATION = 8 * 60 * 60; // 8 hours in seconds

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET env var is not set');
  return new TextEncoder().encode(secret);
}

export function sessionMaxAge(payload: SessionPayload): number {
  if (payload.loginMethod === 'oidc' && payload.accessTokenExpiresAt) {
    const remaining = payload.accessTokenExpiresAt - Math.floor(Date.now() / 1000);
    return Math.max(remaining + 60, 60); // 60s buffer so cookie outlives token slightly
  }
  return LOCAL_SESSION_DURATION;
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  const maxAge = sessionMaxAge(payload);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(payload: SessionPayload) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: sessionMaxAge(payload),
  };
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encrypt(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, sessionCookieOptions(payload));
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
