import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <span role="status" className="sr-only">
        Loading comparison
      </span>
      <h1 className="sr-only">Head to head</h1>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
    </div>
  );
}
