import { NextRequest, NextResponse } from 'next/server';
import { decrypt, encrypt, sessionCookieOptions, OIDC_RT_COOKIE, oidcRtCookieOptions } from '@/lib/session';
import { refreshAccessToken, verifyAccessTokenJWT } from '@/lib/oidc-edge';

const protectedRoutes = ['/userinfo', '/verifying'];
const publicRoutes = ['/login'];

const REFRESH_THRESHOLD_SECONDS = 60;

function expiredRedirect(request: NextRequest): NextResponse {
  const res = NextResponse.redirect(new URL('/login?error=session_expired', request.url));
  res.cookies.delete('session');
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));
  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));

  const token = request.cookies.get('session')?.value;
  const session = await decrypt(token);

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isPublic && session) {
    return NextResponse.redirect(new URL('/userinfo', request.url));
  }

  // Proactive token refresh for OIDC sessions
  if (session?.loginMethod === 'oidc' && session.accessTokenExpiresAt) {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = session.accessTokenExpiresAt - now;
    const refreshToken = request.cookies.get(OIDC_RT_COOKIE)?.value;

    const doRefresh = async (required: boolean): Promise<NextResponse | null> => {
      if (!refreshToken || !session.tokenEndpoint || !session.oidcClientId) {
        return required ? expiredRedirect(request) : null;
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

        const newSession = {
          ...session,
          accessTokenExpiresAt: Math.floor(Date.now() / 1000) + (newTokens.expires_in ?? 3600),
        };

        const newJwt = await encrypt(newSession);
        const newMaxAge = sessionCookieOptions(newSession).maxAge;
        const response = NextResponse.next();
        response.cookies.set('session', newJwt, sessionCookieOptions(newSession));
        const newRt = newTokens.refresh_token ?? refreshToken;
        response.cookies.set(OIDC_RT_COOKIE, newRt, oidcRtCookieOptions(newMaxAge));
        return response;
      } catch {
        return required ? expiredRedirect(request) : null;
      }
    };

    if (expiresIn <= 0) {
      return (await doRefresh(true))!;
    } else if (expiresIn < REFRESH_THRESHOLD_SECONDS) {
      const result = await doRefresh(false);
      if (result) return result;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
