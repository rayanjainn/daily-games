'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { api } from '@/lib/api';

export function SignOutButton(props: Omit<ButtonProps, 'onClick'>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      {...props}
      onClick={async () => {
        setBusy(true);
        try {
          await api('/api/auth/logout', {});
        } finally {
          router.replace('/');
          router.refresh();
        }
      }}
    >
      <LogOut aria-hidden /> Sign out
    </Button>
  );
}
