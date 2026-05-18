import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/session';
import { buildEndSessionURL } from '@/lib/oidc';

export async function GET(request: NextRequest): Promise<Response> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const token = request.cookies.get('session')?.value;
  const session = await decrypt(token);

  // Also read oidc_error cookie for the error-page sign-out path
  const oidcErrorRaw = request.cookies.get('oidc_error')?.value;

  let endSessionEndpoint: string | undefined;
  let idToken: string | undefined;

  if (session?.loginMethod === 'oidc') {
    endSessionEndpoint = session.endSessionEndpoint;
    idToken = session.idToken;
  } else if (oidcErrorRaw) {
    try {
      const parsed = JSON.parse(oidcErrorRaw);
      endSessionEndpoint = parsed.endSessionEndpoint;
      idToken = parsed.idToken;
    } catch {
      // ignore parse error
    }
  }

  const loginUrl = new URL('/login', appUrl);

  let redirectTarget: string = loginUrl.toString();

  if (endSessionEndpoint && idToken) {
    redirectTarget = buildEndSessionURL({
      endSessionEndpoint,
      idToken,
      postLogoutRedirectUri: loginUrl.toString(),
    });
  }

  const res = NextResponse.redirect(redirectTarget);
  res.cookies.set('session', '', { maxAge: 0, path: '/' });
  res.cookies.set('oidc_error', '', { maxAge: 0, path: '/' });
  return res;
}
