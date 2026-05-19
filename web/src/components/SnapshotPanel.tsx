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
    <div className="mb-6 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Today — {today}</h3>
        {data.nearestDeadline && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Next deadline: {data.nearestDeadline}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat
          value={data.urgent}
          label="Urgent"
          color={data.urgent > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-400"}
        />
        <Stat
          value={data.actionNeeded}
          label="Action Needed"
          color={data.actionNeeded > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-400"}
        />
        <Stat
          value={data.priorities}
          label="Priorities"
          color={data.priorities > 0 ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"}
        />
      </div>
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}
