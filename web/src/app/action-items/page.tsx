"use client";

// Unified "Today" view: a single ranked, interactive list that merges the email
// briefing's Urgent/Action-Needed items, the workflow summary's priorities, and
// any manually-added items (all from /api/action-items), plus today's
// ready-to-paste Claude Code action prompts. This is the destination of the
// "View all" link on the dashboard's ActionItems summary.

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { localDate } from "@/lib/date";
import Pill, { type PillTone } from "@/components/Pill";

type Priority = "high" | "medium" | "low";
type Source = "workflow" | "email-urgent" | "email-action" | "manual";

interface ActionItem {
  id: string;
  text: string;
  date: string;
  completed: boolean;
  wontdo: boolean;
  source: Source;
  priority?: Priority;
}

interface Summary {
  urgent: number;
  actionNeeded: number;
  priorities: number;
  nearestDeadline: string | null;
}

// Source badge: label + Pill tone, matching the per-source left rail color.
const SOURCE_PILL: Record<Source, { label: string; tone: PillTone }> = {
  "email-urgent": { label: "Urgent", tone: "red" },
  "email-action": { label: "Email", tone: "amber" },
  workflow: { label: "Workflow", tone: "indigo" },
  manual: { label: "Manual", tone: "zinc" },
};

const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-zinc-400",
};

// Left accent rail color per source, so rows are scannable by origin.
const SOURCE_BAR: Record<Source, string> = {
  "email-urgent": "border-red-400 dark:border-red-500",
  "email-action": "border-amber-400 dark:border-amber-500",
  workflow: "border-indigo-400 dark:border-indigo-500",
  manual: "border-zinc-300 dark:border-zinc-600",
};

// Ranking: Urgent first, then email actions, then workflow, then manual; within a
// source, explicit high/medium/low priority wins, then most recent date first.
const SOURCE_RANK: Record<Source, number> = { "email-urgent": 0, "email-action": 1, workflow: 2, manual: 3 };
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };

function rank(a: ActionItem, b: ActionItem): number {
  if (SOURCE_RANK[a.source] !== SOURCE_RANK[b.source]) return SOURCE_RANK[a.source] - SOURCE_RANK[b.source];
  const pa = PRIORITY_RANK[a.priority ?? "none"];
  const pb = PRIORITY_RANK[b.priority ?? "none"];
  if (pa !== pb) return pa - pb;
  return b.date.localeCompare(a.date);
}

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prompts, setPrompts] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [showPrompts, setShowPrompts] = useState(false);

  const today = localDate();

  // Pull the merged list, the snapshot counts, and today's action prompts together.
  const refresh = useCallback(async () => {
    const [itemsRes, summaryRes, promptsRes] = await Promise.all([
      fetch("/api/action-items").then((r) => r.json()).catch(() => []),
      fetch("/api/summary").then((r) => r.json()).catch(() => null),
      fetch(`/api/logs/${today}-action-prompts`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setItems(Array.isArray(itemsRes) ? itemsRes : []);
    setSummary(summaryRes);
    setPrompts(promptsRes?.content ?? null);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    refresh();
    // Re-pull when the tab regains focus, so toggles made elsewhere stay in sync.
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // Only open items belong in the ranked lists; completed/wontdo drop out.
  const open = useMemo(() => items.filter((i) => !i.completed && !i.wontdo).sort(rank), [items]);
  const todayOpen = useMemo(() => open.filter((i) => i.date === today), [open, today]);
  const earlierOpen = useMemo(() => open.filter((i) => i.date !== today), [open, today]);
  const doneToday = useMemo(
    () => items.filter((i) => i.date === today && (i.completed || i.wontdo)).length,
    [items, today]
  );

  // --- Mutations (optimistic, then persist) ---

  async function complete(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, completed: true } : i)));
    await fetch("/api/action-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed: true }),
    });
  }

  async function wontDo(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, wontdo: true } : i)));
    await fetch("/api/action-items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, wontdo: true }),
    });
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch("/api/action-items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  // Cycle priority none -> high -> medium -> low -> none on the flag click.
  async function cyclePriority(item: ActionItem) {
    const order: (Priority | null)[] = [null, "high", "medium", "low"];
    const cur = order.indexOf(item.priority ?? null);
    const next = order[(cur + 1) % order.length];
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, priority: next ?? undefined } : i)));
    await fetch("/api/action-items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, priority: next }),
    });
  }

  async function addItem() {
    const text = newItem.trim();
    if (!text) return;
    setNewItem("");
    const created: ActionItem = await fetch("/api/action-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then((r) => r.json());
    setItems((prev) => [...prev, created]);
  }

  const prettyDate = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight"><span className="text-gradient-brand">Today</span></h1>
          <p className="text-sm text-zinc-500 mt-0.5">{prettyDate}</p>
        </div>
        {summary?.nearestDeadline && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium border border-amber-200 dark:border-amber-900/40 rounded-full px-2.5 py-1">
            Next deadline: {summary.nearestDeadline}
          </span>
        )}
      </div>

      {/* Snapshot counts (mirrors the dashboard SnapshotPanel) */}
      {summary && (summary.urgent > 0 || summary.actionNeeded > 0 || summary.priorities > 0) && (
        <div className="flex flex-wrap gap-2.5 mt-5 mb-2">
          {summary.urgent > 0 && <Stat value={summary.urgent} label="Urgent" className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" />}
          {summary.actionNeeded > 0 && <Stat value={summary.actionNeeded} label="Action Needed" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" />}
          {summary.priorities > 0 && <Stat value={summary.priorities} label="Priorities" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" />}
        </div>
      )}

      {/* Quick add */}
      <div className="mt-6 flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="Add an item…"
          className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-accent placeholder:text-zinc-400"
        />
        <button
          onClick={addItem}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-brand text-white shadow-brand hover:opacity-90 transition-opacity"
        >
          Add
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400 mt-8">Loading…</p>
      ) : open.length === 0 ? (
        <div className="text-center py-16 mt-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl">
          <p className="text-zinc-400 dark:text-zinc-500 text-sm">Nothing open. {doneToday > 0 ? `${doneToday} done today.` : "Run the morning briefing to populate this."}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <ItemList title={`Today — ${todayOpen.length}`} items={todayOpen} onComplete={complete} onWontDo={wontDo} onRemove={remove} onCyclePriority={cyclePriority} />
          {earlierOpen.length > 0 && (
            <ItemList title={`Earlier, still open — ${earlierOpen.length}`} items={earlierOpen} muted onComplete={complete} onWontDo={wontDo} onRemove={remove} onCyclePriority={cyclePriority} />
          )}
          {doneToday > 0 && <p className="text-xs text-zinc-400">{doneToday} item{doneToday !== 1 ? "s" : ""} resolved today.</p>}
        </div>
      )}

      {/* Today's ready-to-paste Claude Code prompts */}
      {prompts && (
        <div className="mt-8 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowPrompts((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
          >
            <span>Action prompts (ready to paste)</span>
            <span className="text-zinc-400">{showPrompts ? "−" : "+"}</span>
          </button>
          {showPrompts && (
            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 prose-sm max-w-none text-sm text-zinc-600 dark:text-zinc-400">
              <ReactMarkdown>{prompts}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${className}`}>
      <span className="text-xl font-bold leading-none">{value}</span>
      <span className="text-[11px] font-medium leading-tight">{label}</span>
    </div>
  );
}

// A titled group of action rows with the complete / priority / won't-do / delete controls.
function ItemList({
  title,
  items,
  muted,
  onComplete,
  onWontDo,
  onRemove,
  onCyclePriority,
}: {
  title: string;
  items: ActionItem[];
  muted?: boolean;
  onComplete: (id: string) => void;
  onWontDo: (id: string) => void;
  onRemove: (id: string) => void;
  onCyclePriority: (item: ActionItem) => void;
}) {
  return (
    <div>
      <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${muted ? "text-zinc-400" : "text-zinc-500"}`}>{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => {
          const badge = SOURCE_PILL[item.source];
          return (
            <li key={item.id} className={`group flex items-start gap-2.5 rounded-lg border-l-2 pl-3 pr-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${SOURCE_BAR[item.source]}`}>
              {/* Complete */}
              <button
                onClick={() => onComplete(item.id)}
                className="mt-0.5 shrink-0 w-4 h-4 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:border-emerald-400 transition-all hover:scale-110 active:scale-90"
                title="Mark done"
              />
              {/* Priority flag (click to cycle) */}
              <button
                onClick={() => onCyclePriority(item)}
                className="mt-1.5 shrink-0"
                title={item.priority ? `Priority: ${item.priority} (click to change)` : "Set priority"}
              >
                <span className={`block w-2 h-2 rounded-full ${item.priority ? PRIORITY_DOT[item.priority] : "bg-zinc-200 dark:bg-zinc-700"}`} />
              </button>
              <span className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed flex-1 min-w-0">
                <Pill tone={badge.tone} className="mr-1.5 align-middle">{badge.label}</Pill>
                {item.text}
              </span>
              {/* Won't-do + delete (reveal on hover) */}
              <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onWontDo(item.id)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1" title="Won't do">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="5" y1="5" x2="19" y2="19" /></svg>
                </button>
                <button onClick={() => onRemove(item.id)} className="text-zinc-400 hover:text-red-500 p-1" title="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
