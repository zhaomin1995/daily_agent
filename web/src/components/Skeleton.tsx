/* Skeleton placeholder that mimics a ToolCard shape while data is loading */
export default function SkeletonCard() {
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 bg-white dark:bg-zinc-900 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <div className="h-5 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
          <div className="h-4 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800/60" />
        </div>
        <div className="h-10 w-full sm:w-20 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
