"use client";

import { useEffect } from "react";

interface OutputModalProps {
  open: boolean;
  title: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  onClose: () => void;
}

/* Full-screen overlay for viewing tool output without the cramped card view */
export default function OutputModal({ open, title, stdout, stderr, exitCode, onClose }: OutputModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white dark:bg-zinc-950">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          {exitCode !== null ? (
            <span className={`w-2.5 h-2.5 rounded-full ${exitCode === 0 ? "bg-emerald-500" : "bg-red-500"}`} />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          )}
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="text-xs text-zinc-400">
            {exitCode !== null ? `Exit code: ${exitCode}` : "Running..."}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable output body */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {stdout && (
          <pre className="text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 sm:p-6 whitespace-pre-wrap break-words font-mono leading-relaxed">
            {stdout}
          </pre>
        )}
        {stderr && (
          <pre className="text-xs sm:text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-xl p-4 sm:p-6 mt-4 whitespace-pre-wrap break-words font-mono leading-relaxed">
            {stderr}
          </pre>
        )}
        {!stdout && !stderr && (
          <p className="text-sm text-zinc-400 text-center py-16">No output yet...</p>
        )}
      </div>
    </div>
  );
}
