"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/* Top-of-page progress bar that animates on route changes */
export default function LoadingBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Briefly show progress bar on navigation
    setLoading(true);
    setProgress(30);

    const t1 = setTimeout(() => setProgress(70), 100);
    const t2 = setTimeout(() => setProgress(100), 200);
    const t3 = setTimeout(() => setLoading(false), 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[80] h-0.5">
      <div
        className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
