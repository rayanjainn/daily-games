import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <span role="status" className="sr-only">
        Loading group
      </span>
      <h1 className="sr-only">Group</h1>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}
