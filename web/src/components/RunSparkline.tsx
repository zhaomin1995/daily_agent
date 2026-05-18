"use client";

import { useEffect, useState } from "react";

interface DayStatus {
  date: string;
  success: boolean | null;
}

export default function RunSparkline({ toolId }: { toolId: string }) {
  const [days, setDays] = useState<DayStatus[]>([]);

  useEffect(() => {
    fetch(`/api/tools/${toolId}/history`)
      .then((r) => r.json())
      .then(setDays)
      .catch(() => {});
  }, [toolId]);

  if (days.length === 0) return null;

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex items-center gap-1 mt-1" title="Last 7 days">
      {days.map((d, i) => (
        <div
          key={d.date}
          className={`w-2 h-2 rounded-full ${
            d.success === true
              ? "bg-emerald-500"
              : d.success === false
              ? "bg-red-500"
              : "bg-zinc-200 dark:bg-zinc-700"
          }`}
          title={`${d.date}: ${d.success === true ? "Success" : d.success === false ? "Failed" : "No run"}`}
        />
      ))}
    </div>
  );
}
