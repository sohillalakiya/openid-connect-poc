import { Pool } from 'pg';
import { hashSync } from 'bcryptjs';

declare global {
  // eslint-disable-next-line no-var
  var __pool: Pool | undefined;
}

export const pool: Pool = globalThis.__pool ?? (() => {
  const p = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://patra_user:SecurePostgres2024!@localhost:5432/patra_user',
  });
  if (process.env.NODE_ENV !== 'production') globalThis.__pool = p;
  return p;
})();

export async function initialize(): Promise<void> {
  try {
    await pool.query('SELECT 1');
    console.log('[DB] Connected to PostgreSQL');
  } catch (err) {
    console.error('[DB] Failed to connect to PostgreSQL:', err);
    throw err;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id       SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email    TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS oidc_config (
      id                         INTEGER PRIMARY KEY DEFAULT 1,
      well_known_url             TEXT NOT NULL DEFAULT '',
      client_id                  TEXT NOT NULL DEFAULT '',
      client_secret              TEXT NOT NULL DEFAULT '',
      scope                      TEXT NOT NULL DEFAULT 'openid profile email',
      enabled                    INTEGER NOT NULL DEFAULT 0,
      client_type                TEXT NOT NULL DEFAULT 'confidential',
      pkce_enabled               INTEGER NOT NULL DEFAULT 1,
      token_endpoint_auth_method TEXT NOT NULL DEFAULT 'client_secret_basic',
      CONSTRAINT single_row CHECK (id = 1)
    )
  `);

  // Migrate existing tables that predate these columns
  await pool.query(`ALTER TABLE oidc_config ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'confidential'`);
  await pool.query(`ALTER TABLE oidc_config ADD COLUMN IF NOT EXISTS pkce_enabled INTEGER NOT NULL DEFAULT 1`);
  await pool.query(`ALTER TABLE oidc_config ADD COLUMN IF NOT EXISTS token_endpoint_auth_method TEXT NOT NULL DEFAULT 'client_secret_basic'`);

  console.log('[DB] Schema ready — tables: users, oidc_config');

  const username = process.env.SEED_USERNAME ?? 'sohil';
  const password = process.env.SEED_PASSWORD ?? 'sohil';
  const email    = process.env.SEED_EMAIL    ?? 'sohil@example.com';

  const result = await pool.query(
    'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [username, email, hashSync(password, 10)]
  );

  if (result.rowCount && result.rowCount > 0) {
    console.log(`[DB] Admin user seeded — username: ${username}, email: ${email}`);
  } else {
    console.log(`[DB] Admin user already exists — username: ${username}`);
  }

  await pool.query('INSERT INTO oidc_config (id) VALUES (1) ON CONFLICT DO NOTHING');
}

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password: string;
}

export interface OIDCConfigRow {
  id: number;
  well_known_url: string;
  client_id: string;
  client_secret: string;
  scope: string;
  enabled: number;
  client_type: 'public' | 'confidential';
  pkce_enabled: number;
  token_endpoint_auth_method: 'client_secret_basic' | 'client_secret_post' | 'none';
}

export default pool;
