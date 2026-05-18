"use client";

import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./Toast";

interface ToolCardProps {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "ready" | "needs-setup";
  lastRun: string | null;
}

/* Formats an ISO timestamp into a human-readable relative time string */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ToolCard({ id, name, description, category, status, lastRun }: ToolCardProps) {
  const [running, setRunning] = useState(false);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  /* Streams the tool's stdout/stderr via SSE from the run API */
  async function handleRun() {
    setConfirmOpen(false);
    setRunning(true);
    setStdout("");
    setStderr("");
    setExitCode(null);
    setShowOutput(true);
    toast(`Starting ${name}...`, "info");

    try {
      const res = await fetch(`/api/tools/${id}/run`, { method: "POST" });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream");
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Parse complete SSE events from the buffer
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m);
          if (!match) continue;
          const event = JSON.parse(match[1]);

          if (event.type === "stdout") {
            setStdout((prev) => prev + event.text);
          } else if (event.type === "stderr") {
            setStderr((prev) => prev + event.text);
          } else if (event.type === "done") {
            setExitCode(event.exitCode);
            toast(
              event.exitCode === 0 ? `${name} completed successfully` : `${name} failed (exit ${event.exitCode})`,
              event.exitCode === 0 ? "success" : "error"
            );
          } else if (event.type === "error") {
            setStderr((prev) => prev + event.text);
            toast(`${name} error: ${event.text}`, "error");
          }
        }
      }
    } catch {
      setStderr("Request failed");
      toast(`Failed to run ${name}`, "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 bg-white dark:bg-zinc-900">
        {/* Header: badges + run button */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
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
            {/* Last run timestamp */}
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
              Last run: {lastRun ? formatRelativeTime(lastRun) : "Never"}
            </p>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={running}
            className="w-full sm:w-auto shrink-0 px-4 py-2.5 sm:py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin dark:border-zinc-900/30 dark:border-t-zinc-900" />
                Running...
              </span>
            ) : (
              "Run"
            )}
          </button>
        </div>

        {/* Streaming output — collapsible */}
        {showOutput && (stdout || stderr || exitCode !== null) && (
          <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {exitCode !== null ? (
                  <span className={`w-2 h-2 rounded-full ${exitCode === 0 ? "bg-emerald-500" : "bg-red-500"}`} />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
                <span className="text-xs font-medium text-zinc-500">
                  {exitCode !== null ? `Exit code: ${exitCode}` : "Running..."}
                </span>
              </div>
              {/* Dismiss button */}
              <button
                onClick={() => setShowOutput(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1"
                title="Dismiss output"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {stdout && (
              <pre className="text-xs bg-zinc-50 dark:bg-zinc-950 rounded-lg p-3 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-words">
                {stdout}
              </pre>
            )}
            {stderr && (
              <pre className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-lg p-3 mt-2 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                {stderr}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Run confirmation dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title={`Run ${name}?`}
        message="This will execute the tool script. Output will stream below the card."
        confirmLabel="Run"
        onConfirm={handleRun}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
