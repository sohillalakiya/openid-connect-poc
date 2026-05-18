'use server';

import { compare } from 'bcryptjs';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import pool, { type UserRow } from '@/lib/db';
import { createSession, deleteSession, decrypt } from '@/lib/session';
import { buildEndSessionURL } from '@/lib/oidc';

export interface AuthState {
  error?: string;
}

export async function loginAction(
  _prevState: AuthState | undefined,
  formData: FormData
): Promise<AuthState> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Username and password are required.' };
  }

  let user: UserRow | undefined;
  try {
    const result = await pool.query<UserRow>(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    user = result.rows[0];
  } catch {
    return { error: 'A server error occurred. Please try again.' };
  }

  if (!user) {
    return { error: 'Invalid username or password.' };
  }

  let valid: boolean;
  try {
    valid = await compare(password, user.password);
  } catch {
    return { error: 'A server error occurred. Please try again.' };
  }

  if (!valid) {
    return { error: 'Invalid username or password.' };
  }

  try {
    await createSession({
      sub: String(user.id),
      username: user.username,
      loginMethod: 'local',
    });
  } catch {
    return { error: 'Failed to create session. Ensure SESSION_SECRET is set.' };
  }

  redirect('/userinfo');
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  const session = await decrypt(token);

  await deleteSession();

  if (
    session?.loginMethod === 'oidc' &&
    session.endSessionEndpoint &&
    session.idToken
  ) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const logoutUrl = buildEndSessionURL({
      endSessionEndpoint: session.endSessionEndpoint,
      idToken: session.idToken,
      postLogoutRedirectUri: `${appUrl}/login`,
    });
    redirect(logoutUrl);
  }

  redirect('/login');
}
