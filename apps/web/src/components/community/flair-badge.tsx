const TONES: Record<string, string> = {
  pop: 'bg-pop text-on-pop',
  grape: 'bg-grape text-on-grape',
  mint: 'bg-mint text-on-mint',
  sun: 'bg-sun text-on-sun',
  sky: 'bg-sky text-on-sky',
  bubblegum: 'bg-bubblegum text-on-bubblegum',
};

export function FlairBadge({ flair }: { flair: { name: string; color: string } }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 font-display text-xs font-semibold leading-none ${TONES[flair.color] ?? 'bg-surface-2 text-ink'}`}
    >
      {flair.name}
    </span>
  );
}
