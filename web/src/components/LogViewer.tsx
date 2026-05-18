"use client";

import { useEffect, useState } from "react";

interface LogEntry {
  date: string;
  filename: string;
}

export default function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/logs")
      .then((r) => r.json())
      .then((data) => {
        setLogs(data);
        setLoading(false);
      });
  }, []);

  async function loadLog(date: string) {
    setSelected(date);
    setContent("");
    const res = await fetch(`/api/logs/${date}`);
    const data = await res.json();
    setContent(data.content || "");
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading logs...</p>;
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">
          No briefings yet. Run the Morning Briefing tool to generate your first one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-full">
      <div className="w-48 shrink-0">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Briefings
        </h3>
        <ul className="space-y-1">
          {logs.map((log) => (
            <li key={log.date}>
              <button
                onClick={() => loadLog(log.date)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  selected === log.date
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {log.date}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 min-w-0">
        {selected ? (
          <div>
            <h2 className="text-lg font-semibold mb-4">Briefing — {selected}</h2>
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 overflow-auto max-h-[70vh]">
              <pre className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">
                {content || "Loading..."}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
            Select a briefing to view
          </div>
        )}
      </div>
    </div>
  );
}
