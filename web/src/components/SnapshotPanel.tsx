"use client";

import { useEffect, useState } from "react";

interface Summary {
  urgent: number;
  actionNeeded: number;
  priorities: number;
  nearestDeadline: string | null;
}

export default function SnapshotPanel() {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/summary").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data || (data.urgent === 0 && data.actionNeeded === 0 && data.priorities === 0 && !data.nearestDeadline)) return null;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="relative overflow-hidden mb-6 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 pl-5 bg-white dark:bg-zinc-900">
      {/* Brand accent rail */}
      <span className="absolute left-0 inset-y-0 w-1 bg-gradient-brand" />
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gradient-brand">Today — {today}</h3>
        {data.nearestDeadline && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Next deadline: {data.nearestDeadline}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {data.urgent > 0 && (
          <Stat value={data.urgent} label="Urgent" className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" />
        )}
        {data.actionNeeded > 0 && (
          <Stat value={data.actionNeeded} label="Action Needed" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" />
        )}
        {data.priorities > 0 && (
          <Stat value={data.priorities} label="Priorities" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" />
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${className}`}>
      <span className="text-xl font-bold leading-none">{value}</span>
      <span className="text-[11px] font-medium leading-tight">{label}</span>
    </div>
  );
}
