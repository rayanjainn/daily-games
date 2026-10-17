import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <span role="status" className="sr-only">
        Loading posts
      </span>
      <h1 className="sr-only">Community</h1>
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}
