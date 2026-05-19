"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Priority = "high" | "medium" | "low";

interface ActionItem {
  id: string;
  text: string;
  date: string;
  completed: boolean;
  manual?: boolean;
  priority?: Priority;
}

const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-blue-400",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_CYCLE: (Priority | undefined)[] = [undefined, "high", "medium", "low"];

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function loadOrder(date: string): string[] {
  try { return JSON.parse(localStorage.getItem(`action-items-order-${date}`) || "[]"); }
  catch { return []; }
}

function saveOrder(ids: string[], date: string) {
  localStorage.setItem(`action-items-order-${date}`, JSON.stringify(ids));
}

function applyOrder(items: ActionItem[], order: string[]): ActionItem[] {
  if (!order.length) return items;
  const map = new Map(items.map((i) => [i.id, i]));
  const result: ActionItem[] = [];
  for (const id of order) { const item = map.get(id); if (item) { result.push(item); map.delete(id); } }
  for (const item of map.values()) result.push(item);
  return result;
}

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const [itemOrder, setItemOrder] = useState<Record<string, string[]>>({});
  const [dragFrom, setDragFrom] = useState<{ date: string; index: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ date: string; index: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const pendingUndoRef = useRef<{ restore: () => void; commit: () => void } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/action-items")
      .then((r) => r.json())
      .then((data: ActionItem[]) => {
        setItems(data);
        setLoading(false);
        // Load saved orders for each date
        const dates = [...new Set(data.map((i) => i.date))];
        const orders: Record<string, string[]> = {};
        dates.forEach((d) => { orders[d] = loadOrder(d); });
        setItemOrder(orders);
      });
  }, []);

  useEffect(() => { if (editingId) editRef.current?.focus(); }, [editingId]);
  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  // Schedule an undo-able action: update UI immediately, delay API call
  function scheduleUndo(label: string, restore: () => void, commit: () => void) {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      pendingUndoRef.current?.commit();
    }
    pendingUndoRef.current = { restore, commit };
    setUndoLabel(label);
    undoTimerRef.current = setTimeout(() => {
      pendingUndoRef.current?.commit();
      pendingUndoRef.current = null;
      setUndoLabel(null);
    }, 3500);
  }

  function handleUndo() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    pendingUndoRef.current?.restore();
    pendingUndoRef.current = null;
    setUndoLabel(null);
  }

  async function toggle(id: string, completed: boolean) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, completed } : i));
    await fetch("/api/action-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed }),
    });
  }

  async function markAllDone() {
    const openIds = items.filter((i) => !i.completed).map((i) => i.id);
    if (!openIds.length) return;
    setItems((prev) => prev.map((i) => ({ ...i, completed: true })));
    await fetch("/api/action-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-all-done", ids: openIds }),
    });
  }

  function clearCompleted() {
    const toRemove = items.filter((i) => i.completed);
    if (!toRemove.length) return;
    setItems((prev) => prev.filter((i) => !i.completed));
    scheduleUndo(
      `Cleared ${toRemove.length} item${toRemove.length !== 1 ? "s" : ""}`,
      () => setItems((prev) => [...prev, ...toRemove]),
      () => fetch("/api/action-items", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear-completed" }) })
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
    setItems((prev) => [...prev, item]);
    setAdding(false);
    inputRef.current?.focus();
  }

  async function saveEdit(id: string) {
    const text = editText.trim();
    if (!text) { setEditingId(null); return; }
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, text } : i));
    setEditingId(null);
    await fetch("/api/action-items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, text }),
    });
  }

  function deleteItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    scheduleUndo(
      "Item deleted",
      () => setItems((prev) => {
        const idx = prev.findIndex((i) => i.date <= item.date);
        const copy = [...prev];
        copy.splice(idx === -1 ? copy.length : idx, 0, item);
        return copy;
      }),
      () => fetch("/api/action-items", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    );
  }

  async function cyclePriority(item: ActionItem) {
    const curr = item.priority;
    const next = PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(curr) + 1) % PRIORITY_CYCLE.length];
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, priority: next } : i));
    await fetch("/api/action-items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, priority: next ?? null }),
    });
  }

  // Drag-to-reorder within a date group
  function handleDrop(date: string, toIndex: number) {
    if (!dragFrom || dragFrom.date !== date) return;
    const from = dragFrom.index;
    if (from === toIndex) return;
    const ordered = grouped[date];
    const reordered = [...ordered];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(toIndex, 0, moved);
    const newIds = reordered.map((i) => i.id);
    saveOrder(newIds, date);
    setItemOrder((prev) => ({ ...prev, [date]: newIds }));
    setDragFrom(null);
    setDragOver(null);
  }

  const filtered = useMemo(() => items.filter((item) => {
    const matchStatus = filter === "all" ? true : filter === "open" ? !item.completed : item.completed;
    const matchPriority = priorityFilter === "all" ? true : item.priority === priorityFilter;
    return matchStatus && matchPriority;
  }), [items, filter, priorityFilter]);

  const grouped = useMemo(() => {
    const result: Record<string, ActionItem[]> = {};
    filtered.forEach((item) => {
      if (!result[item.date]) result[item.date] = [];
      result[item.date].push(item);
    });
    return Object.fromEntries(
      Object.entries(result).map(([date, dateItems]) => [date, applyOrder(dateItems, itemOrder[date] || [])])
    );
  }, [filtered, itemOrder]);

  const openCount = items.filter((i) => !i.completed).length;
  const doneCount = items.filter((i) => i.completed).length;
  const completionPct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const hasPriorityItems = items.some((i) => i.priority);

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

      {/* Filter tabs + bulk actions */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex gap-1 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 w-fit">
          {(["open", "all", "done"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${filter === f ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"}`}>
              {f} {f === "open" ? `(${openCount})` : f === "done" ? `(${doneCount})` : `(${items.length})`}
            </button>
          ))}
        </div>
        {!loading && (
          <div className="flex items-center gap-2 ml-auto">
            {openCount > 0 && (
              <button onClick={markAllDone} className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Mark all done
              </button>
            )}
            {doneCount > 0 && (
              <button onClick={clearCompleted} className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Clear completed
              </button>
            )}
          </div>
        )}
      </div>

      {/* Priority filter — only shown once at least one item has a priority set */}
      {!loading && hasPriorityItems && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <span className="text-xs text-zinc-400 mr-0.5">Priority:</span>
          {(["all", "high", "medium", "low"] as const).map((p) => (
            <button key={p} onClick={() => setPriorityFilter(p)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${priorityFilter === p ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
              {p !== "all" && <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[p as Priority]}`} />}
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Add item input */}
      <div className="flex gap-2 mb-6">
        <input ref={inputRef} type="text" placeholder="Add an item..." value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-accent placeholder:text-zinc-400" />
        <button onClick={addItem} disabled={!newText.trim() || adding}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
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
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{formatDate(date)}</h3>
                <ul className="space-y-0.5">
                  {dateItems.map((item, i) => (
                    <li
                      key={item.id}
                      draggable
                      onDragStart={() => setDragFrom({ date, index: i })}
                      onDragOver={(e) => { e.preventDefault(); setDragOver({ date, index: i }); }}
                      onDrop={() => handleDrop(date, i)}
                      onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                      className={`flex items-start gap-2.5 group p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors ${dragFrom?.date === date && dragFrom?.index === i ? "opacity-40 scale-[0.98]" : ""} ${dragOver?.date === date && dragOver?.index === i && dragFrom?.index !== i ? "border-t-2 border-accent" : ""}`}
                    >
                      {/* Drag handle */}
                      <div className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg width="10" height="14" viewBox="0 0 10 18" fill="currentColor">
                          <circle cx="3" cy="3" r="1.5" /><circle cx="7" cy="3" r="1.5" />
                          <circle cx="3" cy="9" r="1.5" /><circle cx="7" cy="9" r="1.5" />
                          <circle cx="3" cy="15" r="1.5" /><circle cx="7" cy="15" r="1.5" />
                        </svg>
                      </div>

                      {/* Priority dot — always visible when set, appears on hover when not */}
                      <button
                        onClick={() => cyclePriority(item)}
                        title={item.priority ? `${PRIORITY_LABEL[item.priority]} priority (click to cycle)` : "Set priority"}
                        className={`mt-1.5 shrink-0 w-2 h-2 rounded-full transition-all ${item.priority ? PRIORITY_DOT[item.priority] : "bg-zinc-200 dark:bg-zinc-700 opacity-0 group-hover:opacity-60"}`}
                      />

                      {/* Checkbox */}
                      <button
                        onClick={() => toggle(item.id, !item.completed)}
                        className={`mt-0.5 shrink-0 w-4 h-4 rounded border transition-colors flex items-center justify-center ${item.completed ? "bg-zinc-900 border-zinc-900 dark:bg-zinc-100 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-500"}`}
                      >
                        {item.completed && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-zinc-900">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>

                      {/* Inline edit or display */}
                      {editingId === item.id ? (
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <input ref={editRef} value={editText} onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditingId(null); }}
                            className="flex-1 text-sm px-2 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-accent min-w-0" />
                          <button onClick={() => saveEdit(item.id)} className="shrink-0 text-xs px-2 py-0.5 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium">Save</button>
                          <button onClick={() => setEditingId(null)} className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <span className={`flex-1 text-sm leading-relaxed ${item.completed ? "line-through text-zinc-400 dark:text-zinc-600" : "text-zinc-700 dark:text-zinc-300"}`}>
                            {item.text}
                          </span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => { setEditingId(item.id); setEditText(item.text); }} title="Edit"
                              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button onClick={() => deleteItem(item.id)} title="Delete"
                              className="p-1 rounded text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}

      {/* Undo toast — fixed bottom center */}
      {undoLabel && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg z-50 animate-in slide-in-from-bottom-2">
          <span>{undoLabel}</span>
          <button onClick={handleUndo} className="px-2.5 py-0.5 rounded-md bg-white/20 dark:bg-zinc-900/20 hover:bg-white/30 dark:hover:bg-zinc-900/30 transition-colors text-xs font-semibold">
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
