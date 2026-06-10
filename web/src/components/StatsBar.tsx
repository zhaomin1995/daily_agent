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
  // Each stat carries its own semantic hue (top accent bar + number color) so the
  // row reads as colorful rather than a wall of gray.
  const stats = [
    { label: "Tools", value: `${readyCount}/${toolCount} ready`, bar: "from-indigo-500 to-violet-500", text: "text-indigo-600 dark:text-indigo-400" },
    { label: "Running", value: runningCount, bar: runningCount > 0 ? "from-amber-400 to-orange-500" : "from-zinc-300 to-zinc-400 dark:from-zinc-700 dark:to-zinc-600", text: runningCount > 0 ? "text-amber-600 dark:text-amber-400" : "" },
    { label: "Briefings", value: briefingCount, bar: "from-fuchsia-500 to-pink-500", text: "text-fuchsia-600 dark:text-fuchsia-400" },
    { label: "Last run", value: lastRun ? formatRelative(lastRun) : "Never", bar: "from-sky-400 to-cyan-500", text: "text-sky-600 dark:text-sky-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="relative overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 pt-3 pb-2.5 bg-white dark:bg-zinc-900">
          <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.bar}`} />
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">{s.label}</p>
          <p className={`text-sm font-semibold mt-0.5 ${s.text}`}>
            {String(s.value)}
          </p>
        </div>
      ))}
    </div>
  );
}
