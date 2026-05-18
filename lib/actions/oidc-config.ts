'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import pool, { type OIDCConfigRow } from '@/lib/db';
import {
  fetchOIDCConfig,
  generatePKCE,
  generateState,
  buildAuthorizationURL,
} from '@/lib/oidc';

export interface OIDCConfigState {
  error?: string;
  success?: boolean;
}

export async function saveOIDCConfig(
  _prevState: OIDCConfigState | undefined,
  formData: FormData
): Promise<OIDCConfigState> {
  const well_known_url = (formData.get('well_known_url') as string)?.trim();
  const client_id = (formData.get('client_id') as string)?.trim();
  const client_secret = (formData.get('client_secret') as string)?.trim();
  const scope = ((formData.get('scope') as string)?.trim()) || 'openid profile email';
  const enabled = formData.get('enabled') === 'on' ? 1 : 0;

  if (!well_known_url || !client_id || !client_secret) {
    return { error: 'Well-Known URL, Client ID, and Client Secret are required.' };
  }

  try {
    await pool.query(
      `INSERT INTO oidc_config (id, well_known_url, client_id, client_secret, scope, enabled)
       VALUES (1, $1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         well_known_url = EXCLUDED.well_known_url,
         client_id      = EXCLUDED.client_id,
         client_secret  = EXCLUDED.client_secret,
         scope          = EXCLUDED.scope,
         enabled        = EXCLUDED.enabled`,
      [well_known_url, client_id, client_secret, scope, enabled]
    );
  } catch {
    return { error: 'Failed to save configuration. Please try again.' };
  }

  return { success: true };
}

export async function resetOIDCConfig(): Promise<void> {
  await pool.query(`
    UPDATE oidc_config
    SET well_known_url = '', client_id = '', client_secret = '',
        scope = 'openid profile email', enabled = 0
    WHERE id = 1
  `);
}

export async function initiateOIDCLogin(): Promise<void> {
  let config: OIDCConfigRow | undefined;
  try {
    const result = await pool.query<OIDCConfigRow>('SELECT * FROM oidc_config WHERE id = 1');
    config = result.rows[0];
  } catch {
    redirect('/login?error=oidc_not_configured');
  }

  if (!config || !config.enabled || !config.well_known_url || !config.client_id) {
    redirect('/login?error=oidc_not_configured');
  }

  let discovery;
  try {
    discovery = await fetchOIDCConfig(config.well_known_url);
  } catch {
    redirect('/login?error=oidc_discovery_failed');
  }

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/callback`;

  const cookieStore = await cookies();
  const oidcCookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 300,
  };
  cookieStore.set('oidc_state', state, oidcCookieOpts);
  cookieStore.set('oidc_code_verifier', codeVerifier, oidcCookieOpts);
  cookieStore.set('oidc_end_session_endpoint', discovery.end_session_endpoint ?? '', oidcCookieOpts);

  const authUrl = buildAuthorizationURL({
    authorizationEndpoint: discovery.authorization_endpoint,
    clientId: config.client_id,
    redirectUri,
    scope: config.scope,
    state,
    codeChallenge,
  });

  redirect(authUrl);
}
