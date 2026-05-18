import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-6xl font-bold text-zinc-200 dark:text-zinc-800">404</h1>
      <h2 className="text-lg font-semibold mt-4">Page not found</h2>
      <p className="text-sm text-zinc-500 mt-2 max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 px-5 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
