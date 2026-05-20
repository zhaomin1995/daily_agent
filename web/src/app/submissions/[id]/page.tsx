"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthorsTab from "./components/AuthorsTab";
import ChecklistTab from "./components/ChecklistTab";
import DocumentsTab from "./components/DocumentsTab";
import FilesTab from "./components/FilesTab";

interface Manuscript {
  id: string;
  title: string;
  journal: string;
  journal_abbrev: string;
  submission_type: string;
  status: string;
  submitted_date: string | null;
  decision_date: string | null;
  next_action: string;
  next_action_due: string | null;
  notes: string;
  authors: { id: string; order: number; contributions: string[] }[];
  keywords: string[];
  word_count: number | null;
  abstract_word_count: number | null;
  journal_requirements: {
    max_words: number | null;
    max_abstract_words: number | null;
    max_figures: number | null;
    max_tables: number | null;
    max_references: number | null;
    reference_style: string;
    required_sections: string[];
    checklist_type: string | null;
  };
  suggested_reviewers: { name: string; email: string; institution: string; reason: string }[];
  excluded_reviewers: string[];
}

const tabs = ["Overview", "Authors", "Checklist", "Files", "Documents"];

const statusOptions = ["draft", "submitted", "under_review", "revision", "accepted", "rejected"];
const typeOptions = ["original", "revision", "resubmission"];

export default function ManuscriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ms, setMs] = useState<Manuscript | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");
  const [deleting, setDeleting] = useState(false);

  const fetchManuscript = useCallback(async () => {
    const res = await fetch(`/api/submissions/${id}`);
    if (!res.ok) { router.push("/submissions"); return; }
    setMs(await res.json());
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchManuscript(); }, [fetchManuscript]);

  async function save(updates: Partial<Manuscript>) {
    setMs((prev) => prev ? { ...prev, ...updates } : prev);
    await fetch(`/api/submissions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  }

  async function handleDelete() {
    if (!confirm("Delete this manuscript?")) return;
    setDeleting(true);
    await fetch(`/api/submissions/${id}`, { method: "DELETE" });
    router.push("/submissions");
  }

  if (loading || !ms) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
          <div className="h-4 bg-zinc-100 dark:bg-zinc-800/50 rounded w-1/3" />
          <div className="h-64 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <button onClick={() => router.push("/submissions")} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 mb-2 block">
            ← Back to Submissions
          </button>
          <input
            type="text"
            value={ms.title}
            onChange={(e) => setMs({ ...ms, title: e.target.value })}
            onBlur={() => save({ title: ms.title })}
            className="text-xl sm:text-2xl font-bold tracking-tight bg-transparent border-none outline-none w-full"
            placeholder="Manuscript Title"
          />
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded transition-colors shrink-0"
        >
          Delete
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "Overview" && (
        <div className="space-y-4">
          {/* Compliance bars — shown when both count and limit are set */}
          {(() => {
            const bars = [
              { label: "Words", value: ms.word_count, max: ms.journal_requirements?.max_words },
              { label: "Abstract", value: ms.abstract_word_count, max: ms.journal_requirements?.max_abstract_words },
            ].filter((b) => b.value != null && b.max != null) as { label: string; value: number; max: number }[];
            if (bars.length === 0) return null;
            return (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-medium text-zinc-500">Compliance</h3>
                {bars.map((b) => {
                  const pct = Math.min(100, Math.round((b.value / b.max) * 100));
                  const over = b.value > b.max;
                  return (
                    <div key={b.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-500">{b.label}</span>
                        <span className={over ? "text-red-500 font-medium" : "text-zinc-500"}>
                          {b.value.toLocaleString()} / {b.max.toLocaleString()} words{over ? " — over limit" : ""}
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : pct > 90 ? "bg-amber-400" : "bg-green-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Journal">
              <input
                type="text"
                value={ms.journal || ""}
                onChange={(e) => setMs({ ...ms, journal: e.target.value })}
                onBlur={() => save({ journal: ms.journal })}
                className="field-input"
                placeholder="Journal of Example Medicine"
              />
            </Field>
            <Field label="Journal Abbreviation">
              <input
                type="text"
                value={ms.journal_abbrev || ""}
                onChange={(e) => setMs({ ...ms, journal_abbrev: e.target.value })}
                onBlur={() => save({ journal_abbrev: ms.journal_abbrev })}
                className="field-input"
                placeholder="J Example Med"
              />
            </Field>
            <Field label="Status">
              <select
                value={ms.status}
                onChange={(e) => { setMs({ ...ms, status: e.target.value }); save({ status: e.target.value }); }}
                className="field-input"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </Field>
            <Field label="Submission Type">
              <select
                value={ms.submission_type}
                onChange={(e) => { setMs({ ...ms, submission_type: e.target.value }); save({ submission_type: e.target.value }); }}
                className="field-input"
              >
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Submitted Date">
              <input
                type="date"
                value={ms.submitted_date || ""}
                onChange={(e) => { setMs({ ...ms, submitted_date: e.target.value || null }); save({ submitted_date: e.target.value || null }); }}
                className="field-input"
              />
            </Field>
            <Field label="Decision Date">
              <input
                type="date"
                value={ms.decision_date || ""}
                onChange={(e) => { setMs({ ...ms, decision_date: e.target.value || null }); save({ decision_date: e.target.value || null }); }}
                className="field-input"
              />
            </Field>
          </div>

          <Field label="Next Action">
            <input
              type="text"
              value={ms.next_action || ""}
              onChange={(e) => setMs({ ...ms, next_action: e.target.value })}
              onBlur={() => save({ next_action: ms.next_action })}
              className="field-input"
              placeholder="Prepare submission package"
            />
          </Field>

          <Field label="Next Action Due">
            <input
              type="date"
              value={ms.next_action_due || ""}
              onChange={(e) => { setMs({ ...ms, next_action_due: e.target.value || null }); save({ next_action_due: e.target.value || null }); }}
              className="field-input"
            />
          </Field>

          <Field label="Keywords (comma-separated)">
            <input
              type="text"
              value={(ms.keywords || []).join(", ")}
              onChange={(e) => setMs({ ...ms, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })}
              onBlur={() => save({ keywords: ms.keywords })}
              className="field-input"
              placeholder="epidemiology, cohort study, outcomes"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Word Count">
              <input
                type="number"
                value={ms.word_count ?? ""}
                onChange={(e) => setMs({ ...ms, word_count: e.target.value ? parseInt(e.target.value) : null })}
                onBlur={() => save({ word_count: ms.word_count })}
                className="field-input"
              />
            </Field>
            <Field label="Abstract Word Count">
              <input
                type="number"
                value={ms.abstract_word_count ?? ""}
                onChange={(e) => setMs({ ...ms, abstract_word_count: e.target.value ? parseInt(e.target.value) : null })}
                onBlur={() => save({ abstract_word_count: ms.abstract_word_count })}
                className="field-input"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={ms.notes || ""}
              onChange={(e) => setMs({ ...ms, notes: e.target.value })}
              onBlur={() => save({ notes: ms.notes })}
              className="field-input min-h-[100px] resize-y"
              placeholder="Internal notes about this submission…"
            />
          </Field>
        </div>
      )}

      {activeTab === "Authors" && (
        <AuthorsTab manuscriptId={id} authors={ms.authors || []} onSave={(authors) => save({ authors })} />
      )}

      {activeTab === "Checklist" && (
        <ChecklistTab
          manuscriptId={id}
          requirements={ms.journal_requirements}
          onSave={(journal_requirements) => save({ journal_requirements })}
          onJournalFetch={(info) => {
            const updates: Partial<Manuscript> = {};
            if (info.journal && !ms.journal) updates.journal = info.journal;
            if (info.journal_abbrev && !ms.journal_abbrev) updates.journal_abbrev = info.journal_abbrev;
            if (Object.keys(updates).length > 0) save(updates);
          }}
        />
      )}

      {activeTab === "Files" && (
        <FilesTab manuscriptId={id} journal={ms.journal} requirements={ms.journal_requirements} />
      )}

      {activeTab === "Documents" && (
        <DocumentsTab manuscriptId={id} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
