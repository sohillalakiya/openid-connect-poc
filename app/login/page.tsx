import type { OIDCConfigRow } from '@/lib/db';
import pool from '@/lib/db';
import LoginForm from '@/components/LoginForm';

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  const { rows: [config] } = await pool.query<Pick<OIDCConfigRow, 'enabled'>>('SELECT enabled FROM oidc_config WHERE id = 1');

  const oidcEnabled = config?.enabled === 1;

  const defaultUsername = process.env.SEED_USERNAME ?? 'sohil';
  const defaultPassword = process.env.SEED_PASSWORD ?? 'sohil';

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8">
        <LoginForm
          defaultUsername={defaultUsername}
          defaultPassword={defaultPassword}
          oidcEnabled={oidcEnabled}
          loginError={error}
        />
      </div>
    </div>
  );
}
