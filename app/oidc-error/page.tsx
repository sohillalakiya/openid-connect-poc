import { cookies } from 'next/headers';

export default async function OIDCErrorPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('oidc_error')?.value;

  let message = 'Your account is not registered in this application.';
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.message) message = parsed.message;
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8 flex flex-col gap-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Access Denied
          </h1>

          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {message}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Contact your administrator to get access.
          </p>
        </div>

        <a
          href="/api/auth/signout"
          className="w-full inline-flex items-center justify-center py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
        >
          Sign Out from Identity Provider
        </a>

        <a
          href="/login"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to Login
        </a>
      </div>
    </div>
  );
}
