import { createRemoteJWKSet, jwtVerify } from 'jose';

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
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  token_type: string;
}> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: opts.refreshToken,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (opts.authMethod === 'client_secret_basic') {
    // btoa is Edge-compatible; Buffer is not
    const credentials = btoa(`${opts.clientId}:${opts.clientSecret ?? ''}`);
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
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}
