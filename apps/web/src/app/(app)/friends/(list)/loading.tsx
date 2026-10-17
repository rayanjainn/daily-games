import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <span role="status" className="sr-only">
        Loading friends
      </span>
      <h1 className="text-3xl sm:text-4xl">Friends</h1>
      <Skeleton className="h-36 rounded-lg" />
      <Skeleton className="h-56 rounded-lg" />
    </div>
  );
}
