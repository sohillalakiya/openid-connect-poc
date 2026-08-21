'use client';

export function WaffleMenu({ token }: { token: string }) {
  if (!token) return null;
  return <platform-waffle token={token} theme="auto" />;
}
