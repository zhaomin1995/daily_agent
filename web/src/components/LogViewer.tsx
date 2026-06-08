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
  badge?: number | null;
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

// Action prompts split by ## sections — each card supports inline editing + save to disk
function ActionPromptsView({ content, date }: { content: string; date: string }) {
  const [sections, setSections] = useState<string[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSections(content.split(/(?=^## )/m).filter(Boolean));
    setEditingIdx(null);
  }, [content]);

  useEffect(() => {
    if (editingIdx !== null) textareaRef.current?.focus();
  }, [editingIdx]);

  function getBody(section: string) {
    return section.split("\n").slice(1).join("\n").trim();
  }

  function startEdit(idx: number) {
    setEditBody(getBody(sections[idx]));
    setEditingIdx(idx);
  }

  function cancelEdit() {
    setEditingIdx(null);
    setEditBody("");
  }

  async function saveEdit(idx: number) {
    const header = sections[idx].split("\n")[0];
    const updated = [...sections];
    updated[idx] = `${header}\n\n${editBody}\n`;
    setSections(updated);
    setEditingIdx(null);
    setSaving(true);
    await fetch(`/api/logs/${date}-action-prompts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: updated.join("\n") }),
    });
    setSaving(false);
  }

  function copySection(body: string, i: number) {
    navigator.clipboard.writeText(body);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
  }

  if (sections.length === 0) {
    return <p className="text-sm text-zinc-400 text-center py-8">No action prompts found.</p>;
  }

  return (
    <div className="space-y-4">
      {saving && <p className="text-xs text-zinc-400 text-right">Saving…</p>}
      {sections.map((section, i) => {
        const lines = section.split("\n");
        const header = lines[0].replace(/^## /, "");
        const body = getBody(section);
        const isEditing = editingIdx === i;
        return (
          <div key={i} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 leading-snug">{header}</h3>
              <div className="flex items-center gap-1.5 shrink-0">
                {!isEditing && (
                  <button
                    onClick={() => startEdit(i)}
                    className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => copySection(isEditing ? editBody : body, i)}
                  className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {copied === i ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  ref={textareaRef}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={Math.max(4, editBody.split("\n").length + 1)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400 resize-y font-mono leading-relaxed"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(i)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Parse Document Summaries table from workflow brief into structured cards
interface DocSummary {
  filename: string;
  ext: string;
  badge: string | null;
  summary: string;
}

function parseDocumentSummaries(content: string): DocSummary[] {
  const idx = content.indexOf("## Document Summaries");
  if (idx === -1) return [];
  const after = content.slice(idx);
  const end = after.indexOf("\n## ", 4);
  const section = end === -1 ? after : after.slice(0, end);

  const docs: DocSummary[] = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (/^\|\s*[-:]+/.test(line)) continue; // separator row
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const fileCell = cells[0];
    const summary = cells[1];
    if (!summary || fileCell.toLowerCase() === "file") continue;

    const badgeMatch = fileCell.match(/\*\(([^)]+)\)\*/);
    const badge = badgeMatch ? badgeMatch[1] : null;
    const filename = fileCell
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*\([^)]+\)\*/g, "")
      .replace(/\*([^*]+)\*/g, "$1")
      .trim();
    const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() ?? "" : "";

    docs.push({ filename, ext, badge, summary });
  }
  return docs;
}

function WorkflowBriefView({ content }: { content: string }) {
  const docs = parseDocumentSummaries(content);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  function toggleExpanded(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  if (docs.length === 0) {
    return <p className="text-sm text-zinc-400 text-center py-8">No document summaries found.</p>;
  }

  const EXT_COLOR: Record<string, string> = {
    docx: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    doc: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    py: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    md: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    png: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    jpg: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    pdf: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };

  return (
    <div className="space-y-2">
      {docs.map((doc, i) => {
        const isOpen = expanded.has(i);
        const extCls = EXT_COLOR[doc.ext] ?? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
        return (
          <div key={i} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleExpanded(i)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-left"
            >
              {/* Chevron */}
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                className={`shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>

              <span className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{doc.filename}</span>

              <div className="flex items-center gap-1.5 shrink-0">
                {doc.badge && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    doc.badge === "new"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                  }`}>{doc.badge}</span>
                )}
                {doc.ext && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${extCls}`}>{doc.ext}</span>
                )}
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                <ReactMarkdown components={markdownComponents}>{doc.summary}</ReactMarkdown>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Parse Today's Priorities from workflow content into prompt cards
function parseWorkflowPrompts(content: string): { title: string; detail: string }[] {
  const idx = content.indexOf("## Today's Priorities");
  if (idx === -1) return [];
  const after = content.slice(idx);
  const end = after.indexOf("\n## ", 4);
  const section = end === -1 ? after : after.slice(0, end);
  const items: { title: string; detail: string }[] = [];
  for (const line of section.split("\n")) {
    const m = line.match(/^\d+\.\s+\*\*(.+?)\*\*(?:\s*[—-]+\s*(.+))?/);
    if (m) {
      items.push({ title: m[1].trim(), detail: (m[2] || "").trim() });
    }
  }
  return items;
}

// Workflow action prompts — in-memory editing only (derived from brief, not saved to disk)
function WorkflowActionPromptsView({ content }: { content: string }) {
  const parsed = parseWorkflowPrompts(content);
  const [prompts, setPrompts] = useState<string[]>(() =>
    parsed.map((item) => item.detail ? `${item.title}. ${item.detail}` : item.title)
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setPrompts(parsed.map((item) => item.detail ? `${item.title}. ${item.detail}` : item.title));
    setEditingIdx(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    if (editingIdx !== null) textareaRef.current?.focus();
  }, [editingIdx]);

  function startEdit(idx: number) {
    setEditText(prompts[idx]);
    setEditingIdx(idx);
  }

  function saveEdit(idx: number) {
    const updated = [...prompts];
    updated[idx] = editText;
    setPrompts(updated);
    setEditingIdx(null);
  }

  function copyPrompt(text: string, i: number) {
    navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
  }

  if (parsed.length === 0) {
    return <p className="text-sm text-zinc-400 text-center py-8">No priorities found in this briefing.</p>;
  }

  return (
    <div className="space-y-3">
      {prompts.map((prompt, i) => {
        const isEditing = editingIdx === i;
        const title = parsed[i]?.title || "";
        return (
          <div key={i} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                {!isEditing && (
                  <button
                    onClick={() => startEdit(i)}
                    className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => copyPrompt(isEditing ? editText : prompt, i)}
                  className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {copied === i ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            {isEditing ? (
              <div className="space-y-2 mt-2">
                <textarea
                  ref={textareaRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={Math.max(3, editText.split("\n").length + 1)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400 resize-y leading-relaxed"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(i)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => setEditingIdx(null)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{prompt}</p>
            )}
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

// Workflow priorities with live completion state — replaces the standalone Action Items page
interface ActionItem {
  id: string;
  text: string;
  date: string;
  completed: boolean;
  wontdo: boolean;
  source: string;
  priority?: string;
}

// date optional: if omitted, shows all items across all dates (global view)
function WorkflowPrioritiesView({ date }: { date?: string }) {
  const [allItems, setAllItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [doneOpen, setDoneOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const pendingUndoRef = useRef<{ restore: () => void; commit: () => void } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/action-items")
      .then((r) => r.json())
      .then((data: ActionItem[]) => {
        const relevant = (data as ActionItem[]).filter((i) =>
          (i.source === "workflow" || i.source === "manual") &&
          (date ? i.date === date : true)
        );
        // Sort by date descending, preserving original order within a day
        setAllItems(relevant.sort((a, b) => b.date.localeCompare(a.date)));
        setLoading(false);
      });
  }, [date]);

  function scheduleUndo(label: string, restore: () => void, commit: () => void) {
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); pendingUndoRef.current?.commit(); }
    pendingUndoRef.current = { restore, commit };
    setUndoLabel(label);
    undoTimerRef.current = setTimeout(() => { pendingUndoRef.current?.commit(); pendingUndoRef.current = null; setUndoLabel(null); }, 3500);
  }

  function handleUndo() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    pendingUndoRef.current?.restore();
    pendingUndoRef.current = null;
    setUndoLabel(null);
  }

  async function toggle(id: string, completed: boolean) {
    setAllItems((prev) => prev.map((i) => i.id === id ? { ...i, completed } : i));
    await fetch("/api/action-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed }),
    });
  }

  function markWontdo(id: string) {
    const item = allItems.find((i) => i.id === id);
    if (!item) return;
    setAllItems((prev) => prev.map((i) => i.id === id ? { ...i, wontdo: true } : i));
    scheduleUndo("Won't do",
      () => setAllItems((prev) => prev.map((i) => i.id === id ? { ...i, wontdo: false } : i)),
      () => fetch("/api/action-items", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, wontdo: true }) })
    );
  }

  function deleteItem(id: string) {
    const item = allItems.find((i) => i.id === id);
    if (!item) return;
    setAllItems((prev) => prev.filter((i) => i.id !== id));
    scheduleUndo("Item deleted",
      () => setAllItems((prev) => [...prev, item]),
      () => fetch("/api/action-items", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    );
  }

  async function addItem() {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    setNewText("");
    const res = await fetch("/api/action-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const item = await res.json();
    setAllItems((prev) => [...prev, item]);
    setAdding(false);
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (editingId !== null) editRef.current?.focus();
  }, [editingId]);

  function startEdit(item: ActionItem) {
    setEditingId(item.id);
    setEditText(item.text);
  }

  async function saveEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    setAllItems((prev) => prev.map((i) => i.id === id ? { ...i, text } : i));
    setEditingId(null);
    await fetch("/api/action-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, text }),
    });
  }

  if (loading) return <p className="text-sm text-zinc-400 py-4">Loading priorities...</p>;

  const openItems = allItems.filter((i) => !i.completed && !i.wontdo);
  const doneItems = allItems.filter((i) => i.completed || i.wontdo);
  const doneCount = allItems.filter((i) => i.completed).length;
  const activeCount = allItems.filter((i) => !i.wontdo).length;
  const pct = activeCount > 0 ? Math.round((doneCount / activeCount) * 100) : 0;

  function ItemDateBadge({ item }: { item: ActionItem }) {
    if (date) return null;
    return (
      <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full font-mono shrink-0">
        {new Date(item.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </span>
    );
  }

  return (
    <div className="relative space-y-5">
      {/* Progress summary */}
      {activeCount > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-zinc-400 shrink-0 font-medium">{doneCount} / {activeCount} done</span>
        </div>
      )}

      {/* Open tasks */}
      <div>
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Open {openItems.length > 0 && `(${openItems.length})`}
        </p>
        {openItems.length === 0 ? (
          <p className="text-sm text-zinc-400 py-2">All tasks complete.</p>
        ) : (
          <ul className="space-y-2">
            {openItems.map((item) => (
              <li key={item.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <textarea
                      ref={editRef}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(item.id); } if (e.key === "Escape") setEditingId(null); }}
                      rows={Math.max(2, editText.split("\n").length)}
                      className="w-full px-2 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400 resize-none leading-relaxed"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(item.id)} className="px-3 py-1 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity">Save</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => toggle(item.id, true)}
                        className="mt-0.5 shrink-0 w-4 h-4 rounded border border-zinc-300 dark:border-zinc-600 hover:border-zinc-500 transition-colors"
                      />
                      <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{item.text}</span>
                      <ItemDateBadge item={item} />
                    </div>
                    {/* Always-visible action row */}
                    <div className="flex items-center gap-1 mt-2 ml-6">
                      <button onClick={() => startEdit(item)} className="text-xs px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Edit</button>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <button onClick={() => markWontdo(item.id)} className="text-xs px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Won&apos;t do</button>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <button onClick={() => deleteItem(item.id)} className="text-xs px-2 py-0.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">Delete</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add new task */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Add a task…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-accent placeholder:text-zinc-400"
        />
        <button
          onClick={addItem}
          disabled={!newText.trim() || adding}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          Add
        </button>
      </div>

      {/* Done / Won't do — collapsible */}
      {doneItems.length > 0 && (
        <div>
          <button
            onClick={() => setDoneOpen((o) => !o)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mb-2"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${doneOpen ? "rotate-90" : ""}`}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Done &amp; Skipped ({doneItems.length})
          </button>
          {doneOpen && (
            <ul className="space-y-1.5">
              {doneItems.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                  {item.completed ? (
                    <button
                      onClick={() => toggle(item.id, false)}
                      className="mt-0.5 shrink-0 w-4 h-4 rounded border bg-zinc-900 border-zinc-900 dark:bg-zinc-100 dark:border-zinc-100 flex items-center justify-center"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-zinc-900">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  ) : (
                    <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-600 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                        <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                    </span>
                  )}
                  <span className={`flex-1 text-sm leading-relaxed ${item.completed ? "line-through text-zinc-400 dark:text-zinc-600" : "line-through text-zinc-400 italic"}`}>
                    {item.text}
                  </span>
                  <ItemDateBadge item={item} />
                  <button onClick={() => deleteItem(item.id)} title="Delete" className="shrink-0 p-1 rounded text-zinc-300 hover:text-red-400 dark:text-zinc-700 dark:hover:text-red-400 transition-colors">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Undo toast */}
      {undoLabel && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium px-3 py-2 rounded-xl shadow-lg">
            <span>{undoLabel}</span>
            <button onClick={handleUndo} className="px-2 py-0.5 rounded-md bg-white/20 dark:bg-zinc-900/20 hover:bg-white/30 transition-colors text-xs font-semibold">Undo</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LogViewer() {
  const [logs, setLogs] = useState<GroupedLogs[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"email" | "workflow" | "priorities">("priorities");
  const [content, setContent] = useState<string>("");
  const [actionPrompts, setActionPrompts] = useState<string>("");
  const [contentView, setContentView] = useState<"brief" | "prompts" | "drafts">("brief");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
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

  function switchTab(tab: "email" | "workflow" | "priorities") {
    setActiveTab(tab);
    if (tab !== "priorities" && selectedDate) loadContent(selectedDate, tab as "email" | "workflow");
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
  const hasWorkflowPrompts = activeTab === "workflow" && parseWorkflowPrompts(content).length > 0;

  function formatLogDate(dateStr: string): string {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (dateStr === today) return "Today";
    if (dateStr === yesterday) return "Yesterday";
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  function formatLogDateFull(dateStr: string): string {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading logs...</p>;

  if (logs.length === 0 && activeTab !== "priorities") {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400 dark:text-zinc-500 text-sm">
          No briefings yet. Run Email Debriefing or Workflow Summary to generate your first one.
        </p>
      </div>
    );
  }

  // Split logs into today vs archive for the sidebar
  const todayDate = new Date().toISOString().split("T")[0];
  const todayLog = logs.find((l) => l.date === todayDate);
  const archiveLogs = logs.filter((l) => l.date !== todayDate);

  // Sub-view pills for Email / Workflow tabs only (Priorities is now a top-level tab)
  const subViews: { key: "brief" | "prompts" | "drafts"; label: string }[] = [
    { key: "brief", label: "Brief" },
    ...((actionPrompts && activeTab === "email") || hasWorkflowPrompts ? [{ key: "prompts" as const, label: "Action Prompts" }] : []),
    ...(hasDrafts ? [{ key: "drafts" as const, label: "Drafts" }] : []),
  ];

  return (
    <div className="flex flex-col md:flex-row gap-0 h-full">
      {/* Left panel: search + date list (hidden when Priorities tab active on mobile) */}
      <div className={`md:w-52 shrink-0 md:border-r border-zinc-200 dark:border-zinc-800 md:pr-5 ${activeTab === "priorities" ? "hidden md:block" : ""}`}>
        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search briefings…"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-accent placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearchResults(null); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
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
              <p className="text-xs text-zinc-400 px-1 py-2">Searching…</p>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-zinc-400 px-1 py-2">No results for &ldquo;{searchQuery}&rdquo;</p>
            ) : (
              <>
                <p className="text-xs text-zinc-400 px-1 mb-2">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</p>
                <ul className="space-y-1">
                  {searchResults.map((result, i) => (
                    <li key={i}>
                      <button onClick={() => selectDate(result.date, result.type)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{formatLogDate(result.date)}</span>
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
            {/* Today */}
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">Today</p>
            {todayLog ? (() => {
              const isSelected = selectedDate === todayLog.date;
              const hasBadge = ((todayLog.email?.badge ?? 0) + (todayLog.workflow?.badge ?? 0)) > 0;
              return (
                <button
                  onClick={() => selectDate(todayLog.date, todayLog.email ? "email" : "workflow")}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${isSelected ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Today</span>
                    {hasBadge && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? "bg-white/60 dark:bg-zinc-900/60" : "bg-amber-400"}`} />}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {todayLog.email && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isSelected ? "bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"}`}>Email</span>}
                    {todayLog.workflow && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isSelected ? "bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"}`}>Workflow</span>}
                  </div>
                </button>
              );
            })() : (
              <p className="text-xs text-zinc-400 px-3 py-2">No briefing yet today.</p>
            )}

            {/* Archive — collapsible older days */}
            {archiveLogs.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setArchiveOpen((o) => !o)}
                  className="flex items-center gap-1.5 w-full px-1 mb-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${archiveOpen ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  Archive ({archiveLogs.length})
                </button>
                {archiveOpen && (
                  <ul className="space-y-0.5">
                    {archiveLogs.map((log) => {
                      const isSelected = selectedDate === log.date;
                      const hasBadge = ((log.email?.badge ?? 0) + (log.workflow?.badge ?? 0)) > 0;
                      return (
                        <li key={log.date}>
                          <button
                            onClick={() => selectDate(log.date, log.email ? "email" : "workflow")}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${isSelected ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">{formatLogDate(log.date)}</span>
                              {hasBadge && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? "bg-white/60 dark:bg-zinc-900/60" : "bg-amber-400"}`} />}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {log.email && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isSelected ? "bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"}`}>Email</span>}
                              {log.workflow && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isSelected ? "bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"}`}>Workflow</span>}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 md:pl-6">
        <div className="flex flex-col h-full">
          {/* Date header — only for Email/Workflow tabs when a date is selected */}
          {activeTab !== "priorities" && selectedDate && selected && (
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{formatLogDate(selectedDate)}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">{formatLogDateFull(selectedDate)}</p>
            </div>
          )}

          {/* Primary tabs: Email / Workflow / Priorities — always visible */}
          <div className="flex items-end border-b border-zinc-200 dark:border-zinc-800 mb-0">
            {selectedDate && selected?.email && (
              <button
                onClick={() => switchTab("email")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === "email"
                    ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                    : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                Email
              </button>
            )}
            {selectedDate && selected?.workflow && (
              <button
                onClick={() => switchTab("workflow")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === "workflow"
                    ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                    : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                Workflow
              </button>
            )}
            <button
              onClick={() => switchTab("priorities")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "priorities"
                  ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                  : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Priorities
            </button>
            {/* Open in editor — only for Email/Workflow tabs */}
            {activeTab !== "priorities" && selectedDate && (
              <button
                onClick={openInEditor}
                title="Open file in editor"
                className="ml-auto mb-1.5 text-xs px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open
              </button>
            )}
          </div>

          {/* Priorities tab: global view across all dates */}
          {activeTab === "priorities" ? (
            <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 overflow-auto max-h-[55vh] md:max-h-[70vh] mt-4">
              <WorkflowPrioritiesView />
            </div>
          ) : selectedDate && selected ? (
            <>
              {/* Secondary sub-view pills for Email/Workflow */}
              {subViews.length > 1 && (
                <div className="flex items-center gap-1 pt-3 pb-3">
                  {subViews.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => setContentView(v.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        contentView === v.key
                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
              {subViews.length <= 1 && <div className="pt-4" />}

              {/* Email/Workflow content */}
              <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 md:p-6 overflow-auto max-h-[55vh] md:max-h-[65vh]">
                {contentView === "prompts" && activeTab === "email" ? (
                  <ActionPromptsView content={actionPrompts} date={selectedDate} />
                ) : contentView === "prompts" && activeTab === "workflow" ? (
                  <WorkflowActionPromptsView content={content} />
                ) : contentView === "drafts" ? (
                  <EmailDraftCards content={content} />
                ) : contentView === "brief" && activeTab === "workflow" ? (
                  <WorkflowBriefView content={content} />
                ) : (
                  <ReactMarkdown components={markdownComponents}>
                    {content || "Loading…"}
                  </ReactMarkdown>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 md:h-full gap-2 text-center mt-8">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 dark:text-zinc-700">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p className="text-sm text-zinc-400">Select a briefing to read</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
