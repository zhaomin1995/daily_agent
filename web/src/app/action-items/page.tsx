"use client";

import { useEffect, useState } from "react";

interface ActionItem {
  id: string;
  text: string;
  date: string;
  completed: boolean;
}

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");

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

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Action Items</h1>
      <p className="text-sm text-zinc-500 mt-1 mb-6">Tasks from your last 7 days of workflow briefings.</p>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 w-fit">
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
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{date}</h3>
                <ul className="space-y-1.5">
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
                      <span className={`text-sm leading-relaxed ${item.completed ? "line-through text-zinc-400 dark:text-zinc-600" : "text-zinc-700 dark:text-zinc-300"}`}>
                        {item.text}
                      </span>
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
