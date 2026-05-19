"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

// Custom renderers that improve workflow log readability
const markdownComponents: Components = {
  // h2 sections get a bold header with a bottom border
  h2: ({ children }) => (
    <h2 className="text-base font-bold mt-6 mb-2 pb-1 border-b border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100">
      {children}
    </h2>
  ),
  // h3 subsections get a colored label
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-4 mb-1.5 text-zinc-700 dark:text-zinc-300">
      {children}
    </h3>
  ),
  // Tables with striped rows and visible borders
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-zinc-100 dark:bg-zinc-800">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 align-top text-zinc-600 dark:text-zinc-400">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="even:bg-zinc-50 dark:even:bg-zinc-900">{children}</tr>
  ),
  // Ordered lists styled as priority badges
  ol: ({ children }) => (
    <ol className="my-2 space-y-2 list-none pl-0">{children}</ol>
  ),
  li: ({ children, ...props }) => {
    // Only badge-style for ordered list items
    const ordered = (props as { ordered?: boolean }).ordered;
    if (ordered) {
      return (
        <li className="flex gap-3 items-start">
          <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-[10px] font-bold flex items-center justify-center mt-0.5">
            {(props as { index?: number }).index != null ? ((props as { index?: number }).index ?? 0) + 1 : "•"}
          </span>
          <span className="text-sm text-zinc-700 dark:text-zinc-300">{children}</span>
        </li>
      );
    }
    return <li className="text-sm text-zinc-700 dark:text-zinc-300 ml-4 list-disc">{children}</li>;
  },
  // Blockquotes (action prompts) with left accent
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-zinc-400 dark:border-zinc-600 pl-3 my-2 text-zinc-500 dark:text-zinc-400 italic text-xs">
      {children}
    </blockquote>
  ),
  // Inline code
  code: ({ children }) => (
    <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
      {children}
    </code>
  ),
  // Horizontal rules as dividers
  hr: () => <hr className="my-4 border-zinc-200 dark:border-zinc-700" />,
  // Strong text slightly emphasized
  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{children}</strong>
  ),
};

interface LogEntry {
  date: string;
  type: "email" | "workflow";
  filename: string;
}

interface GroupedLogs {
  date: string;
  email?: LogEntry;
  workflow?: LogEntry;
}

export default function LogViewer() {
  const [logs, setLogs] = useState<GroupedLogs[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"email" | "workflow">("email");
  const [content, setContent] = useState<string>("");
  const [actionPrompts, setActionPrompts] = useState<string>("");
  const [showActionPrompts, setShowActionPrompts] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/logs")
      .then((r) => r.json())
      .then((data: LogEntry[]) => {
        // Group by date
        const grouped: Record<string, GroupedLogs> = {};
        data.forEach((entry) => {
          if (!grouped[entry.date]) grouped[entry.date] = { date: entry.date };
          grouped[entry.date][entry.type] = entry;
        });
        setLogs(Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)));
        setLoading(false);
      });
  }, []);

  async function loadContent(date: string, type: "email" | "workflow") {
    setContent("");
    setActionPrompts("");
    setShowActionPrompts(false);

    const res = await fetch(`/api/logs/${date}-${type}`);
    if (res.ok) {
      const data = await res.json();
      setContent(data.content || "");
    }

    if (type === "email") {
      const apRes = await fetch(`/api/logs/${date}-action-prompts`);
      if (apRes.ok) {
        const apData = await apRes.json();
        setActionPrompts(apData.content || "");
      }
    }
  }

  function selectDate(date: string, tab: "email" | "workflow") {
    setSelectedDate(date);
    setActiveTab(tab);
    loadContent(date, tab);
  }

  function switchTab(tab: "email" | "workflow") {
    setActiveTab(tab);
    if (selectedDate) loadContent(selectedDate, tab);
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading logs...</p>;

  if (logs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">
          No briefings yet. Run Email Debriefing or Workflow Summary to generate your first one.
        </p>
      </div>
    );
  }

  const selected = logs.find((l) => l.date === selectedDate);

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 h-full">
      {/* Date list */}
      <div className="md:w-48 shrink-0">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Briefings
        </h3>
        <ul className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
          {logs.map((log) => (
            <li key={log.date} className="shrink-0">
              <button
                onClick={() => selectDate(log.date, log.email ? "email" : "workflow")}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap ${
                  selectedDate === log.date
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <span>{log.date}</span>
                <span className="ml-2 text-xs opacity-60">
                  {log.email && log.workflow ? "E+W" : log.email ? "E" : "W"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {selectedDate && selected ? (
          <div>
            {/* Tabs */}
            <div className="flex items-center gap-2 mb-4">
              {selected.email && (
                <button
                  onClick={() => switchTab("email")}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    activeTab === "email"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  Email
                </button>
              )}
              {selected.workflow && (
                <button
                  onClick={() => switchTab("workflow")}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    activeTab === "workflow"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  Workflow
                </button>
              )}
              {actionPrompts && activeTab === "email" && (
                <button
                  onClick={() => setShowActionPrompts((v) => !v)}
                  className="ml-auto text-xs px-3 py-1 rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {showActionPrompts ? "Show Briefing" : "Action Prompts"}
                </button>
              )}
            </div>

            {/* Markdown content */}
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 overflow-auto max-h-[60vh] md:max-h-[70vh]">
              <ReactMarkdown components={markdownComponents}>
                {showActionPrompts ? actionPrompts : content || "Loading..."}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 md:h-full text-zinc-400 text-sm">
            Select a briefing to view
          </div>
        )}
      </div>
    </div>
  );
}
