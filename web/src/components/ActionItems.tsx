"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ActionItem {
  id: string;
  text: string;
  date: string;
  completed: boolean;
  manual?: boolean;
}

export default function ActionItems() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/action-items")
      .then((r) => r.json())
      .then((data: ActionItem[]) => {
        setItems(data.filter((i) => !i.completed));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function toggle(id: string) {
    // Remove from widget immediately when checked
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch("/api/action-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed: true }),
    });
  }

  if (loading || items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 3);
  const hasMore = items.length > 3;

  return (
    <div className="mb-6 border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl p-4 sm:p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {items.length} action item{items.length !== 1 ? "s" : ""} pending
          </h3>
        </div>
        <Link href="/action-items" className="text-xs text-amber-600 dark:text-amber-400 hover:underline">
          View all →
        </Link>
      </div>

      <ul className="space-y-1.5">
        {visible.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5 group">
            <button
              onClick={() => toggle(item.id)}
              className="mt-0.5 shrink-0 w-4 h-4 rounded border border-amber-400/60 dark:border-amber-600/60 hover:bg-amber-200/50 dark:hover:bg-amber-800/40 flex items-center justify-center transition-colors"
              title="Mark done"
            />
            <span className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">{item.text}</span>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
        >
          {expanded ? "Show less" : `+${items.length - 3} more`}
        </button>
      )}
    </div>
  );
}
