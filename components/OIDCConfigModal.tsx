'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { saveOIDCConfig, resetOIDCConfig, type OIDCConfigState } from '@/lib/actions/oidc-config';
import type { OIDCConfigRow } from '@/lib/db';

interface Props {
  open: boolean;
  onClose: () => void;
  config: Pick<OIDCConfigRow, 'well_known_url' | 'client_id' | 'client_secret' | 'scope' | 'enabled' | 'client_type' | 'pkce_enabled' | 'token_endpoint_auth_method'>;
}

export default function OIDCConfigModal({ open, onClose, config }: Props) {
  const [state, formAction, isPending] = useActionState<OIDCConfigState | undefined, FormData>(
    saveOIDCConfig,
    undefined
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [clientType, setClientType] = useState<'public' | 'confidential'>(
    config.client_type === 'public' ? 'public' : 'confidential'
  );
  const [pkceEnabled, setPkceEnabled] = useState<boolean>(config.pkce_enabled !== 0);
  const [authMethod, setAuthMethod] = useState<string>(
    config.token_endpoint_auth_method ?? 'client_secret_basic'
  );

  // When client type changes, enforce constraints
  const handleClientTypeChange = (type: 'public' | 'confidential') => {
    setClientType(type);
    if (type === 'public') {
      setPkceEnabled(true);
      setAuthMethod('none');
    } else {
      // Reset to sensible default for confidential
      if (authMethod === 'none') setAuthMethod('client_secret_basic');
    }
  };

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

  const inputClass =
    'border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  const labelClass = 'text-sm font-medium text-zinc-700 dark:text-zinc-300';

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

      <form id="oidc-save-form" action={formAction} className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        {/* Well-Known URL */}
        <div className="flex flex-col gap-1">
          <label className={labelClass}>
            Well-Known URL <span className="text-red-500">*</span>
          </label>
          <input
            name="well_known_url"
            type="url"
            defaultValue={config.well_known_url}
            placeholder="https://your-idp.example.com/.well-known/openid-configuration"
            required
            className={inputClass}
          />
          <p className="text-xs text-zinc-500">The OpenID Connect discovery document URL.</p>
        </div>

        {/* Client ID */}
        <div className="flex flex-col gap-1">
          <label className={labelClass}>
            Client ID <span className="text-red-500">*</span>
          </label>
          <input
            name="client_id"
            type="text"
            defaultValue={config.client_id}
            placeholder="your-client-id"
            required
            className={inputClass}
          />
        </div>

        {/* Client Type */}
        <div className="flex flex-col gap-2">
          <span className={labelClass}>Client Type</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="client_type"
                value="confidential"
                checked={clientType === 'confidential'}
                onChange={() => handleClientTypeChange('confidential')}
                className="accent-blue-600"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Confidential</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="client_type"
                value="public"
                checked={clientType === 'public'}
                onChange={() => handleClientTypeChange('public')}
                className="accent-blue-600"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Public</span>
            </label>
          </div>
          <p className="text-xs text-zinc-500">
            {clientType === 'public'
              ? 'Public clients cannot hold a secret (e.g. SPAs, mobile apps). PKCE is required.'
              : 'Confidential clients authenticate with a client secret (e.g. server-side apps).'}
          </p>
        </div>

        {/* Client Secret — hidden for public clients */}
        {clientType === 'confidential' && (
          <div className="flex flex-col gap-1">
            <label className={labelClass}>
              Client Secret{' '}
              {authMethod !== 'none' && <span className="text-red-500">*</span>}
            </label>
            <input
              name="client_secret"
              type="password"
              defaultValue={config.client_secret}
              placeholder="your-client-secret"
              required={authMethod !== 'none'}
              className={inputClass}
            />
          </div>
        )}
        {/* Hidden field for public client — submits empty string */}
        {clientType === 'public' && (
          <input type="hidden" name="client_secret" value="" />
        )}

        {/* Token Endpoint Auth Method */}
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Client Authentication Method</label>
          <select
            name="token_endpoint_auth_method"
            value={authMethod}
            onChange={e => setAuthMethod(e.target.value)}
            disabled={clientType === 'public'}
            className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {clientType === 'confidential' && (
              <>
                <option value="client_secret_basic">client_secret_basic (HTTP Basic auth header)</option>
                <option value="client_secret_post">client_secret_post (credentials in POST body)</option>
              </>
            )}
            <option value="none">none (public client / no authentication)</option>
          </select>
          <p className="text-xs text-zinc-500">
            {authMethod === 'client_secret_basic' && 'Credentials sent in the Authorization: Basic header.'}
            {authMethod === 'client_secret_post' && 'Credentials sent as POST body parameters.'}
            {authMethod === 'none' && 'No client authentication — suitable for public clients.'}
          </p>
        </div>

        {/* PKCE */}
        <div className="flex items-start gap-3">
          {/* Hidden input ensures value submits even when checkbox is disabled */}
          {clientType === 'public' && (
            <input type="hidden" name="pkce_enabled" value="on" />
          )}
          <input
            id="oidc-pkce"
            name="pkce_enabled"
            type="checkbox"
            checked={pkceEnabled}
            onChange={e => {
              if (clientType === 'public') return;
              setPkceEnabled(e.target.checked);
            }}
            disabled={clientType === 'public'}
            aria-disabled={clientType === 'public'}
            className="w-4 h-4 mt-0.5 accent-blue-600 disabled:opacity-50"
          />
          <div>
            <label htmlFor="oidc-pkce" className={`${labelClass} cursor-pointer`}>
              Enable PKCE{clientType === 'public' && ' (required for public clients)'}
            </label>
            <p className="text-xs text-zinc-500 mt-0.5">
              Proof Key for Code Exchange — protects the authorization code flow against interception.
            </p>
          </div>
        </div>

        {/* Scope */}
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Scope</label>
          <input
            name="scope"
            type="text"
            defaultValue={config.scope || 'openid profile email'}
            placeholder="openid profile email"
            className={inputClass}
          />
          <p className="text-xs text-zinc-500">
            Must include <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">email</code> for user lookup.
          </p>
        </div>

        {/* Enable OIDC */}
        <div className="flex items-center gap-3">
          <input
            id="oidc-enabled"
            name="enabled"
            type="checkbox"
            defaultChecked={config.enabled === 1}
            className="w-4 h-4 accent-blue-600"
          />
          <label htmlFor="oidc-enabled" className={labelClass}>
            Enable OIDC Login
          </label>
        </div>
      </form>

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
