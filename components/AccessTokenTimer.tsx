'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

function formatSeconds(s: number): string {
  if (s <= 0) return '00:00:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
}

type RefreshState = 'idle' | 'refreshing' | 'done' | 'failed';

export default function AccessTokenTimer({ expiresAt: initial }: { expiresAt?: number }) {
  const router = useRouter();
  const [expiresAt, setExpiresAt] = useState(initial);
  const [remaining, setRemaining] = useState<number>(() =>
    initial ? Math.max(0, initial - Math.floor(Date.now() / 1000)) : -1
  );
  const [refreshState, setRefreshState] = useState<RefreshState>('idle');
  const refreshing = useRef(false);

  useEffect(() => {
    if (!expiresAt) return;

    const doRefresh = async () => {
      if (refreshing.current) return;
      refreshing.current = true;
      setRefreshState('refreshing');
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (res.ok) {
          const { accessTokenExpiresAt } = await res.json();
          setExpiresAt(accessTokenExpiresAt);
          setRefreshState('done');
          router.refresh(); // re-render server components to pick up new token from DB
          setTimeout(() => setRefreshState('idle'), 3000);
        } else {
          setRefreshState('failed');
          router.push('/login?error=session_expired');
        }
      } catch {
        setRefreshState('failed');
        router.push('/login?error=session_expired');
      } finally {
        refreshing.current = false;
      }
    };

    const tick = () => {
      const rem = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
      setRemaining(rem);
      if (rem < 60 && !refreshing.current) {
        doRefresh();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, router]);

  if (!expiresAt) {
    return <span className="text-zinc-400 dark:text-zinc-500">N/A</span>;
  }

  const colorClass =
    refreshState === 'refreshing'
      ? 'text-blue-600 dark:text-blue-400'
      : refreshState === 'done'
      ? 'text-emerald-600 dark:text-emerald-400'
      : refreshState === 'failed'
      ? 'text-red-600 dark:text-red-400'
      : remaining > 300
      ? 'text-emerald-600 dark:text-emerald-400'
      : remaining > 60
      ? 'text-amber-600 dark:text-amber-400'
      : remaining > 0
      ? 'text-red-600 dark:text-red-400'
      : 'text-zinc-500 dark:text-zinc-400';

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`font-mono font-semibold tabular-nums ${colorClass}`}>
        {formatSeconds(remaining)}
      </span>
      {refreshState === 'refreshing' && (
        <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          Refreshing token…
        </span>
      )}
      {refreshState === 'done' && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          ✓ Token refreshed
        </span>
      )}
      {refreshState === 'failed' && (
        <span className="text-xs text-red-600 dark:text-red-400">
          Refresh failed — redirecting…
        </span>
      )}
    </span>
  );
}
