"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import OutputModal from "./OutputModal";
import Pill, { type PillTone } from "./Pill";
import QuickActions from "./QuickActions";
import RunSparkline from "./RunSparkline";
import SuccessAnimation from "./SuccessAnimation";
import { useToast } from "./Toast";

interface ToolCardProps {
  id: string;
  name: string;
  description: string;
  script: string;
  category: string;
  status: "ready" | "needs-setup";
  lastRun: string | null;
  schedule: string | null;
  badge: number | null;
  index: number;
  type?: "script" | "link";
  href?: string;
}

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

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const DESC_CLAMP = 120;

// Per-category pill tone so cards read by category at a glance.
// "Daily Automation" matches automation first (indigo); plain "Daily" -> sky.
function categoryTone(category: string): PillTone {
  const c = category.toLowerCase();
  if (c.includes("research")) return "violet";
  if (c.includes("automation")) return "indigo";
  if (c.includes("daily")) return "sky";
  if (c.includes("setting")) return "slate";
  return "zinc";
}

export default function ToolCard({ id, name, description, script, category, status, lastRun, schedule, badge, index, type = "script", href }: ToolCardProps) {
  const [running, setRunning] = useState(false);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [outputTab, setOutputTab] = useState<"stdout" | "stderr">("stdout");
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [cancelledId, setCancelledId] = useState<ReturnType<typeof setTimeout> | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const isLongDesc = description.length > DESC_CLAMP;
  const displayDesc = isLongDesc && !descExpanded ? description.slice(0, DESC_CLAMP).trimEnd() + "..." : description;

  // Staggered entrance
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 80);
    return () => clearTimeout(timer);
  }, [index]);

  // Auto-scroll when enabled
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [stdout, stderr, autoScroll]);

  // Elapsed timer
  useEffect(() => {
    if (running) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  // Poll status on mount to detect if tool is already running
  useEffect(() => {
    fetch(`/api/tools/${id}/status`).then((r) => r.json()).then((d) => {
      if (d.running) setRunning(true);
    }).catch(() => {});
  }, [id]);

  function handleScrollOutput(e: React.UIEvent<HTMLPreElement>) {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    setAutoScroll(atBottom);
  }

  async function handleRun() {
    // Concurrent run guard
    const statusRes = await fetch(`/api/tools/${id}/status`);
    const statusData = await statusRes.json();
    if (statusData.running) {
      toast(`${name} is already running`, "error");
      return;
    }
    setRunning(true);
    setStdout("");
    setStderr("");
    setExitCode(null);
    setShowOutput(true);
    setAutoScroll(true);
    setOutputTab("stdout");
    setShowSuccess(false);
    toast(`Starting ${name}...`, "info");

    try {
      const res = await fetch(`/api/tools/${id}/run`, { method: "POST" });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m);
          if (!match) continue;
          const event = JSON.parse(match[1]);
          if (event.type === "stdout") setStdout((p) => p + event.text);
          else if (event.type === "stderr") setStderr((p) => p + event.text);
          else if (event.type === "done") {
            setExitCode(event.exitCode);
            if (event.exitCode === 0) {
              setShowSuccess(true);
              toast(`${name} completed successfully`, "success");
            } else {
              toast(`${name} failed (exit ${event.exitCode})`, "error");
            }
          } else if (event.type === "cancelled") {
            setExitCode(event.exitCode);
            toast(`${name} was cancelled`, "info");
          } else if (event.type === "error") {
            setStderr((p) => p + event.text);
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

  // Undo cancel: delays kill by 3 seconds, user can undo
  function handleCancel() {
    const tid = setTimeout(async () => {
      setCancelledId(null);
      try { await fetch(`/api/tools/${id}/run`, { method: "DELETE" }); }
      catch { toast("Failed to cancel", "error"); }
    }, 3000);
    setCancelledId(tid);
    toast("Cancelling in 3s... Click Undo to keep running", "info");
  }

  function handleUndoCancel() {
    if (cancelledId) {
      clearTimeout(cancelledId);
      setCancelledId(null);
      toast("Cancel undone — still running", "success");
    }
  }

  function copyOutput() {
    const text = outputTab === "stdout" ? stdout : stderr;
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "success");
  }

  function downloadOutput() {
    const text = outputTab === "stdout" ? stdout : stderr;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}-${outputTab}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeOutput = outputTab === "stdout" ? stdout : stderr;

  return (
    <>
      <div className={`tool-card relative overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 bg-white dark:bg-zinc-900 transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"} ${running ? "shadow-brand" : ""}`}>
        {/* Sliding gradient bar while the tool runs */}
        {running && <span className="absolute inset-x-0 top-0 h-1 animate-progress" />}
        {/* Top row: badges + quick actions */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={categoryTone(category)}>{category}</Pill>
            {status === "ready" ? (
              <Pill tone="emerald">Ready</Pill>
            ) : (
              <Link href="/config" className="hover:opacity-80 transition-opacity cursor-pointer">
                <Pill tone="amber">Needs Setup</Pill>
              </Link>
            )}
            {badge !== null && badge !== undefined && badge > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </div>
          <QuickActions toolId={id} scriptPath={script} lastRun={lastRun} />
        </div>

        <h3 className="text-base font-semibold">{name}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
          {displayDesc}
          {isLongDesc && (
            <button onClick={() => setDescExpanded(!descExpanded)} className="ml-1 text-zinc-900 dark:text-zinc-200 font-medium hover:underline">
              {descExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </p>

        {/* Meta row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
            <span>Last run: {lastRun ? formatRelativeTime(lastRun) : "Never"}</span>
            {schedule && (
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                {schedule}
              </span>
            )}
            <RunSparkline toolId={id} />
          </div>
          <div className="flex items-center gap-2">
            {type === "link" ? (
              <Link href={href || "/"} className="btn-brand w-full sm:w-auto shrink-0 px-4 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-1.5">
                Open
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            ) : (
              <>
                {cancelledId && (
                  <button onClick={handleUndoCancel} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors">
                    Undo
                  </button>
                )}
                {running ? (
                  <button onClick={handleCancel} className="w-full sm:w-auto shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors flex items-center justify-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                    Stop
                  </button>
                ) : (
                  <button onClick={handleRun} className="btn-brand w-full sm:w-auto shrink-0 px-4 py-2 text-sm font-medium rounded-lg">
                    Run
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <SuccessAnimation show={showSuccess} />

        {/* Output area with tabs */}
        {showOutput && (stdout || stderr || exitCode !== null) && (
          <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4 animate-expand">
            {/* Tab bar + controls */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <button onClick={() => setOutputTab("stdout")} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${outputTab === "stdout" ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"}`}>
                  stdout {stdout && <span className="ml-1 text-[10px] opacity-60">({stdout.split("\n").length}L)</span>}
                </button>
                <button onClick={() => setOutputTab("stderr")} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${outputTab === "stderr" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"}`}>
                  stderr {stderr && <span className="ml-1 text-[10px] opacity-60">({stderr.split("\n").length}L)</span>}
                </button>
                {exitCode !== null ? (
                  <span className={`ml-2 text-xs font-medium ${exitCode === 0 ? "text-emerald-600" : "text-red-600"}`}>Exit: {exitCode}</span>
                ) : (
                  <span className="ml-2 text-xs text-zinc-400">{formatElapsed(elapsed)}</span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                {!autoScroll && (
                  <button onClick={() => setAutoScroll(true)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1 text-[10px] font-medium" title="Jump to bottom">
                    ↓ Bottom
                  </button>
                )}
                <button onClick={copyOutput} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1" title="Copy">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                </button>
                <button onClick={downloadOutput} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1" title="Download">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                </button>
                <button onClick={() => setFullscreen(true)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1" title="Fullscreen">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                </button>
                <button onClick={() => setShowOutput(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1" title="Dismiss">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>
            {activeOutput ? (
              <pre ref={outputRef} onScroll={handleScrollOutput} className={`text-xs rounded-lg p-3 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-words ${outputTab === "stderr" ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20" : "bg-zinc-50 dark:bg-zinc-950"}`}>
                {activeOutput}
              </pre>
            ) : (
              <p className="text-xs text-zinc-400 text-center py-4">No {outputTab} output</p>
            )}
          </div>
        )}
      </div>

      <OutputModal open={fullscreen} title={`${name} — Output`} stdout={stdout} stderr={stderr} exitCode={exitCode} onClose={() => setFullscreen(false)} />
    </>
  );
}
