# OpenID Connect POC

> **This is a proof-of-concept** for generic OpenID Connect authentication. It is intended for learning and evaluation purposes and is not production-ready as-is.

A Next.js application demonstrating two parallel authentication flows — local username/password login and OpenID Connect (OIDC) SSO — backed by PostgreSQL. The OIDC implementation is provider-agnostic and works with any standards-compliant identity provider.

## Features

- **Local login** — bcrypt password verification against a PostgreSQL users table
- **OIDC / SSO login** — full authorization code flow with PKCE (S256), compatible with any standards-compliant IdP (Keycloak, Okta, Azure AD, Auth0, etc.)
- **Silent token refresh** — `/api/auth/refresh` exchanges a refresh token for a new access token without user interaction
- **Access token timer** — userinfo page displays live token expiry countdown with auto-refresh
- **Dark mode** — system / light / dark theme cycling, persisted across reloads
- **Runtime OIDC configuration** — IdP settings are stored in the database and editable through the UI without restarting the server
- **IdP logout** — sign-out triggers the IdP's `end_session_endpoint` when available
- **Secure sessions** — HS256 signed JWT stored as an `httpOnly` cookie with an 8-hour TTL
- **Refresh token cookie** — separate `httpOnly` `oidc_rt` cookie stores the OIDC refresh token
- **Database-gated access** — OIDC users must already exist in the `users` table (matched by email); no auto-provisioning
- **Seed overwrite** — `SEED_OVERWRITE_DB=1` forces env seed values to overwrite existing DB data on every server start

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL (via `pg`) |
| Session | `jose` (HS256 JWT) |
| Password hashing | `bcryptjs` |

## Prerequisites

- Node.js 20+
- pnpm
- A running PostgreSQL instance (see [Docker](#running-postgres-with-docker))

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd openid-connect-poc
pnpm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Minimum required values:

```env
# Required — used to sign session JWTs
SESSION_SECRET=change-me-to-a-long-random-string

# PostgreSQL connection string
DATABASE_URL=postgresql://patra_user:SecurePostgres2024!@localhost:5432/patra_user

# Canonical app URL used in OIDC redirect URIs
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Admin account seeded on first boot — uniqueness checked by email
SEED_USERNAME=sohil
SEED_PASSWORD=sohil
SEED_EMAIL=sohil@example.com

# Optional: pre-seed OIDC config from env (both must be set to take effect)
# SEED_OIDC_WELL_KNOWN_URL=https://your-idp.example.com/realms/myrealm/.well-known/openid-configuration
# SEED_OIDC_CLIENT_ID=your-client-id
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

The included `docker-compose.yml` starts a PostgreSQL 16 container. Tables and the seed admin user are created automatically on the first server boot.

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to the login page.

## Authentication Flows

### Local Login

1. Enter username and password on the login page.
2. The server verifies credentials against the `users` table (bcrypt).
3. On success, an HS256 JWT session cookie is created (8-hour expiry).

### OIDC / SSO Login

1. An admin enables OIDC by clicking **Integrate OIDC** in the header and filling in the provider details.
2. Users click **Login with OIDC** on the login page.
3. The app generates a PKCE code verifier + challenge and redirects to the IdP.
4. After IdP authentication the IdP redirects back to `/api/auth/callback`.
5. The callback handler exchanges the code for tokens, verifies the JWT (if a JWKS URI is available), fetches the userinfo endpoint, and extracts the `email` claim.
6. The email is looked up in the `users` table. If found, a session is created and the refresh token is stored in a separate `oidc_rt` httpOnly cookie. If not found, an "Access Denied" error page is shown.

**Redirect URI to register with your IdP:**
```
http://localhost:3000/api/auth/callback
```

### Token Refresh

OIDC sessions support silent access token refresh without re-authentication:

- `POST /api/auth/refresh` — exchanges the `oidc_rt` cookie for new tokens using the stored refresh token, updates the session cookie with the new expiry, and rotates the refresh token cookie.
- The userinfo page shows a live countdown and automatically refreshes the access token before it expires.

## Configuring OIDC

### Option A — via environment variables

Set `SEED_OIDC_WELL_KNOWN_URL` and `SEED_OIDC_CLIENT_ID` (plus any optional vars) in `.env.local`.

**Default behaviour (no `SEED_OVERWRITE_DB`):** config is seeded only once — when no `oidc_config` row exists. On subsequent restarts the env vars are ignored, so UI changes are preserved.

**With `SEED_OVERWRITE_DB=1`:** the config row is upserted on every server start, overwriting any UI changes. Useful for ephemeral environments or CI where you always want env values to win.

### Option B — via the UI (any time)

1. Log in with the local admin account.
2. Click **Integrate OIDC** in the top-right header.
3. Fill in:
   - **Well-Known URL** — your IdP's discovery document, e.g. `https://your-idp.example.com/realms/myrealm/.well-known/openid-configuration`
   - **Client ID** and **Client Secret** — from your IdP's application settings
   - **Scope** — must include `email` (default: `openid profile email`)
4. Toggle **Enable OIDC Login** and click **Save**.

The login page will immediately show a **Login with OIDC** button. Without `SEED_OVERWRITE_DB=1`, UI changes survive server restarts.

## Seeding Behaviour

The app seeds the admin user and OIDC config during startup (via `instrumentation.ts` → `lib/db.ts`).

| `SEED_OVERWRITE_DB` | Admin user | OIDC config |
|---|---|---|
| unset / `0` | Insert only — skipped if email already exists | Insert only — skipped if row exists |
| `1` | Upsert — updates `username` and `password` for existing email | Upsert — overwrites all fields unconditionally |

> **Warning:** `SEED_OVERWRITE_DB=1` will overwrite the admin password and any UI-configured OIDC settings on every server start. Do not use in production unless that is the intended behaviour.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SESSION_SECRET` | Yes | — | Secret key for signing JWTs (use a long random string) |
| `DATABASE_URL` | No | `postgresql://patra_user:SecurePostgres2024!@localhost:5432/patra_user` | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Canonical app URL used in OIDC redirect URIs |
| `SEED_USERNAME` | No | `sohil` | Admin username seeded on first boot |
| `SEED_PASSWORD` | No | `sohil` | Admin password seeded on first boot |
| `SEED_EMAIL` | No | `sohil@example.com` | Admin email — uniqueness key for user seeding |
| `SEED_OVERWRITE_DB` | No | `0` | Set `1` to upsert seed data on every start, overwriting existing DB values |
| `SEED_OIDC_WELL_KNOWN_URL` | No | — | OIDC discovery URL; must be set with `SEED_OIDC_CLIENT_ID` to trigger seeding |
| `SEED_OIDC_CLIENT_ID` | No | — | OIDC client ID |
| `SEED_OIDC_CLIENT_SECRET` | No | `''` | OIDC client secret |
| `SEED_OIDC_SCOPE` | No | `openid profile email` | OIDC scope string |
| `SEED_OIDC_ENABLED` | No | `0` | Set `1` to enable the OIDC login button after seeding |
| `SEED_OIDC_CLIENT_TYPE` | No | `confidential` | `public` or `confidential` |
| `SEED_OIDC_PKCE_ENABLED` | No | `1` | Set `0` to disable PKCE |
| `SEED_OIDC_TOKEN_ENDPOINT_AUTH_METHOD` | No | `client_secret_basic` | `client_secret_basic`, `client_secret_post`, or `none` |

## Available Scripts

```bash
pnpm dev      # Start dev server with Turbopack
pnpm build    # Production build
pnpm start    # Run production build
pnpm lint     # ESLint
```

## Running Postgres with Docker

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Stop and remove data volume
docker compose down -v
```

## Project Structure

```
app/
  api/auth/callback/   # OIDC redirect URI handler
  api/auth/refresh/    # Silent access token refresh endpoint
  api/auth/signout/    # IdP-initiated / error-page sign-out
  login/               # Login page (local + OIDC button)
  oidc-error/          # Shown when OIDC user email is not in the DB
  userinfo/            # Protected page shown after login (token info + timer)
  verifying/           # Intermediate page shown during OIDC callback processing
components/
  AccessTokenTimer.tsx # Live access token expiry countdown with auto-refresh
  Header.tsx           # App header with theme toggle and sign-out
  LoginForm.tsx        # Login form (local + OIDC)
  OIDCConfigModal.tsx  # Runtime OIDC provider configuration dialog
  ThemeToggle.tsx      # System / light / dark theme cycling button
  TokenCard.tsx        # Token display card component
lib/
  actions/auth.ts         # loginAction, logoutAction (Server Actions)
  actions/oidc-config.ts  # saveOIDCConfig, initiateOIDCLogin (Server Actions)
  dal.ts                  # Data Access Layer — verifySession, getUser
  db.ts                   # PostgreSQL pool + schema initialization + seeding
  oidc.ts                 # Pure OIDC helpers (PKCE, discovery, token exchange)
  oidc-edge.ts            # Edge-compatible OIDC helpers (JWT verify, token refresh)
  session.ts              # JWT session encrypt/decrypt + cookie helpers
proxy.ts               # Route guard middleware (protects /userinfo, /oidc-error)
instrumentation.ts     # DB initialization before first request
public/
  theme-init.js        # Inline script for flicker-free theme init before hydration
```

## Data Model

```sql
users       (id, username, email, password)
oidc_config (id=1, well_known_url, client_id, client_secret, scope, enabled,
             client_type, pkce_enabled, token_endpoint_auth_method)
oidc_tokens (user_id, access_token, updated_at)
```

`oidc_config` always has exactly one row. `enabled = 0` hides the OIDC login button.  
`oidc_tokens` stores the latest access token per user; updated on each token refresh.

## Security Notes

- The `SESSION_SECRET` must be set to a cryptographically random value in production. Do not use the default.
- OIDC users are matched by email only — ensure email addresses in your IdP match those in the `users` table.
- The app uses PKCE (`S256`) for all OIDC flows; the client secret is used only at the token endpoint.
- The refresh token is stored in a separate `httpOnly` cookie (`oidc_rt`) and is never exposed to JavaScript.
- No user is auto-provisioned; an administrator must add users to the database before they can log in via SSO.
- Do not enable `SEED_OVERWRITE_DB=1` in production unless you explicitly want env values to overwrite DB state on every restart.
