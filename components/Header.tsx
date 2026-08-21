import pool, { type OIDCConfigRow } from '@/lib/db';
import { verifySession } from '@/lib/dal';
import OIDCConfigButton from './OIDCConfigButton';
import SignOutButton from './SignOutButton';
import { WaffleMenu } from './WaffleMenu';

interface Props {
  username: string;
}

export default async function Header({ username }: Props) {
  // const [{ rows: [config] }, session] = await Promise.all([
  //   pool.query<OIDCConfigRow>('SELECT * FROM oidc_config WHERE id = 1'),
  //   verifySession(),
  // ]);
  const session = await verifySession();
  const accessToken = session.accessToken ?? '';

  // const safeConfig = {
  //   well_known_url: config?.well_known_url ?? '',
  //   client_id: config?.client_id ?? '',
  //   client_secret: config?.client_secret ?? '',
  //   scope: config?.scope ?? 'openid profile email',
  //   enabled: config?.enabled ?? 0,
  //   client_type: (config?.client_type ?? 'confidential') as 'public' | 'confidential',
  //   pkce_enabled: config?.pkce_enabled ?? 1,
  //   token_endpoint_auth_method: (config?.token_endpoint_auth_method ?? 'client_secret_basic') as 'client_secret_basic' | 'client_secret_post' | 'none',
  // };

  return (
    <header className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            OIDC POC
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Signed in as <strong>{username}</strong>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <platform-waffle token={accessToken} theme="auto" />
          {/*<OIDCConfigButton config={safeConfig} />*/}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
