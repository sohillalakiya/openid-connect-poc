# OIDC POC — Code Changes

## 1. Database Schema (`lib/db.ts`)

Added 3 columns to `oidc_config` table, with `ALTER TABLE … ADD COLUMN IF NOT EXISTS` migrations for existing deployments:

| Column | Type | Default |
|---|---|---|
| `client_type` | TEXT | `'confidential'` |
| `pkce_enabled` | INTEGER | `1` (on) |
| `token_endpoint_auth_method` | TEXT | `'client_secret_basic'` |

Updated `OIDCConfigRow` interface to include the new fields.

---

## 2. OIDC Helpers (`lib/oidc.ts`)

### `buildAuthorizationURL`
- `codeChallenge` made optional — PKCE params (`code_challenge`, `code_challenge_method`) only added to the authorization URL when a challenge is provided.

### `exchangeCode`
- `clientSecret` and `codeVerifier` made optional.
- New `authMethod` parameter controls how credentials are sent:
  - `client_secret_basic` — `Authorization: Basic base64(id:secret)` header
  - `client_secret_post` — `client_id` + `client_secret` in POST body
  - `none` — only `client_id` in body (public clients)
- `code_verifier` only added to body when provided.

---

## 3. Server Actions (`lib/actions/oidc-config.ts`)

### `saveOIDCConfig`
- Reads `client_type`, `pkce_enabled`, `token_endpoint_auth_method` from form data.
- Validation rules:
  - Confidential client + auth method ≠ `none` → secret required.
  - Public client → PKCE must be enabled.
- Saves all 3 new fields to DB.
- Added `revalidatePath('/userinfo')` so the page reflects saved config immediately.

### `resetOIDCConfig`
- Resets new fields to defaults (`confidential`, `pkce_enabled=1`, `client_secret_basic`).
- Changed signature to `(_prevState, _formData)` for `useActionState` compatibility.
- Added `revalidatePath('/userinfo')`.

### `initiateOIDCLogin`
- PKCE generation now conditional on `config.pkce_enabled !== 0`.
- `codeVerifier` defaults to `''` when PKCE off — cookie still set (proves request origin), `exchangeCode` receives `undefined`.

---

## 4. OIDC Callback Handler (`app/api/auth/callback/route.ts`)

### Bug fix — `invalid_state` when PKCE disabled
**Root cause:** Guard condition included `!codeVerifier`. When PKCE is off, the cookie is set to `''` (empty string). `!''` evaluates to `true`, falsely rejecting valid callbacks.

**Fix:**
```diff
- const codeVerifier = request.cookies.get('oidc_code_verifier')?.value;
+ const codeVerifier = request.cookies.get('oidc_code_verifier')?.value ?? '';

- if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
+ if (!code || !state || !storedState || state !== storedState) {
```

Also passes `authMethod` from DB config to `exchangeCode`:
```ts
authMethod: config.token_endpoint_auth_method ?? 'client_secret_basic',
```

---

## 5. UI Components

### `OIDCConfigModal.tsx` (full rewrite)
- `useState` for reactive client type / PKCE / auth method.
- **Client Type radio** (Confidential / Public):
  - Public → hides secret field, locks auth method to `none`, forces PKCE on.
  - Confidential → shows secret field, allows all auth methods.
- **PKCE checkbox** — disabled + hidden input `value="on"` when client is public (HTML disabled inputs are not submitted by browsers; hidden input ensures the value reaches the server).
- **Auth Method select** — `client_secret_basic` / `client_secret_post` / `none`.
- `useActionState` wired for both save and reset; modal closes on `state.success`.

### `OIDCConfigButton.tsx`
- Props extended to pass new fields (`client_type`, `pkce_enabled`, `token_endpoint_auth_method`) to the modal.

### `Header.tsx`
- `safeConfig` extended with defaults for the 3 new fields.

---

## Summary

| File | Change |
|---|---|
| `lib/db.ts` | +3 columns, migrations, updated interface |
| `lib/oidc.ts` | Optional PKCE, 3 auth methods in token exchange |
| `lib/actions/oidc-config.ts` | Reads/saves new fields, conditional PKCE, revalidatePath |
| `app/api/auth/callback/route.ts` | **Bug fix**: remove `!codeVerifier` guard, pass authMethod |
| `components/OIDCConfigModal.tsx` | Full UI rewrite — client type, PKCE, auth method |
| `components/OIDCConfigButton.tsx` | Pass new props |
| `components/Header.tsx` | Default new fields in safeConfig |
