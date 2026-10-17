'use client';

import { ImageIcon } from 'lucide-react';
import { ShareImage } from '@/components/share/share-image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

export function StatCardDialog({
  slug,
  gameName,
  username,
}: {
  slug: string;
  gameName: string;
  username: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <ImageIcon aria-hidden /> Stat card
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Your ${gameName} card`}
        description="Streaks and totals only, never answers."
        className="sm:w-[min(92vw,40rem)]"
      >
        <ShareImage
          src={`/api/cards/game/${slug}`}
          filename={`everydaily-${slug}-${username}.png`}
          alt={`${username}'s ${gameName} stats`}
          width={1200}
          height={630}
        />
      </DialogContent>
    </Dialog>
  );
}
