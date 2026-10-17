import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown instantly while a page streams in, shaped like the page so nothing jumps. Each one has
 * a level-one heading so the page has one even before the content arrives.
 */
function Status({ label }: { label: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

function Title({ children }: { children: string }) {
  return <h1 className="text-3xl sm:text-4xl">{children}</h1>;
}

export function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Status label="Loading today's games" />
      <h1 className="sr-only">Today</h1>
      <Skeleton className="h-40 rounded-lg sm:h-36" />
      <Skeleton className="h-7 w-44" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[4.5rem] rounded-lg" />
      ))}
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Status label="Loading games" />
      <Title>Games</Title>
      <Skeleton className="h-12 rounded-md" />
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-pill" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function GameSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Status label="Loading game" />
      <h1 className="sr-only">Game</h1>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-64 rounded-lg sm:h-56" />
      <div className="grid gap-5 md:grid-cols-3">
        <Skeleton className="h-44 rounded-lg" />
        <Skeleton className="h-72 rounded-lg md:col-span-2" />
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Status label="Loading settings" />
      <Title>Settings</Title>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-48 rounded-lg" />
      ))}
    </div>
  );
}
