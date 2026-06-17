'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
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
  const client_secret = (formData.get('client_secret') as string)?.trim() ?? '';
  const scope = ((formData.get('scope') as string)?.trim()) || 'openid profile email';
  const enabled = formData.get('enabled') === 'on' ? 1 : 0;
  const client_type = (formData.get('client_type') as string) === 'public' ? 'public' : 'confidential';
  const pkce_enabled = formData.get('pkce_enabled') === 'on' ? 1 : 0;
  const raw_auth_method = formData.get('token_endpoint_auth_method') as string;
  const allowed_methods = ['client_secret_basic', 'client_secret_post', 'none'] as const;
  const token_endpoint_auth_method = (allowed_methods as readonly string[]).includes(raw_auth_method)
    ? raw_auth_method
    : 'client_secret_basic';

  if (!well_known_url || !client_id) {
    return { error: 'Well-Known URL and Client ID are required.' };
  }

  if (client_type === 'confidential' && token_endpoint_auth_method !== 'none' && !client_secret) {
    return { error: 'Client Secret is required for confidential clients.' };
  }

  if (client_type === 'public' && pkce_enabled === 0) {
    return { error: 'PKCE must be enabled for public clients.' };
  }

  try {
    await pool.query(
      `INSERT INTO oidc_config (id, well_known_url, client_id, client_secret, scope, enabled,
         client_type, pkce_enabled, token_endpoint_auth_method)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         well_known_url             = EXCLUDED.well_known_url,
         client_id                  = EXCLUDED.client_id,
         client_secret              = EXCLUDED.client_secret,
         scope                      = EXCLUDED.scope,
         enabled                    = EXCLUDED.enabled,
         client_type                = EXCLUDED.client_type,
         pkce_enabled               = EXCLUDED.pkce_enabled,
         token_endpoint_auth_method = EXCLUDED.token_endpoint_auth_method`,
      [well_known_url, client_id, client_secret, scope, enabled,
        client_type, pkce_enabled, token_endpoint_auth_method]
    );
  } catch {
    return { error: 'Failed to save configuration. Please try again.' };
  }

  revalidatePath('/userinfo');
  return { success: true };
}

export async function resetOIDCConfig(
  _prevState: OIDCConfigState | undefined,
  _formData: FormData
): Promise<OIDCConfigState> {
  try {
    await pool.query(`
      UPDATE oidc_config
      SET well_known_url = '', client_id = '', client_secret = '',
          scope = 'openid profile email', enabled = 0,
          client_type = 'confidential', pkce_enabled = 1,
          token_endpoint_auth_method = 'client_secret_basic'
      WHERE id = 1
    `);
  } catch {
    return { error: 'Failed to reset configuration.' };
  }
  revalidatePath('/userinfo');
  return { success: true };
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

  const usePkce = config.pkce_enabled !== 0;
  const state = generateState();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/callback`;

  let codeVerifier = '';
  let codeChallenge: string | undefined;
  if (usePkce) {
    ({ codeVerifier, codeChallenge } = generatePKCE());
  }

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
