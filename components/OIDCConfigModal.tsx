'use client';

import { useActionState, useEffect, useRef } from 'react';
import { saveOIDCConfig, resetOIDCConfig, type OIDCConfigState } from '@/lib/actions/oidc-config';
import type { OIDCConfigRow } from '@/lib/db';

interface Props {
  open: boolean;
  onClose: () => void;
  config: Pick<OIDCConfigRow, 'well_known_url' | 'client_id' | 'client_secret' | 'scope' | 'enabled'>;
}

export default function OIDCConfigModal({ open, onClose, config }: Props) {
  const [state, formAction, isPending] = useActionState<OIDCConfigState | undefined, FormData>(
    saveOIDCConfig,
    undefined
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) el.showModal();
    else el.close();
  }, [open]);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-lg rounded-xl shadow-2xl p-0 bg-white dark:bg-zinc-900 backdrop:bg-black/60 flex flex-col max-h-[90vh]"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          OIDC Integration
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Save form — fields only, no nested forms */}
      <form id="oidc-save-form" action={formAction} className="px-6 py-5 flex flex-col gap-4">
        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Well-Known URL <span className="text-red-500">*</span>
          </label>
          <input
            name="well_known_url"
            type="url"
            defaultValue={config.well_known_url}
            placeholder="https://your-idp.example.com/.well-known/openid-configuration"
            required
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-zinc-500">
            The OpenID Connect discovery document URL.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Client ID <span className="text-red-500">*</span>
          </label>
          <input
            name="client_id"
            type="text"
            defaultValue={config.client_id}
            placeholder="your-client-id"
            required
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Client Secret <span className="text-red-500">*</span>
          </label>
          <input
            name="client_secret"
            type="password"
            defaultValue={config.client_secret}
            placeholder="your-client-secret"
            required
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Scope
          </label>
          <input
            name="scope"
            type="text"
            defaultValue={config.scope || 'openid profile email'}
            placeholder="openid profile email"
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-zinc-500">
            Must include <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">email</code> for user lookup.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="oidc-enabled"
            name="enabled"
            type="checkbox"
            defaultChecked={config.enabled === 1}
            className="w-4 h-4 accent-blue-600"
          />
          <label htmlFor="oidc-enabled" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Enable OIDC Login
          </label>
        </div>
      </form>

      {/* Footer — separate reset form + save/cancel buttons outside the save form */}
      <div className="px-6 pb-5 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700 pt-4">
        <form action={resetOIDCConfig}>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Reset Configuration
          </button>
        </form>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          {/* Associates this submit button with the save form by id */}
          <button
            type="submit"
            form="oidc-save-form"
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
