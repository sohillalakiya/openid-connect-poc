import { NextRequest, NextResponse } from 'next/server';
import pool, { type OIDCConfigRow, type UserRow } from '@/lib/db';
import { createSession, sessionMaxAge, OIDC_RT_COOKIE, oidcRtCookieOptions } from '@/lib/session';
import { exchangeCode, fetchOIDCConfig, fetchUserInfo, extractEmail } from '@/lib/oidc';
import { verifyAccessTokenJWT } from '@/lib/oidc-edge';

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDesc ?? error)}`, appUrl)
    );
  }

  const storedState    = request.cookies.get('oidc_state')?.value;
  const codeVerifier   = request.cookies.get('oidc_code_verifier')?.value ?? '';
  const endSessionEndpoint = request.cookies.get('oidc_end_session_endpoint')?.value ?? '';

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/login?error=invalid_state', appUrl));
  }

  const { rows: [config] } = await pool.query<OIDCConfigRow>('SELECT * FROM oidc_config WHERE id = 1');

  if (!config?.well_known_url || !config?.client_id) {
    return NextResponse.redirect(new URL('/login?error=oidc_not_configured', appUrl));
  }

  let email: string;
  let idToken: string;
  let accessToken: string;
  let refreshToken: string | undefined;
  let accessTokenExpiresAt: number;
  let tokenEndpoint: string;
  let jwksUri: string | undefined;

  try {
    const discovery = await fetchOIDCConfig(config.well_known_url);
    const redirectUri = `${appUrl}/api/auth/callback`;
    const authMethod = config.token_endpoint_auth_method ?? 'client_secret_basic';

    const tokens = await exchangeCode({
      tokenEndpoint: discovery.token_endpoint,
      clientId: config.client_id,
      clientSecret: config.client_secret || undefined,
      code,
      redirectUri,
      codeVerifier: codeVerifier || undefined,
      authMethod,
    });

    idToken = tokens.id_token;
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    accessTokenExpiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600);
    tokenEndpoint = discovery.token_endpoint;
    jwksUri = discovery.jwks_uri;

    if (jwksUri) {
      try {
        await verifyAccessTokenJWT(accessToken, jwksUri);
      } catch (verifyErr) {
        console.warn('[OIDC] Access token JWT verification failed (non-blocking):', verifyErr);
      }
    }

    const userinfo = await fetchUserInfo(discovery.userinfo_endpoint, tokens.access_token);
    email = extractEmail(userinfo);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'oidc_error';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, appUrl)
    );
  }

  const { rows: [user] } = await pool.query<Pick<UserRow, 'id' | 'username' | 'email'>>(
    'SELECT id, username, email FROM users WHERE email = $1',
    [email]
  );

  const clearOidcCookies = (res: NextResponse) => {
    res.cookies.set('oidc_state', '', { maxAge: 0, path: '/' });
    res.cookies.set('oidc_code_verifier', '', { maxAge: 0, path: '/' });
    res.cookies.set('oidc_end_session_endpoint', '', { maxAge: 0, path: '/' });
    return res;
  };

  if (!user) {
    const errorPayload = JSON.stringify({
      message: `No account found for email: ${email}. Contact your administrator.`,
      endSessionEndpoint,
      idToken,
    });

    const res = NextResponse.redirect(new URL('/oidc-error', appUrl));
    clearOidcCookies(res);
    res.cookies.set('oidc_error', errorPayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60,
    });
    return res;
  }

  // Store large tokens in DB (keeps session cookie small)
  await pool.query(
    `INSERT INTO oidc_tokens (user_id, access_token, id_token, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       id_token     = EXCLUDED.id_token,
       updated_at   = NOW()`,
    [user.id, accessToken, idToken]
  );

  const sessionPayload = {
    sub: String(user.id),
    username: user.username,
    loginMethod: 'oidc' as const,
    endSessionEndpoint: endSessionEndpoint || undefined,
    accessTokenExpiresAt,
    tokenEndpoint,
    jwksUri,
    oidcClientId: config.client_id,
    oidcClientSecret: config.client_secret || undefined,
    oidcAuthMethod: config.token_endpoint_auth_method ?? 'client_secret_basic',
  };

  await createSession(sessionPayload);

  const res = NextResponse.redirect(new URL('/verifying', appUrl));
  clearOidcCookies(res);

  // Refresh token in its own small cookie (readable by middleware without DB)
  if (refreshToken) {
    res.cookies.set(OIDC_RT_COOKIE, refreshToken, oidcRtCookieOptions(sessionMaxAge(sessionPayload)));
  }

  return res;
}
