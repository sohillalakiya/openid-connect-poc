'use client';

import { useState } from 'react';
import OIDCConfigModal from './OIDCConfigModal';
import type { OIDCConfigRow } from '@/lib/db';

interface Props {
  config: Pick<OIDCConfigRow, 'well_known_url' | 'client_id' | 'client_secret' | 'scope' | 'enabled' | 'client_type' | 'pkce_enabled' | 'token_endpoint_auth_method'>;
}

export default function OIDCConfigButton({ config }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
      >
        Integrate OIDC
      </button>
      <OIDCConfigModal
        open={open}
        onClose={() => setOpen(false)}
        config={config}
      />
    </>
  );
}
