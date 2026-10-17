'use client';

import { useCallback, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FollowButton } from './follow-button';
import { LogPanel, type LoggableGame } from './log-panel';
import { PlayButton, type PlayableGame } from './play-button';

/**
 * Play + follow on the game page. When the player comes back from the game's own site: on wide
 * screens the docked log panel is brought into view; on phones a log sheet pops up.
 */
export function GameActions({
  game,
  gameId,
  following,
  loggedToday,
  playLabel,
}: {
  game: PlayableGame & LoggableGame;
  gameId: string;
  following: boolean;
  loggedToday: boolean;
  playLabel: string;
}) {
  const [sheet, setSheet] = useState(false);
  const onReturn = useCallback(() => {
    if (loggedToday) return;
    if (window.matchMedia('(min-width: 768px)').matches) {
      const panel = document.getElementById('log-panel');
      panel?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      panel?.focus({ preventScroll: true });
    } else {
      setSheet(true);
    }
  }, [loggedToday]);

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
      <PlayButton
        game={game}
        size="lg"
        label={playLabel}
        onReturn={onReturn}
        className="w-full sm:w-auto"
        wrapperClassName="w-full sm:w-auto"
      />
      <FollowButton
        gameId={gameId}
        gameName={game.name}
        following={following}
        className="h-14 rounded-lg px-7 text-lg"
      />
      <Dialog open={sheet} onOpenChange={setSheet}>
        <DialogContent title={`How did ${game.name} go?`} description="Log it while it's fresh.">
          <LogPanel game={game} onLogged={() => setTimeout(() => setSheet(false), 1500)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
