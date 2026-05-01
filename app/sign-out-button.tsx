'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button type="button" className="button button-sm button-secondary" onClick={() => signOut({ callbackUrl: '/' })}>
      Sign out
    </button>
  );
}
