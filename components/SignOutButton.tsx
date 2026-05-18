'use client';

import { logoutAction } from '@/lib/actions/auth';

export default function SignOutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
      >
        Sign Out
      </button>
    </form>
  );
}
