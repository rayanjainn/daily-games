import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell, Notice, StepHeading } from '@/components/auth/auth-shell';
import { getSession } from '@/server/session';
import { describePairing } from '@/server/auth/pairing';
import { ApprovePanel } from './approve-panel';

export const metadata: Metadata = { title: 'Approve sign-in', robots: { index: false } };

export default async function ApprovePairingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/pair/${code}`)}`);
  const pairing = await describePairing(code);

  return (
    <AuthShell>
      <StepHeading title="Approve a sign-in?">
        Someone wants to sign in as <strong className="text-ink">{session.user.username}</strong>.
      </StepHeading>
      {!pairing || pairing.status !== 'pending' ? (
        <Notice tone="warn">
          This sign-in request has expired or was already handled. Start again on the other device.
        </Notice>
      ) : (
        <ApprovePanel code={code} choices={pairing.choices} device={pairing.device} />
      )}
    </AuthShell>
  );
}
