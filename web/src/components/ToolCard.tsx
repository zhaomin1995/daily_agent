"use client";

import { useState } from "react";

interface ToolCardProps {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "ready" | "needs-setup";
}

export default function ToolCard({ id, name, description, category, status }: ToolCardProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ exitCode: number; stdout: string; stderr: string } | null>(null);

  async function handleRun() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`/api/tools/${id}/run`, { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ exitCode: -1, stdout: "", stderr: "Request failed" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {category}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                status === "ready"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              {status === "ready" ? "Ready" : "Needs Setup"}
            </span>
          </div>
          <h3 className="text-base font-semibold mt-2">{name}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{description}</p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
        >
          {running ? "Running..." : "Run"}
        </button>
      </div>

      {result && (
        <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`w-2 h-2 rounded-full ${
                result.exitCode === 0 ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-xs font-medium text-zinc-500">
              Exit code: {result.exitCode}
            </span>
          </div>
          {result.stdout && (
            <pre className="text-xs bg-zinc-50 dark:bg-zinc-950 rounded-lg p-3 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-words">
              {result.stdout}
            </pre>
          )}
          {result.stderr && (
            <pre className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-lg p-3 mt-2 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
              {result.stderr}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
