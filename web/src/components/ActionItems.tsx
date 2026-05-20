"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Priority = "high" | "medium" | "low";
type Source = "workflow" | "email-urgent" | "email-action" | "manual";

interface ActionItem {
  id: string;
  text: string;
  date: string;
  completed: boolean;
  source: Source;
  priority?: Priority;
}

const SOURCE_BADGE: Record<Source, { label: string; className: string } | null> = {
  "email-urgent": { label: "Urgent", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  "email-action": { label: "Email", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  "workflow": null,
  "manual": null,
};

const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-zinc-400",
};

export default function ActionItems() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

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
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch("/api/action-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed: true }),
    });
  }

  if (loading || items.length === 0) return null;

  const todayItems = items.filter((i) => i.date === today);
  const olderCount = items.filter((i) => i.date !== today).length;
  const displayItems = todayItems.length > 0 ? todayItems : items;
  const visible = expanded ? displayItems : displayItems.slice(0, 4);
  const hasMore = displayItems.length > 4;

  return (
    <div className="mb-6 border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl p-4 sm:p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {todayItems.length > 0
              ? `${todayItems.length} item${todayItems.length !== 1 ? "s" : ""} today`
              : `${items.length} item${items.length !== 1 ? "s" : ""} pending`}
          </h3>
          {todayItems.length > 0 && olderCount > 0 && (
            <span className="text-xs text-amber-600/70 dark:text-amber-400/60">+{olderCount} older</span>
          )}
        </div>
        <Link href="/action-items" className="text-xs text-amber-600 dark:text-amber-400 hover:underline">
          View all →
        </Link>
      </div>

      <ul className="space-y-1.5">
        {visible.map((item) => {
          const badge = SOURCE_BADGE[item.source];
          return (
            <li key={item.id} className="flex items-start gap-2.5 group">
              <button
                onClick={() => toggle(item.id)}
                className="mt-0.5 shrink-0 w-4 h-4 rounded border border-amber-400/60 dark:border-amber-600/60 hover:bg-amber-200/50 dark:hover:bg-amber-800/40 flex items-center justify-center transition-colors"
                title="Mark done"
              />
              {item.priority && (
                <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${PRIORITY_DOT[item.priority]}`} title={item.priority} />
              )}
              <span className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed flex-1 min-w-0">
                {badge && (
                  <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1.5 align-middle ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
                {item.text}
              </span>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
        >
          {expanded ? "Show less" : `+${displayItems.length - 4} more`}
        </button>
      )}
    </div>
  );
}
