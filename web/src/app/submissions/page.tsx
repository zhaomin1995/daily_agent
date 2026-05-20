"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Submission {
  id: string;
  title: string;
  journal: string;
  status: string;
  next_action: string;
  next_action_due: string | null;
  authors: { id: string }[];
}

const statusColors: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  revision: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  archived: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
};

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch("/api/submissions");
    const data = await res.json();
    setSubmissions(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  async function createNew() {
    setCreating(true);
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Manuscript" }),
    });
    const { id } = await res.json();
    window.location.href = `/submissions/${id}`;
  }

  async function archive(id: string) {
    const s = submissions.find((x) => x.id === id);
    if (!s) return;
    const newStatus = s.status === "archived" ? "draft" : "archived";
    setSubmissions((prev) => prev.map((x) => x.id === id ? { ...x, status: newStatus } : x));
    await fetch(`/api/submissions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function confirmDelete(id: string) {
    await fetch(`/api/submissions/${id}`, { method: "DELETE" });
    setSubmissions((prev) => prev.filter((x) => x.id !== id));
    setConfirmDeleteId(null);
  }

  const visible = submissions.filter((s) => showArchived ? s.status === "archived" : s.status !== "archived");
  const archivedCount = submissions.filter((s) => s.status === "archived").length;

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-sm mb-2">Delete manuscript?</h3>
            <p className="text-xs text-zinc-500 mb-5">This permanently removes the YAML file. Consider archiving instead.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={() => confirmDelete(confirmDeleteId)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Submissions</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage manuscript submissions and checklists.</p>
        </div>
        <button
          onClick={createNew}
          disabled={creating}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          {creating ? "Creating…" : "+ New Manuscript"}
        </button>
      </div>

      {!loading && archivedCount > 0 && (
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="mb-4 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline underline-offset-2"
        >
          {showArchived ? "← Back to active" : `Show ${archivedCount} archived`}
        </button>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3 mb-3" />
              <div className="h-4 bg-zinc-100 dark:bg-zinc-800/50 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl">
          <svg className="mx-auto mb-4 text-zinc-300 dark:text-zinc-600" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-zinc-400 dark:text-zinc-500 text-sm">{showArchived ? "No archived manuscripts." : "No manuscripts yet."}</p>
          {!showArchived && <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-1">Click &ldquo;+ New Manuscript&rdquo; to get started.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((s) => (
            <div
              key={s.id}
              className={`group border rounded-xl p-5 transition-colors ${s.status === "archived" ? "border-zinc-200 dark:border-zinc-800 opacity-60" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate">{s.title}</h3>
                  {s.journal && (
                    <p className="text-xs text-zinc-500 mt-1">{s.journal}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[s.status] || statusColors.draft}`}>
                      {s.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {s.authors?.length || 0} author{(s.authors?.length || 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {s.next_action && s.status !== "archived" && (
                    <p className="text-xs text-zinc-500 mt-2">
                      Next: {s.next_action}
                      {s.next_action_due && <span className="text-zinc-400 ml-1">· due {s.next_action_due}</span>}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Archive / unarchive */}
                  <button
                    onClick={() => archive(s.id)}
                    title={s.status === "archived" ? "Unarchive" : "Archive"}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  >
                    {s.status === "archived" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.5" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
                    )}
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => setConfirmDeleteId(s.id)}
                    title="Delete permanently"
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                  </button>
                  {s.status !== "archived" && (
                    <Link
                      href={`/submissions/${s.id}`}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Prepare →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
