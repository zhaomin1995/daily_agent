"use client";

interface StatsBarProps {
  toolCount: number;
  readyCount: number;
  runningCount: number;
  briefingCount: number;
  lastRun: string | null;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export default function StatsBar({ toolCount, readyCount, runningCount, briefingCount, lastRun }: StatsBarProps) {
  const stats = [
    { label: "Tools", value: `${readyCount}/${toolCount} ready` },
    { label: "Running", value: runningCount, highlight: runningCount > 0 },
    { label: "Briefings", value: briefingCount },
    { label: "Last run", value: lastRun ? formatRelative(lastRun) : "Never" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-900">
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">{s.label}</p>
          <p className={`text-sm font-semibold mt-0.5 ${s.highlight ? "text-amber-600 dark:text-amber-400" : ""}`}>
            {String(s.value)}
          </p>
        </div>
      ))}
    </div>
  );
}
