"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ActionItem {
  text: string;
  completed: boolean;
  source: string;
}

/* Pinned section at the top of the dashboard showing uncompleted action items
   carried over from the most recent briefing */
export default function ActionItems() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/briefing/actions")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setDate(data.date);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || items.length === 0) return null;

  // Show first 3 items by default, expand to show all
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
        {date && (
          <Link
            href="/logs"
            className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
          >
            From {date}
          </Link>
        )}
      </div>
      <ul className="space-y-1.5">
        {visible.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 shrink-0" />
            <span className="leading-relaxed">{item.text}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
        >
          {expanded ? "Show less" : `Show ${items.length - 3} more`}
        </button>
      )}
    </div>
  );
}
