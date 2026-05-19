"use client";

import { useEffect, useRef, useState } from "react";

interface ActionItem {
  id: string;
  text: string;
  date: string;
  completed: boolean;
  manual?: boolean;
}

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  const d = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === d) return "Yesterday";
  const parsed = new Date(dateStr + "T12:00:00");
  return parsed.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/action-items")
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false); });
  }, []);

  async function toggle(id: string, completed: boolean) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, completed } : item));
    await fetch("/api/action-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed }),
    });
  }

  async function markAllDone() {
    const openIds = items.filter((i) => !i.completed).map((i) => i.id);
    if (openIds.length === 0) return;
    setItems((prev) => prev.map((item) => ({ ...item, completed: true })));
    await fetch("/api/action-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-done", ids: openIds }),
    });
  }

  async function clearCompleted() {
    setItems((prev) => prev.filter((i) => !i.completed));
    await fetch("/api/action-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear-completed" }),
    });
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
    setItems((prev) => [...prev, item]);
    setAdding(false);
    inputRef.current?.focus();
  }

  const filtered = items.filter((item) =>
    filter === "all" ? true : filter === "open" ? !item.completed : item.completed
  );

  const grouped = filtered.reduce<Record<string, ActionItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const openCount = items.filter((i) => !i.completed).length;
  const doneCount = items.filter((i) => i.completed).length;
  const completionPct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Action Items</h1>
      <p className="text-sm text-zinc-500 mt-1 mb-5">Tasks from your last 7 days of workflow briefings.</p>

      {/* Progress bar */}
      {!loading && items.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
            <span>{doneCount} of {items.length} completed</span>
            <span>{completionPct}%</span>
          </div>
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 w-fit">
          {(["open", "all", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                filter === f
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {f} {f === "open" ? `(${openCount})` : f === "done" ? `(${doneCount})` : `(${items.length})`}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {!loading && (
          <div className="flex items-center gap-2 ml-auto">
            {openCount > 0 && (
              <button
                onClick={markAllDone}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Mark all done
              </button>
            )}
            {doneCount > 0 && (
              <button
                onClick={clearCompleted}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Clear completed
              </button>
            )}
          </div>
        )}
      </div>

      {/* Manual add */}
      <div className="flex gap-2 mb-6">
        <input
          ref={inputRef}
          type="text"
          placeholder="Add an item..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-accent placeholder:text-zinc-400"
        />
        <button
          onClick={addItem}
          disabled={!newText.trim() || adding}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          Add
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
          <p className="text-zinc-400 text-sm">{filter === "open" ? "No open action items" : "Nothing here yet"}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dateItems]) => (
              <div key={date}>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  {formatDate(date)}
                </h3>
                <ul className="space-y-1">
                  {dateItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 group p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    >
                      <button
                        onClick={() => toggle(item.id, !item.completed)}
                        className={`mt-0.5 shrink-0 w-4 h-4 rounded border transition-colors ${
                          item.completed
                            ? "bg-zinc-900 border-zinc-900 dark:bg-zinc-100 dark:border-zinc-100"
                            : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-500"
                        } flex items-center justify-center`}
                      >
                        {item.completed && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-zinc-900">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 text-sm leading-relaxed ${item.completed ? "line-through text-zinc-400 dark:text-zinc-600" : "text-zinc-700 dark:text-zinc-300"}`}>
                        {item.text}
                      </span>
                      {item.manual && (
                        <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          manual
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
