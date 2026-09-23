import crypto from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface OIDCDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint?: string;
  jwks_uri?: string;
}

export interface OIDCTokens {
  id_token: string;
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

export async function fetchOIDCConfig(wellKnownUrl: string): Promise<OIDCDiscovery> {
  const res = await fetch(wellKnownUrl, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch OIDC discovery document: ${res.status} ${res.statusText}`);
  }
  const doc = await res.json();
  const required = ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint'];
  for (const key of required) {
    if (!doc[key]) throw new Error(`OIDC discovery missing required field: ${key}`);
  }
  return doc as OIDCDiscovery;
}

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(64).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildAuthorizationURL(opts: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge?: string;
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: opts.scope,
    state: opts.state,
  });
  if (opts.codeChallenge) {
    params.set('code_challenge', opts.codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${opts.authorizationEndpoint}?${params.toString()}`;
}

export async function exchangeCode(opts: {
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  authMethod: 'client_secret_basic' | 'client_secret_post' | 'none';
}): Promise<OIDCTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
  });

  if (opts.codeVerifier) {
    body.set('code_verifier', opts.codeVerifier);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (opts.authMethod === 'client_secret_basic') {
    // Credentials in Authorization header — NOT in body
    const credentials = Buffer.from(`${opts.clientId}:${opts.clientSecret ?? ''}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
    body.set('client_id', opts.clientId);
  } else if (opts.authMethod === 'client_secret_post') {
    // Credentials in POST body
    body.set('client_id', opts.clientId);
    if (opts.clientSecret) body.set('client_secret', opts.clientSecret);
  } else {
    // none — public client, only client_id
    body.set('client_id', opts.clientId);
  }

  const res = await fetch(opts.tokenEndpoint, {
    method: 'POST',
    headers,
    body: body.toString(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<OIDCTokens>;
}

export async function verifyAccessTokenJWT(
  accessToken: string,
  jwksUri: string
): Promise<Record<string, unknown>> {
  const JWKS = createRemoteJWKSet(new URL(jwksUri));
  const { payload } = await jwtVerify(accessToken, JWKS);
  return payload as Record<string, unknown>;
}

export async function refreshAccessToken(opts: {
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  authMethod: 'client_secret_basic' | 'client_secret_post' | 'none';
}): Promise<OIDCTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: opts.refreshToken,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (opts.authMethod === 'client_secret_basic') {
    const credentials = Buffer.from(`${opts.clientId}:${opts.clientSecret ?? ''}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
    body.set('client_id', opts.clientId);
  } else if (opts.authMethod === 'client_secret_post') {
    body.set('client_id', opts.clientId);
    if (opts.clientSecret) body.set('client_secret', opts.clientSecret);
  } else {
    body.set('client_id', opts.clientId);
  }

  const res = await fetch(opts.tokenEndpoint, {
    method: 'POST',
    headers,
    body: body.toString(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<OIDCTokens>;
}

export async function fetchUserInfo(
  userinfoEndpoint: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const res = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Userinfo request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function extractEmail(claims: Record<string, unknown>): string {
  const email = claims['email'];
  if (!email || typeof email !== 'string') {
    throw new Error(
      'OIDC provider did not return an email claim. Ensure "email" is included in the requested scope.'
    );
  }
  return email;
}

export function buildEndSessionURL(opts: {
  endSessionEndpoint: string;
  idToken: string;
  postLogoutRedirectUri: string;
}): string {
  const params = new URLSearchParams({
    id_token_hint: opts.idToken,
    post_logout_redirect_uri: opts.postLogoutRedirectUri,
  });
  return `${opts.endSessionEndpoint}?${params.toString()}`;
}
