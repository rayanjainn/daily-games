export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <h1 className="text-3xl sm:text-4xl">Notifications</h1>
      <div className="h-24 animate-pulse rounded-lg bg-surface-2" />
    </div>
  );
}
