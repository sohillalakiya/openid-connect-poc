import { cookies } from 'next/headers';
import { verifySession, getUser } from '@/lib/dal';
import pool, { type OIDCTokenRow, type OIDCConfigRow } from '@/lib/db';
import { OIDC_RT_COOKIE } from '@/lib/session';
import Header from '@/components/Header';
import AccessTokenTimer from '@/components/AccessTokenTimer';
import TokenCard from '@/components/TokenCard';
import OIDCConfigButton from '@/components/OIDCConfigButton';

export default async function UserInfoPage() {
  const [session, user, cookieStore, oidcConfigResult] = await Promise.all([
    verifySession(),
    getUser(),
    cookies(),
    pool.query<Pick<OIDCConfigRow, 'well_known_url' | 'client_id' | 'client_secret' | 'scope' | 'enabled' | 'client_type' | 'pkce_enabled' | 'token_endpoint_auth_method'>>(
      'SELECT well_known_url, client_id, client_secret, scope, enabled, client_type, pkce_enabled, token_endpoint_auth_method FROM oidc_config WHERE id = 1'
    ),
  ]);
  if (!user) return null;

  const oidcConfig = oidcConfigResult.rows[0];

  let accessToken = '';
  let refreshToken = '';

  if (session.loginMethod === 'oidc') {
    const { rows: [tokenRow] } = await pool.query<Pick<OIDCTokenRow, 'access_token'>>(
      'SELECT access_token FROM oidc_tokens WHERE user_id = $1',
      [Number(session.sub)]
    );
    accessToken = tokenRow?.access_token ?? '';
    refreshToken = cookieStore.get(OIDC_RT_COOKIE)?.value ?? '';
  }

  const isOIDC = session.loginMethod === 'oidc';
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header username={user.username} />

      <main className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Hero — user identity card */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500" />
          <div className="px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-white text-xl font-bold">{initials}</span>
            </div>
            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{user.username}</h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isOIDC
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOIDC ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                  {isOIDC ? 'SSO / OIDC' : 'Local'}
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
            </div>
            {/* Session stats */}
            <div className="flex flex-wrap gap-4 shrink-0">
              <Stat label="User ID" value={`#${user.id}`} />
              {isOIDC && session.accessTokenExpiresAt && (
                <Stat
                  label="Token Expires In"
                  value={<AccessTokenTimer expiresAt={session.accessTokenExpiresAt} />}
                />
              )}
              {!isOIDC && <Stat label="Session" value="8h local" />}
            </div>
          </div>
        </section>

        {/* Token Inspector — side by side */}
        {isOIDC && (accessToken || refreshToken) && (
          <section>
            <SectionHeader
              title="Token Inspector"
              description="Decoded JWT claims from your current OIDC session"
            />
            <div className="flex flex-col gap-4">
              {accessToken && (
                <TokenCard label="Access Token" token={accessToken} color="purple" />
              )}
              {refreshToken && (
                <TokenCard label="Refresh Token" token={refreshToken} color="amber" />
              )}
            </div>
          </section>
        )}

        {/* Session details */}
        <section>
          <SectionHeader title="Session Details" />
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <Row label="User ID" value={user.id.toString()} />
                <Row label="Username" value={user.username} />
                <Row label="Email" value={user.email} />
                <Row
                  label="Login Method"
                  value={
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isOIDC
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOIDC ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                      {isOIDC ? 'SSO / OIDC' : 'Local'}
                    </span>
                  }
                />
                {isOIDC && (
                  <Row
                    label="Token Expires In"
                    value={<AccessTokenTimer expiresAt={session.accessTokenExpiresAt} />}
                  />
                )}
                {isOIDC && session.tokenEndpoint && (
                  <Row label="Token Endpoint" value={
                    <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 break-all">
                      {session.tokenEndpoint}
                    </span>
                  } />
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Auth flow cards */}
        <section>
          <SectionHeader title="How Login Works" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Card
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              iconColor="text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400"
              title="Local Login"
              steps={[
                'Enter username and password on the login page.',
                'Credentials verified against local database with bcrypt.',
                'Signed JWT session cookie created (8h expiry).',
              ]}
            />
            <Card
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              iconColor="text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400"
              title="SSO / OIDC Login"
              steps={[
                'Redirected to IdP for authentication.',
                'IdP returns auth code; app exchanges for tokens.',
                'Access token verified via JWKS (RFC 7519).',
                'Email matched against local users table.',
                'Session tied to access token expiry; auto-refreshed < 60s before expiry.',
              ]}
            />
          </div>
        </section>

        {/* OIDC Provider Configuration */}
        {oidcConfig && (
          <section>
            <SectionHeader title="OIDC Provider" description="Configure the external identity provider for SSO login" />
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm px-6 py-5 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {oidcConfig.well_known_url || 'Not configured'}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    oidcConfig.enabled
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${oidcConfig.enabled ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                    {oidcConfig.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  {oidcConfig.client_id && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">
                      client: {oidcConfig.client_id}
                    </span>
                  )}
                </div>
              </div>
              <OIDCConfigButton config={oidcConfig} />
            </div>
          </section>
        )}

        {/* Access control warning */}
        <section>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-6 flex gap-4">
            <div className="shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                Database-gated access — no auto-provisioning
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                Regardless of login method, a user must exist in the local database. Local login matches on{' '}
                <strong>username</strong>; SSO matches on <strong>email</strong> from the IdP token.
                New users must be added by an administrator before they can log in.
              </p>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

/* ── helpers ── */

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {description && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="px-6 py-3.5 font-medium text-zinc-500 dark:text-zinc-400 w-44 whitespace-nowrap text-sm">
        {label}
      </td>
      <td className="px-6 py-3.5 text-zinc-900 dark:text-zinc-100 text-sm">{value}</td>
    </tr>
  );
}

function Card({
  icon, iconColor, title, steps,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  steps: string[];
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className={`p-2 rounded-xl ${iconColor}`}>{icon}</span>
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      </div>
      <ol className="flex flex-col gap-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs flex items-center justify-center font-semibold">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
