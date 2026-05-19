"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="text-base font-bold mt-6 mb-2 pb-1 border-b border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-4 mb-1.5 text-zinc-700 dark:text-zinc-300">
      {children}
    </h3>
  ),
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
  ol: ({ children }) => (
    <ol className="my-2 space-y-2 list-none pl-0">{children}</ol>
  ),
  li: ({ children, ...props }) => {
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
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-zinc-400 dark:border-zinc-600 pl-3 my-2 text-zinc-500 dark:text-zinc-400 italic text-xs">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
      {children}
    </code>
  ),
  hr: () => <hr className="my-4 border-zinc-200 dark:border-zinc-700" />,
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

interface SearchResult {
  date: string;
  type: string;
  filename: string;
  excerpts: string[];
}

function groupLogs(data: LogEntry[]): GroupedLogs[] {
  const grouped: Record<string, GroupedLogs> = {};
  data.forEach((entry) => {
    if (!grouped[entry.date]) grouped[entry.date] = { date: entry.date };
    grouped[entry.date][entry.type] = entry;
  });
  return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
}

// Action prompts split by ## sections, each with its own copy button (#9)
function ActionPromptsView({ content }: { content: string }) {
  const [copied, setCopied] = useState<number | null>(null);
  const sections = content.split(/(?=^## )/m).filter(Boolean);

  function copySection(text: string, i: number) {
    navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
  }

  if (sections.length === 0) {
    return <p className="text-sm text-zinc-400 text-center py-8">No action prompts found.</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map((section, i) => {
        const lines = section.split("\n");
        const header = lines[0].replace(/^## /, "");
        const body = lines.slice(1).join("\n").trim();
        return (
          <div key={i} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 leading-snug">{header}</h3>
              <button
                onClick={() => copySection(body, i)}
                className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {copied === i ? "Copied!" : "Copy"}
              </button>
            </div>
            <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}

// Drafted email response cards parsed from the briefing (#10)
interface EmailDraft { to: string; subject: string; body: string; }

function parseDrafts(content: string): EmailDraft[] {
  const idx = content.indexOf("## Drafted Email Responses");
  if (idx === -1) return [];
  const section = content.slice(idx);
  const nextH2 = section.indexOf("\n## ", 4);
  const draftSection = nextH2 === -1 ? section : section.slice(0, nextH2);
  const draftBlocks = draftSection.split(/(?=^### )/m).slice(1);

  return draftBlocks.map((block) => {
    const toMatch = block.match(/\*\*To:\*\*\s*(.+)/);
    const subjectMatch = block.match(/\*\*Subject:\*\*\s*(.+)/);
    const bodyMatch = block.match(/\*\*Body:\*\*\n([\s\S]*?)(?=\n---|\n###|$)/);
    const header = block.split("\n")[0].replace(/^### /, "");
    return {
      to: toMatch?.[1]?.trim() ?? "",
      subject: subjectMatch?.[1]?.trim() ?? header,
      body: bodyMatch?.[1]?.trim() ?? "",
    };
  });
}

function EmailDraftCards({ content }: { content: string }) {
  const drafts = parseDrafts(content);
  const [copied, setCopied] = useState<number | null>(null);

  if (drafts.length === 0) {
    return <p className="text-sm text-zinc-400 text-center py-8">No drafted replies in this briefing.</p>;
  }

  function copyDraft(draft: EmailDraft, i: number) {
    navigator.clipboard.writeText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-4">
      {drafts.map((draft, i) => (
        <div key={i} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{draft.subject}</p>
              {draft.to && <p className="text-xs text-zinc-500 mt-0.5">To: {draft.to}</p>}
            </div>
            <button
              onClick={() => copyDraft(draft, i)}
              className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {copied === i ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{draft.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LogViewer() {
  const [logs, setLogs] = useState<GroupedLogs[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"email" | "workflow">("email");
  const [content, setContent] = useState<string>("");
  const [actionPrompts, setActionPrompts] = useState<string>("");
  const [contentView, setContentView] = useState<"brief" | "prompts" | "drafts">("brief");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLogs = useCallback(async () => {
    const data: LogEntry[] = await fetch("/api/logs").then((r) => r.json()).catch(() => []);
    setLogs(groupLogs(data));
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Auto-refresh every 30s to surface new briefings (#7)
  useEffect(() => {
    const interval = setInterval(async () => {
      const data: LogEntry[] = await fetch("/api/logs").then((r) => r.json()).catch(() => []);
      setLogs((prev) => {
        const next = groupLogs(data);
        const prevDates = prev.map((g) => g.date).join(",");
        const nextDates = next.map((g) => g.date).join(",");
        return prevDates !== nextDates ? next : prev;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadContent(date: string, type: "email" | "workflow") {
    setContent("");
    setActionPrompts("");
    setContentView("brief");
    setCurrentFilePath(`~/morning-brief/${date}-${type}.md`);

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

  function selectDate(date: string, type?: string) {
    const tab: "email" | "workflow" = type === "workflow" ? "workflow" : "email";
    setSelectedDate(date);
    setActiveTab(tab);
    loadContent(date, tab);
  }

  function switchTab(tab: "email" | "workflow") {
    setActiveTab(tab);
    if (selectedDate) loadContent(selectedDate, tab);
  }

  // Open current briefing file in the default editor (#8)
  async function openInEditor() {
    if (!currentFilePath) return;
    await fetch("/api/open-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: currentFilePath }),
    });
  }

  // Debounced search across all briefing files (#6)
  function handleSearchInput(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSearchResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const { results } = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .catch(() => ({ results: [] }));
      setSearchResults(results);
      setSearching(false);
    }, 350);
  }

  const selected = logs.find((l) => l.date === selectedDate);
  const hasDrafts = activeTab === "email" && content.includes("## Drafted Email Responses");

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

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 h-full">
      {/* Left panel: search + date list */}
      <div className="md:w-52 shrink-0">
        {/* Search input (#6) */}
        <div className="relative mb-3">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search briefings..."
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-accent placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSearchResults(null); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Search results or date list */}
        {searchResults !== null ? (
          <div>
            {searching ? (
              <p className="text-xs text-zinc-400 px-1 py-2">Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-zinc-400 px-1 py-2">No results for &ldquo;{searchQuery}&rdquo;</p>
            ) : (
              <>
                <p className="text-xs text-zinc-400 px-1 mb-2">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</p>
                <ul className="space-y-1">
                  {searchResults.map((result, i) => (
                    <li key={i}>
                      <button
                        onClick={() => selectDate(result.date, result.type)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{result.date}</span>
                          <span className="text-[10px] text-zinc-400 capitalize">{result.type}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 line-clamp-2">{result.excerpts[0]}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">
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
          </>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {selectedDate && selected ? (
          <div>
            {/* Tabs + toolbar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
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

              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                {/* Action Prompts toggle (#9) */}
                {actionPrompts && activeTab === "email" && (
                  <button
                    onClick={() => setContentView(contentView === "prompts" ? "brief" : "prompts")}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      contentView === "prompts"
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Action Prompts
                  </button>
                )}
                {/* Drafts toggle (#10) */}
                {hasDrafts && (
                  <button
                    onClick={() => setContentView(contentView === "drafts" ? "brief" : "drafts")}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      contentView === "drafts"
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Drafts
                  </button>
                )}
                {/* Open in editor (#8) */}
                <button
                  onClick={openInEditor}
                  title="Open file in editor"
                  className="text-xs px-2.5 py-1 rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open
                </button>
              </div>
            </div>

            {/* Markdown / prompts / drafts content */}
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 overflow-auto max-h-[60vh] md:max-h-[70vh]">
              {contentView === "prompts" ? (
                <ActionPromptsView content={actionPrompts} />
              ) : contentView === "drafts" ? (
                <EmailDraftCards content={content} />
              ) : (
                <ReactMarkdown components={markdownComponents}>
                  {content || "Loading..."}
                </ReactMarkdown>
              )}
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
