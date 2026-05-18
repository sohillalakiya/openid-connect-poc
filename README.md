# OpenID Connect POC

A proof-of-concept Next.js application demonstrating two parallel authentication flows — local username/password login and OpenID Connect (OIDC) SSO — backed by PostgreSQL.

## Features

- **Local login** — bcrypt password verification against a PostgreSQL users table
- **OIDC / SSO login** — full authorization code flow with PKCE (S256), compatible with any standards-compliant IdP (Keycloak, Okta, Azure AD, Auth0, etc.)
- **Runtime OIDC configuration** — IdP settings are stored in the database and editable through the UI without restarting the server
- **IdP logout** — sign-out triggers the IdP's `end_session_endpoint` when available
- **Secure sessions** — HS256 signed JWT stored as an `httpOnly` cookie with an 8-hour TTL
- **Database-gated access** — OIDC users must already exist in the `users` table (matched by email); no auto-provisioning

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

Create a `.env.local` file in the project root:

```env
# Required — used to sign session JWTs
SESSION_SECRET=change-me-to-a-long-random-string

# PostgreSQL connection string
DATABASE_URL=postgresql://patra_user:SecurePostgres2024!@localhost:5432/patra_user

# Canonical app URL used in OIDC redirect URIs
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Admin account seeded on first boot (optional, defaults shown)
SEED_USERNAME=sohil
SEED_PASSWORD=sohil
SEED_EMAIL=sohil@example.com
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
5. The app exchanges the code for tokens, fetches the userinfo endpoint, and extracts the `email` claim.
6. The email is looked up in the `users` table. If found, a session is created. If not, an "Access Denied" error page is shown.

**Redirect URI to register with your IdP:**
```
http://localhost:3000/api/auth/callback
```

## Configuring OIDC at Runtime

1. Log in with the local admin account.
2. Click **Integrate OIDC** in the top-right header.
3. Fill in:
   - **Well-Known URL** — your IdP's discovery document, e.g. `https://your-idp.example.com/realms/myrealm/.well-known/openid-configuration`
   - **Client ID** and **Client Secret** — from your IdP's application settings
   - **Scope** — must include `email` (default: `openid profile email`)
4. Toggle **Enable OIDC Login** and click **Save**.

The login page will immediately show a **Login with OIDC** button.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SESSION_SECRET` | Yes | — | Secret key for signing JWTs (use a long random string) |
| `DATABASE_URL` | No | `postgresql://patra_user:SecurePostgres2024!@localhost:5432/patra_user` | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Canonical app URL used in OIDC redirect URIs |
| `SEED_USERNAME` | No | `sohil` | Admin username created on first boot |
| `SEED_PASSWORD` | No | `sohil` | Admin password created on first boot |
| `SEED_EMAIL` | No | `sohil@example.com` | Admin email created on first boot |

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
  api/auth/signout/    # IdP-initiated / error-page sign-out
  login/               # Login page (local + OIDC button)
  oidc-error/          # Shown when OIDC user email is not in the DB
  userinfo/            # Protected page shown after login
components/
  Header.tsx           # App header with OIDC config button and sign-out
  LoginForm.tsx        # Login form (local + OIDC)
  OIDCConfigModal.tsx  # Runtime OIDC provider configuration dialog
lib/
  actions/auth.ts      # loginAction, logoutAction (Server Actions)
  actions/oidc-config.ts  # saveOIDCConfig, initiateOIDCLogin (Server Actions)
  dal.ts               # Data Access Layer — verifySession, getUser
  db.ts                # PostgreSQL pool + schema initialization
  oidc.ts              # Pure OIDC helpers (PKCE, discovery, token exchange)
  session.ts           # JWT session encrypt/decrypt
proxy.ts               # Route guard middleware (protects /userinfo)
instrumentation.ts     # DB initialization before first request
```

## Security Notes

- The `SESSION_SECRET` must be set to a cryptographically random value in production. Do not use the default.
- OIDC users are matched by email only — ensure email addresses in your IdP match those in the `users` table.
- The app uses PKCE (`S256`) for all OIDC flows; the client secret is used only at the token endpoint.
- No user is auto-provisioned; an administrator must add users to the database before they can log in via SSO.
