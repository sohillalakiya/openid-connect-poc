'use client';

import { useActionState } from 'react';
import { loginAction, type AuthState } from '@/lib/actions/auth';
import { initiateOIDCLogin } from '@/lib/actions/oidc-config';

interface Props {
  defaultUsername: string;
  defaultPassword: string;
  oidcEnabled: boolean;
  loginError?: string;
}

export default function LoginForm({
  defaultUsername,
  defaultPassword,
  oidcEnabled,
  loginError,
}: Props) {
  const [state, formAction, isPending] = useActionState<AuthState | undefined, FormData>(
    loginAction,
    undefined
  );

  const error = state?.error ?? loginError;

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Sign In</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">OIDC Proof of Concept</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="username" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            defaultValue={defaultUsername}
            autoComplete="username"
            required
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            defaultValue={defaultPassword}
            autoComplete="current-password"
            required
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      {oidcEnabled && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-xs text-zinc-500 bg-white dark:bg-zinc-900 px-2">
              or
            </div>
          </div>

          <form action={initiateOIDCLogin}>
            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Login with OIDC
            </button>
          </form>
        </>
      )}
    </div>
  );
}
