import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <span role="status" className="sr-only">
        Loading groups
      </span>
      <h1 className="text-3xl sm:text-4xl">Groups</h1>
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}
