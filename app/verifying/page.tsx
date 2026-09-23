'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { label: 'Authorization code received', delay: 0 },
  { label: 'Exchanging tokens with identity provider', delay: 600 },
  { label: 'Verifying access token signature (RFC 7519)', delay: 1300 },
  { label: 'Confirming user identity', delay: 2000 },
  { label: 'Redirecting to dashboard…', delay: 2700 },
];

const REDIRECT_DELAY = 3400;

export default function VerifyingPage() {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((step, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), step.delay));
    });

    timers.push(
      setTimeout(() => {
        router.replace('/userinfo');
      }, REDIRECT_DELAY)
    );

    return () => timers.forEach(clearTimeout);
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Spinner + heading */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-zinc-200 dark:border-zinc-800" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-600 animate-spin" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Verifying your identity
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Completing SSO sign-in…
            </p>
          </div>
        </div>

        {/* Step list */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {STEPS.map((step, i) => {
            const done = i < visibleCount - 1;
            const active = i === visibleCount - 1;
            const pending = i >= visibleCount;

            return (
              <div
                key={step.label}
                className={`flex items-center gap-4 px-5 py-4 transition-opacity duration-500 ${
                  pending ? 'opacity-30' : 'opacity-100'
                }`}
              >
                {/* Icon */}
                <span className="shrink-0 w-6 h-6 flex items-center justify-center">
                  {done ? (
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : active ? (
                    <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />
                  )}
                </span>

                {/* Label */}
                <span
                  className={`text-sm ${
                    done
                      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                      : active
                      ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
