"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ToolCard from "@/components/ToolCard";
import SkeletonCard from "@/components/Skeleton";
import PullToRefresh from "@/components/PullToRefresh";
import StatsBar from "@/components/StatsBar";
import SnapshotPanel from "@/components/SnapshotPanel";
import ActionItems from "@/components/ActionItems";

interface Tool {
  id: string;
  name: string;
  description: string;
  script: string;
  category: string;
  status: "ready" | "needs-setup";
  lastRun: string | null;
  schedule: string | null;
  badge: number | null;
}

function applySavedOrder(tools: Tool[]): Tool[] {
  const saved = localStorage.getItem("tool-order");
  if (!saved) return tools;
  try {
    const order: string[] = JSON.parse(saved);
    const map = new Map(tools.map((t) => [t.id, t]));
    const ordered: Tool[] = [];
    for (const id of order) {
      const tool = map.get(id);
      if (tool) { ordered.push(tool); map.delete(id); }
    }
    for (const tool of map.values()) ordered.push(tool);
    return ordered;
  } catch { return tools; }
}

export default function Dashboard() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [briefingCount, setBriefingCount] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fetchTools = useCallback(async () => {
    const [toolsRes, configRes] = await Promise.all([
      fetch("/api/tools"),
      fetch("/api/config"),
    ]);
    const toolsData = await toolsRes.json();
    const configData = await configRes.json();
    setTools(applySavedOrder(toolsData));
    setBriefingCount(configData.briefingCount || 0);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  const filtered = useMemo(() => {
    if (!search.trim()) return tools;
    const q = search.toLowerCase();
    return tools.filter((t) =>
      t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.status.includes(q)
    );
  }, [tools, search]);

  function saveOrder(newTools: Tool[]) {
    localStorage.setItem("tool-order", JSON.stringify(newTools.map((t) => t.id)));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const updated = [...tools];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setTools(updated);
    saveOrder(updated);
  }

  function handleDragStart(i: number) { setDragIndex(i); }
  function handleDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setDragOverIndex(i); }
  function handleDrop(i: number) { if (dragIndex !== null) reorder(dragIndex, i); setDragIndex(null); setDragOverIndex(null); }
  function handleDragEnd() { setDragIndex(null); setDragOverIndex(null); }

  const readyCount = tools.filter((t) => t.status === "ready").length;
  const lastRun = tools.reduce<string | null>((latest, t) => {
    if (!t.lastRun) return latest;
    if (!latest) return t.lastRun;
    return t.lastRun > latest ? t.lastRun : latest;
  }, null);

  return (
    <PullToRefresh onRefresh={fetchTools}>
      <div className="p-4 sm:p-8 max-w-4xl">
        {/* Hero band: gradient title + soft mesh wash + colored stats */}
        <div className="hero-mesh rounded-2xl border border-zinc-100 dark:border-zinc-800/60 px-4 sm:px-6 py-5 sm:py-6 mb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="text-gradient-brand">Dashboard</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1 mb-5">All automation tools in one place.</p>

          {!loading && (
            <StatsBar toolCount={tools.length} readyCount={readyCount} runningCount={0} briefingCount={briefingCount} lastRun={lastRun} />
          )}
        </div>

        <SnapshotPanel />
        <ActionItems />

        {!loading && tools.length > 0 && (
          <div className="mb-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Filter tools..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-accent placeholder:text-zinc-400" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
            {search && <p className="text-xs text-zinc-400 mt-1.5">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>}
          </div>
        )}

        {loading ? (
          <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>
        ) : tools.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl">
            <svg className="mx-auto mb-4 text-zinc-300 dark:text-zinc-600" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">No tools registered yet.</p>
            <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-1">Add a tool in <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">src/lib/tools.ts</code> to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12"><p className="text-zinc-400 dark:text-zinc-500 text-sm">No tools match &ldquo;{search}&rdquo;</p></div>
        ) : (
          <div className="space-y-4">
            {filtered.map((tool, i) => (
              <div key={tool.id} draggable={!search} onDragStart={() => handleDragStart(i)} onDragOver={(e) => handleDragOver(e, i)} onDrop={() => handleDrop(i)} onDragEnd={handleDragEnd} className={`transition-all duration-150 ${dragIndex === i ? "opacity-50 scale-[0.98]" : ""} ${dragOverIndex === i && dragIndex !== i ? "border-t-2 border-zinc-400 dark:border-zinc-500 pt-1" : ""}`}>
                <div className="group relative">
                  {!search && <div className="absolute -left-6 top-1/2 -translate-y-1/2 hidden md:group-hover:flex items-center cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" /></svg></div>}
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
