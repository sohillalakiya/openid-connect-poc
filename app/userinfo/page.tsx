import { verifySession, getUser } from '@/lib/dal';
import Header from '@/components/Header';

export default async function UserInfoPage() {
  const session = await verifySession();
  const user = await getUser();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header username={user.username} />

      <main className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-10">

        {/* Current session */}
        <section>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            Current Session
          </h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <Row label="User ID" value={user.id.toString()} />
                <Row label="Username" value={user.username} />
                <Row label="Email" value={user.email} />
                <Row
                  label="Login Method"
                  value={
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        session.loginMethod === 'oidc'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}
                    >
                      {session.loginMethod === 'oidc' ? 'SSO / OIDC' : 'Local'}
                    </span>
                  }
                />
              </tbody>
            </table>
          </div>
        </section>

        {/* How login works */}
        <section>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            How Login Works
          </h2>
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
                'Enter your username and password on the login page.',
                'Credentials are verified against the local database.',
                'Password is stored as a bcrypt hash — never in plain text.',
                'A signed JWT session cookie is created on success (8 h expiry).',
                'Only users present in the database can log in.',
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
                'Click "Login with OIDC" (visible only when OIDC is enabled).',
                'You are redirected to your Identity Provider (IdP) for authentication.',
                'After successful IdP auth, the IdP redirects back with an authorization code.',
                'The app exchanges the code for tokens and retrieves your email from the IdP.',
                'Your email is looked up in the local database — access is granted only if a matching user exists.',
                'Signing out also closes your session on the IdP via the end_session endpoint.',
              ]}
            />
          </div>
        </section>

        {/* Access control rule */}
        <section>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            Access Control
          </h2>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-6 flex gap-4">
            <div className="shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Database-gated access — no auto-provisioning
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                Regardless of the login method, a user must exist in the local database to be granted a session.
                For local login the <strong>username</strong> is matched; for SSO the <strong>email address</strong> returned
                by the Identity Provider is matched against the email stored in the database.
                If no match is found the login is rejected and the user is shown an error page.
                New users must be added to the database by an administrator before they can log in.
              </p>
            </div>
          </div>
        </section>

        {/* How to integrate OIDC */}
        <section>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            How to Integrate OIDC
          </h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800">
            <Step n={1} title='Open the "Integrate OIDC" modal'>
              Click the <strong>Integrate OIDC</strong> button in the top-right header.
            </Step>
            <Step n={2} title="Register a client in your Identity Provider">
              Create an OAuth 2.0 / OIDC application in your IdP (Keycloak, Okta, Azure AD, Auth0, etc.).
              Set the <strong>redirect URI</strong> to:
              <code className="block mt-2 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-mono break-all">
                {process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/auth/callback
              </code>
            </Step>
            <Step n={3} title="Fill in the configuration form">
              <ul className="mt-2 flex flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <Li><strong>Well-Known URL</strong> — the discovery document endpoint of your IdP, e.g.{' '}
                  <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">
                    https://your-idp.example.com/realms/myrealm/.well-known/openid-configuration
                  </code>
                </Li>
                <Li><strong>Client ID</strong> — the client identifier assigned by your IdP.</Li>
                <Li><strong>Client Secret</strong> — the client secret (keep this confidential).</Li>
                <Li><strong>Scope</strong> — must include <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">email</code> so the IdP returns the user&apos;s email address. Default: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">openid profile email</code>.</Li>
              </ul>
            </Step>
            <Step n={4} title='Enable OIDC and save'>
              Toggle <strong>Enable OIDC Login</strong> on, then click <strong>Save</strong>.
              The login page will now display a <em>Login with OIDC</em> button.
            </Step>
            <Step n={5} title="Ensure users exist in the database">
              Before an SSO user can log in, their <strong>email address</strong> (as it appears in the IdP token)
              must match the email of a user record in the database. Users without a matching record will
              be denied access.
            </Step>
            <Step n={6} title="Reset if needed" last>
              To remove the OIDC integration, open the modal and click <strong>Reset Configuration</strong>.
              This clears all settings and hides the OIDC button from the login page.
            </Step>
          </div>
        </section>

      </main>
    </div>
  );
}

/* ── helpers ── */

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400 w-44 whitespace-nowrap">
        {label}
      </td>
      <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">{value}</td>
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
        <span className={`p-2 rounded-lg ${iconColor}`}>{icon}</span>
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs flex items-center justify-center font-medium">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Step({
  n, title, children, last = false,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`px-6 py-5 flex gap-4 ${last ? '' : ''}`}>
      <span className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{title}</p>
        <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
      <span>{children}</span>
    </li>
  );
}
