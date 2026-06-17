import { NextRequest, NextResponse } from 'next/server';
import pool, { type OIDCConfigRow, type UserRow } from '@/lib/db';
import { createSession } from '@/lib/session';
import { exchangeCode, fetchOIDCConfig, fetchUserInfo, extractEmail } from '@/lib/oidc';

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
  const codeVerifier   = request.cookies.get('oidc_code_verifier')?.value;
  const endSessionEndpoint = request.cookies.get('oidc_end_session_endpoint')?.value ?? '';

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    return NextResponse.redirect(new URL('/login?error=invalid_state', appUrl));
  }

  const { rows: [config] } = await pool.query<OIDCConfigRow>('SELECT * FROM oidc_config WHERE id = 1');

  if (!config?.well_known_url || !config?.client_id) {
    return NextResponse.redirect(new URL('/login?error=oidc_not_configured', appUrl));
  }

  let email: string;
  let idToken: string;

  try {
    const discovery = await fetchOIDCConfig(config.well_known_url);
    const redirectUri = `${appUrl}/api/auth/callback`;

    const tokens = await exchangeCode({
      tokenEndpoint: discovery.token_endpoint,
      clientId: config.client_id,
      clientSecret: config.client_secret || undefined,
      code,
      redirectUri,
      codeVerifier: codeVerifier || undefined,
      authMethod: config.token_endpoint_auth_method ?? 'client_secret_basic',
    });

    idToken = tokens.id_token;

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

  await createSession({
    sub: String(user.id),
    username: user.username,
    loginMethod: 'oidc',
    idToken,
    endSessionEndpoint: endSessionEndpoint || undefined,
  });

  const res = NextResponse.redirect(new URL('/userinfo', appUrl));
  clearOidcCookies(res);
  return res;
}
