"use client";

import { useCallback, useEffect, useState } from "react";
import ToolCard from "@/components/ToolCard";
import SkeletonCard from "@/components/Skeleton";
import PullToRefresh from "@/components/PullToRefresh";

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "ready" | "needs-setup";
  lastRun: string | null;
}

export default function Dashboard() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTools = useCallback(async () => {
    const res = await fetch("/api/tools");
    const data = await res.json();
    setTools(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return (
    <PullToRefresh onRefresh={fetchTools}>
      <div className="p-4 sm:p-8 max-w-4xl">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1 mb-6 sm:mb-8">
          All automation tools in one place.
        </p>

        {loading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : tools.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl">
            <svg className="mx-auto mb-4 text-zinc-300 dark:text-zinc-600" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">
              No tools registered yet.
            </p>
            <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-1">
              Add a tool in <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">src/lib/tools.ts</code> to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tools.map((tool, i) => (
              <ToolCard key={tool.id} {...tool} index={i} />
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
