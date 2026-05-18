"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ToolCard from "@/components/ToolCard";
import SkeletonCard from "@/components/Skeleton";
import PullToRefresh from "@/components/PullToRefresh";
import ActionItems from "@/components/ActionItems";

interface Tool {
  id: string;
  name: string;
  description: string;
  script: string;
  category: string;
  status: "ready" | "needs-setup";
  lastRun: string | null;
}

/* Restores saved tool order from localStorage, falling back to API order */
function applySavedOrder(tools: Tool[]): Tool[] {
  const saved = localStorage.getItem("tool-order");
  if (!saved) return tools;
  try {
    const order: string[] = JSON.parse(saved);
    const map = new Map(tools.map((t) => [t.id, t]));
    const ordered: Tool[] = [];
    for (const id of order) {
      const tool = map.get(id);
      if (tool) {
        ordered.push(tool);
        map.delete(id);
      }
    }
    // Append any new tools not in the saved order
    for (const tool of map.values()) {
      ordered.push(tool);
    }
    return ordered;
  } catch {
    return tools;
  }
}

export default function Dashboard() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchStartY = useRef(0);
  const touchDragIndex = useRef<number | null>(null);

  const fetchTools = useCallback(async () => {
    const res = await fetch("/api/tools");
    const data = await res.json();
    setTools(applySavedOrder(data));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  function saveOrder(newTools: Tool[]) {
    const order = newTools.map((t) => t.id);
    localStorage.setItem("tool-order", JSON.stringify(order));
  }

  /* Reorder tools by moving the item at fromIndex to toIndex */
  function reorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const updated = [...tools];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setTools(updated);
    saveOrder(updated);
  }

  // Desktop drag-and-drop handlers
  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(index: number) {
    if (dragIndex !== null) {
      reorder(dragIndex, index);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <PullToRefresh onRefresh={fetchTools}>
      <div className="p-4 sm:p-8 max-w-4xl">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1 mb-6 sm:mb-8">
          All automation tools in one place.
        </p>

        {/* Pinned action items from the latest briefing */}
        <ActionItems />

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
              <div
                key={tool.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                className={`transition-all duration-150 ${
                  dragIndex === i ? "opacity-50 scale-[0.98]" : ""
                } ${
                  dragOverIndex === i && dragIndex !== i
                    ? "border-t-2 border-zinc-400 dark:border-zinc-500 pt-1"
                    : ""
                }`}
              >
                {/* Drag handle visible on hover (desktop) */}
                <div className="group relative">
                  <div className="absolute -left-6 top-1/2 -translate-y-1/2 hidden md:group-hover:flex items-center cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-600">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                    </svg>
                  </div>
                  <ToolCard {...tool} index={i} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
