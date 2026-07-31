# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev       # start dev server (Turbopack)
pnpm build     # production build
pnpm start     # run production build
pnpm lint      # ESLint
```

There is no test suite. The package manager is **pnpm**.

### Required environment variables

| Variable | Purpose | Default |
|---|---|---|
| `SESSION_SECRET` | Signs session JWTs (HS256) — **must be set** | none |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://patra_user:SecurePostgres2024!@localhost:5432/patra_user` |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL used in OIDC redirect URIs | `http://localhost:3000` |
| `SEED_USERNAME` / `SEED_PASSWORD` / `SEED_EMAIL` | Admin account seeded on first boot (checked by email) | `sohil` / `sohil` / `sohil@example.com` |
| `SEED_OIDC_WELL_KNOWN_URL` | OIDC discovery URL — if set alongside `SEED_OIDC_CLIENT_ID`, seeds the OIDC config row on first boot; UI changes win on subsequent restarts | _(optional)_ |
| `SEED_OIDC_CLIENT_ID` | OIDC client ID (required partner to `SEED_OIDC_WELL_KNOWN_URL`) | _(optional)_ |
| `SEED_OIDC_CLIENT_SECRET` | OIDC client secret | `''` |
| `SEED_OIDC_SCOPE` | OIDC scope string | `openid profile email` |
| `SEED_OIDC_ENABLED` | Set `1` to enable OIDC login button on seed | `0` |
| `SEED_OIDC_CLIENT_TYPE` | `public` or `confidential` | `confidential` |
| `SEED_OIDC_PKCE_ENABLED` | Set `0` to disable PKCE | `1` |
| `SEED_OIDC_TOKEN_ENDPOINT_AUTH_METHOD` | `client_secret_basic`, `client_secret_post`, or `none` | `client_secret_basic` |

## Architecture

### Auth flows

Two parallel auth paths share the same session cookie:

1. **Local login** — `LoginForm` → `loginAction` (Server Action) → bcrypt password check against SQLite `users` table → JWT session cookie.
2. **OIDC login** — `LoginForm` (OIDC button) → `initiateOIDCLogin` (Server Action) → PKCE code + state set as short-lived cookies → redirect to IdP → `GET /api/auth/callback` Route Handler completes the exchange → looks up user by email → JWT session cookie.

Logout always clears the session cookie. If the session's `loginMethod` is `oidc` and an `endSessionEndpoint` is stored, logout also redirects to the IdP's end-session URL.

### Key files

| Path | Role |
|---|---|
| `lib/db.ts` | PostgreSQL pool (pg). Exports `pool` (default) and `initialize()`. `initialize()` is called from `instrumentation.ts` — it tests connectivity (throws on failure), creates tables, and seeds the admin user. |
| `lib/session.ts` | JWT encrypt/decrypt (jose, HS256). 8-hour `session` httpOnly cookie. |
| `lib/oidc.ts` | Pure OIDC helpers: discovery fetch, PKCE generation, authorization URL builder, code exchange, userinfo fetch, end-session URL builder. |
| `lib/dal.ts` | Data Access Layer — **server-only**. `verifySession` redirects to `/login` if unauthenticated; `getUser` fetches DB user. Both are memoized with React `cache()`. |
| `lib/actions/auth.ts` | `loginAction` (local login), `logoutAction` — Server Actions. |
| `lib/actions/oidc-config.ts` | `saveOIDCConfig`, `resetOIDCConfig`, `initiateOIDCLogin` — Server Actions for OIDC provider setup. |
| `app/api/auth/callback/route.ts` | OIDC redirect URI handler. Verifies state, exchanges code, fetches userinfo, matches user by email, creates session. |
| `app/api/auth/signout/route.ts` | GET endpoint for IdP-initiated or error-page sign-out. |
| `proxy.ts` | **Route guard middleware** (named `proxy`, not `middleware`). Protects `/userinfo` and `/oidc-error`; redirects authenticated users away from `/login`. |
| `instrumentation.ts` | Next.js instrumentation hook — calls `initialize()` from `lib/db` in the Node.js runtime. Runs once at server startup before any requests. If the DB is unreachable, the error is logged and re-thrown. |

### Non-standard conventions

- **Middleware is in `proxy.ts`**, not the conventional `middleware.ts`. It exports a named `proxy` function (not `default`) alongside the `config` matcher.
- **OIDC config is stored in SQLite** (single row, `id = 1`), not environment variables. The admin configures the IdP at runtime through the `OIDCConfigModal` component.
- **PKCE state is passed via cookies** (`oidc_state`, `oidc_code_verifier`, `oidc_end_session_endpoint`) with a 5-minute TTL, then cleared in the callback handler.
- OIDC callback matches users **by email claim only** — the email must already exist in the `users` table. No JIT provisioning.
- When OIDC login succeeds but no matching user exists, the callback redirects to `/oidc-error` and passes error details via a short-lived `oidc_error` cookie (60 s TTL).

### Data model

```sql
users       (id, username, email, password)
oidc_config (id=1, well_known_url, client_id, client_secret, scope, enabled)
```

`oidc_config` always has exactly one row. `enabled = 0` hides the OIDC login button.
