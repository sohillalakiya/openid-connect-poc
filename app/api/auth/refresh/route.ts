import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  decrypt,
  encrypt,
  sessionCookieOptions,
  OIDC_RT_COOKIE,
  oidcRtCookieOptions,
} from '@/lib/session';
import { refreshAccessToken, verifyAccessTokenJWT } from '@/lib/oidc-edge';

export async function POST(request: NextRequest): Promise<Response> {
  const token = request.cookies.get('session')?.value;
  const session = await decrypt(token);

  if (!session || session.loginMethod !== 'oidc') {
    return NextResponse.json({ error: 'not_oidc_session' }, { status: 400 });
  }

  const refreshToken = request.cookies.get(OIDC_RT_COOKIE)?.value;

  if (!refreshToken || !session.tokenEndpoint || !session.oidcClientId) {
    return NextResponse.json({ error: 'no_refresh_token' }, { status: 400 });
  }

  try {
    const newTokens = await refreshAccessToken({
      tokenEndpoint: session.tokenEndpoint,
      clientId: session.oidcClientId,
      clientSecret: session.oidcClientSecret,
      refreshToken,
      authMethod: (session.oidcAuthMethod ?? 'client_secret_basic') as
        'client_secret_basic' | 'client_secret_post' | 'none',
    });

    if (session.jwksUri) {
      await verifyAccessTokenJWT(newTokens.access_token, session.jwksUri);
    }

    // Update DB with new access token
    await pool.query(
      'UPDATE oidc_tokens SET access_token = $1, updated_at = NOW() WHERE user_id = $2',
      [newTokens.access_token, Number(session.sub)]
    );

    const newExpiresAt =
      Math.floor(Date.now() / 1000) + (newTokens.expires_in ?? 3600);
    const newSession = { ...session, accessTokenExpiresAt: newExpiresAt };
    const newJwt = await encrypt(newSession);
    const cookieOpts = sessionCookieOptions(newSession);

    const response = NextResponse.json({ accessTokenExpiresAt: newExpiresAt });
    response.cookies.set('session', newJwt, cookieOpts);
    response.cookies.set(
      OIDC_RT_COOKIE,
      newTokens.refresh_token ?? refreshToken,
      oidcRtCookieOptions(cookieOpts.maxAge)
    );
    return response;
  } catch {
    return NextResponse.json({ error: 'refresh_failed' }, { status: 401 });
  }
}
