'use client';

import { useState } from 'react';

function decodeJWT(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decode = (b64: string) =>
      JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
    return { header: decode(parts[0]), payload: decode(parts[1]) };
  } catch {
    return null;
  }
}

function formatValue(key: string, value: unknown): string {
  const timeKeys = ['exp', 'iat', 'nbf', 'auth_time'];
  if (timeKeys.includes(key) && typeof value === 'number') {
    return `${value}  (${new Date(value * 1000).toLocaleString()})`;
  }
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

interface Props {
  label: string;
  token: string;
  color?: 'purple' | 'amber';
}

export default function TokenCard({ label, token, color = 'purple' }: Props) {
  const decoded = decodeJWT(token);
  const isJWT = decoded !== null;

  const accentStripe =
    color === 'amber'
      ? 'from-amber-400 to-orange-400'
      : 'from-purple-500 to-blue-500';

  const accentBadge =
    color === 'amber'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300';

  const panelLeft = 'bg-zinc-950 dark:bg-black';
  const panelRight = 'bg-white dark:bg-zinc-900';

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2.5">
          <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${accentStripe}`} />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{label}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${accentBadge}`}>
            {isJWT ? 'JWT' : 'Opaque'}
          </span>
        </div>
        <CopyButton value={token} />
      </div>

      {/* Body — encoded | decoded */}
      <div className="grid grid-cols-1 md:grid-cols-2 min-h-48">

        {/* LEFT — Encoded */}
        <div className={`${panelLeft} flex flex-col border-b md:border-b-0 md:border-r border-zinc-800`}>
          <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Encoded
            </span>
          </div>
          <div className="px-4 py-4 flex-1 overflow-auto">
            {isJWT ? (
              <JWTColored token={token} />
            ) : (
              <span className="text-xs font-mono text-zinc-300 break-all leading-relaxed">
                {token}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT — Decoded */}
        <div className={`${panelRight} flex flex-col`}>
          <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Decoded
            </span>
          </div>

          {isJWT ? (
            <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 flex-1 overflow-auto">
              <ClaimsSection title="Header" data={decoded.header} color={color} />
              <ClaimsSection title="Payload" data={decoded.payload} color={color} />
            </div>
          ) : (
            <div className="px-4 py-4 flex-1 flex items-center justify-center">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic text-center">
                Opaque token — not decodable
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* Color-coded JWT segments (header.payload.signature) */
function JWTColored({ token }: { token: string }) {
  const [h, p, s] = token.split('.');
  return (
    <p className="text-xs font-mono break-all leading-relaxed">
      <span className="text-pink-400">{h}</span>
      <span className="text-zinc-600">.</span>
      <span className="text-yellow-300">{p}</span>
      <span className="text-zinc-600">.</span>
      <span className="text-cyan-400">{s}</span>
    </p>
  );
}

function ClaimsSection({
  title,
  data,
  color,
}: {
  title: string;
  data: Record<string, unknown>;
  color: 'purple' | 'amber';
}) {
  const keyColor =
    color === 'amber'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-purple-600 dark:text-purple-400';

  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2.5">
        {title}
      </p>
      <div className="flex flex-col gap-1.5">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex gap-2 text-xs leading-relaxed">
            <span className={`shrink-0 font-semibold ${keyColor} w-28 truncate`} title={k}>
              {k}
            </span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300 break-all">
              {formatValue(k, v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
