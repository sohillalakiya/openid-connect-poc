import { verifySession } from '@/lib/dal';
import SignOutButton from './SignOutButton';
import ThemeToggle from './ThemeToggle';

interface Props {
  username: string;
}

export default async function Header({ username }: Props) {
  await verifySession();

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
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
