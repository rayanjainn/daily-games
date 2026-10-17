import { Skeleton } from '@/components/ui/skeleton';

/** Shown instantly while a page streams in, shaped like the page so nothing jumps. */
function Status({ label }: { label: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

export function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Status label="Loading today's games" />
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
      <Skeleton className="h-10 w-40" />
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
      <Skeleton className="h-10 w-48" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-48 rounded-lg" />
      ))}
    </div>
  );
}
