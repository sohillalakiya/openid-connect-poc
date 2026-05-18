import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decrypt } from '@/lib/session';
import pool, { type UserRow } from '@/lib/db';

export const verifySession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  const session = await decrypt(token);
  if (!session?.sub) redirect('/login');
  return session;
});

export const getUser = cache(async (): Promise<UserRow | null> => {
  const session = await verifySession();
  const { rows: [user] } = await pool.query<Omit<UserRow, 'password'>>(
    'SELECT id, username, email FROM users WHERE id = $1',
    [Number(session.sub)]
  );
  return (user ?? null) as UserRow | null;
});
