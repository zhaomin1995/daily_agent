"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthorsTab from "./components/AuthorsTab";
import ChecklistTab from "./components/ChecklistTab";
import DocumentsTab from "./components/DocumentsTab";
import FilesTab from "./components/FilesTab";

interface Manuscript {
  id: string;
  submission_kind: "manuscript" | "abstract";
  project_label: string;
  title: string;
  conference: string;
  conference_abbrev: string;
  presentation_type: string;
  deadline: string | null;
  word_limit: number | null;
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
  running_title: string;
  funding: string;
  irb_statement: string;
  data_availability: string;
  acknowledgments: string;
  conflicts_of_interest: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  revision: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const statusOptions = ["draft", "submitted", "under_review", "revision", "accepted", "rejected"];
const abstractStatusOptions = ["draft", "submitted", "accepted", "rejected"];
const typeOptions = ["original", "revision", "resubmission"];
const presentationTypeOptions = ["poster", "oral", "either"];

export default function ManuscriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ms, setMs] = useState<Manuscript | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");
  const [deleting, setDeleting] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState<{ id: string; title: string; project_label: string }[]>([]);
  const [cloneFrom, setCloneFrom] = useState("");
  const [cloneFields, setCloneFields] = useState<string[]>([]);
  const [showClone, setShowClone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [generatingShortTitle, setGeneratingShortTitle] = useState(false);
  const savedRef = useRef<string>("");

  const fetchManuscript = useCallback(async () => {
    const res = await fetch(`/api/submissions/${id}`);
    if (!res.ok) { router.push("/submissions"); return; }
    const data = await res.json();
    setMs(data);
    savedRef.current = JSON.stringify(data);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchManuscript(); }, [fetchManuscript]);

  useEffect(() => {
    fetch("/api/submissions").then((r) => r.json()).then((data) =>
      setAllSubmissions(data.map((s: Manuscript) => ({ id: s.id, title: s.title, project_label: s.project_label })))
    );
    fetch(`/api/submissions/${id}/files`).then((r) => r.json()).then((data) =>
      setFileCount(Array.isArray(data) ? data.length : 0)
    ).catch(() => {});
  }, [id]);

  function updateMs(updates: Partial<Manuscript>) {
    setMs((prev) => prev ? { ...prev, ...updates } : prev);
    setIsDirty(true);
  }

  async function applyClone() {
    if (!cloneFrom || cloneFields.length === 0) return;
    const res = await fetch(`/api/submissions/${cloneFrom}`);
    if (!res.ok) return;
    const src: Manuscript = await res.json();
    const updates: Partial<Manuscript> = {};
    const CLONEABLE: (keyof Manuscript)[] = ["authors", "funding", "irb_statement", "data_availability", "acknowledgments", "conflicts_of_interest", "keywords", "suggested_reviewers", "excluded_reviewers"];
    for (const f of cloneFields) {
      const key = f as keyof Manuscript;
      if (CLONEABLE.includes(key)) (updates as Record<string, unknown>)[key] = src[key];
    }
    setMs((prev) => prev ? { ...prev, ...updates } : prev);
    save(updates);
    setShowClone(false);
    setCloneFrom("");
    setCloneFields([]);
  }

  async function save(updates: Partial<Manuscript>) {
    setMs((prev) => {
      const next = prev ? { ...prev, ...updates } : prev;
      if (next) savedRef.current = JSON.stringify(next);
      return next;
    });
    setIsDirty(false);
    await fetch(`/api/submissions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  }

  async function saveAll() {
    if (!ms) return;
    setSaving(true);
    await fetch(`/api/submissions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ms),
    });
    savedRef.current = JSON.stringify(ms);
    setIsDirty(false);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function generateShortTitle() {
    if (!ms?.title?.trim()) return;
    setGeneratingShortTitle(true);
    const res = await fetch(`/api/submissions/${id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "running-title", full_title: ms.title }),
    });
    const data = await res.json();
    if (data.content) {
      setMs((prev) => prev ? { ...prev, running_title: data.content } : prev);
      save({ running_title: data.content });
    }
    setGeneratingShortTitle(false);
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
            onChange={(e) => updateMs({ title: e.target.value })}
            onBlur={() => save({ title: ms.title })}
            className="text-xl sm:text-2xl font-bold tracking-tight bg-transparent border-none outline-none w-full"
            placeholder="Manuscript Title"
          />
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={ms.project_label || ""}
              onChange={(e) => updateMs({ project_label: e.target.value })}
              onBlur={() => save({ project_label: ms.project_label })}
              placeholder="Label"
              className="text-xs px-2 py-0.5 rounded border border-dashed border-zinc-300 dark:border-zinc-700 bg-transparent text-violet-700 dark:text-violet-400 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 focus:outline-none focus:border-violet-400 w-20"
            />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[ms.status] || statusColors.draft}`}>
              {ms.status.replace(/_/g, " ")}
            </span>
            {ms.journal && (
              <span className="text-xs text-zinc-400 truncate max-w-xs">
                {ms.journal}{ms.journal_abbrev ? ` · ${ms.journal_abbrev}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={saveAll}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded transition-colors"
            >
              Delete
            </button>
          </div>
          <span className={`text-xs transition-opacity duration-300 ${saved ? "text-green-500 opacity-100" : isDirty ? "text-amber-500 opacity-100" : "opacity-0"}`}>
            {saved ? "Saved" : "Unsaved changes"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-6 overflow-x-auto">
        {(ms.submission_kind === "abstract"
          ? [{ key: "Overview" }, { key: "Authors", badge: ms.authors?.length || 0 }]
          : [{ key: "Overview" }, { key: "Authors", badge: ms.authors?.length || 0 }, { key: "Checklist" }, { key: "Files", badge: fileCount || null }, { key: "Documents" }]
        ).map(({ key, badge }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === key
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            {key}
            {badge != null && badge > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${activeTab === key ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Abstract overview form — simple fields only */}
      {ms.submission_kind === "abstract" && (
        <div className={activeTab === "Overview" ? "space-y-4" : "hidden"}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Conference">
              <input type="text" value={ms.conference || ""} onChange={(e) => updateMs({ conference: e.target.value })} onBlur={() => save({ conference: ms.conference })} className="field-input" placeholder="Cardio World Congress 2026" />
            </Field>
            <Field label="Conference Abbreviation">
              <input type="text" value={ms.conference_abbrev || ""} onChange={(e) => updateMs({ conference_abbrev: e.target.value })} onBlur={() => save({ conference_abbrev: ms.conference_abbrev })} className="field-input" placeholder="CWC 2026" />
            </Field>
            <Field label="Presentation Type">
              <select value={ms.presentation_type || "poster"} onChange={(e) => { updateMs({ presentation_type: e.target.value }); save({ presentation_type: e.target.value }); }} className="field-input">
                {presentationTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={ms.status} onChange={(e) => { updateMs({ status: e.target.value }); save({ status: e.target.value }); }} className="field-input">
                {abstractStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Submission Deadline">
              <input type="date" value={ms.deadline || ""} onChange={(e) => { updateMs({ deadline: e.target.value || null }); save({ deadline: e.target.value || null }); }} className="field-input" />
            </Field>
            <Field label="Submitted Date">
              <input type="date" value={ms.submitted_date || ""} onChange={(e) => { updateMs({ submitted_date: e.target.value || null }); save({ submitted_date: e.target.value || null }); }} className="field-input" />
            </Field>
            <Field label="Decision Date">
              <input type="date" value={ms.decision_date || ""} onChange={(e) => { updateMs({ decision_date: e.target.value || null }); save({ decision_date: e.target.value || null }); }} className="field-input" />
            </Field>
            <Field label="Word Limit">
              <input type="number" value={ms.word_limit ?? ""} onChange={(e) => updateMs({ word_limit: e.target.value ? parseInt(e.target.value) : null })} onBlur={() => save({ word_limit: ms.word_limit })} className="field-input" placeholder="300" />
            </Field>
            <Field label="Word Count">
              <input type="number" value={ms.word_count ?? ""} onChange={(e) => updateMs({ word_count: e.target.value ? parseInt(e.target.value) : null })} onBlur={() => save({ word_count: ms.word_count })} className="field-input" />
            </Field>
          </div>
          {/* Word count compliance bar */}
          {ms.word_count != null && ms.word_limit != null && (() => {
            const pct = Math.min(100, Math.round((ms.word_count / ms.word_limit) * 100));
            const over = ms.word_count > ms.word_limit;
            return (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-500">Word count</span>
                  <span className={over ? "text-red-500 font-medium" : "text-zinc-500"}>{ms.word_count} / {ms.word_limit}{over ? " — over limit" : ""}</span>
                </div>
                <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${over ? "bg-red-500" : pct > 90 ? "bg-amber-400" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
          <Field label="Notes">
            <textarea value={ms.notes || ""} onChange={(e) => updateMs({ notes: e.target.value })} onBlur={() => save({ notes: ms.notes })} className="field-input min-h-[100px] resize-y" placeholder="Internal notes…" />
          </Field>
        </div>
      )}

      {/* Manuscript overview form — full fields */}
      {ms.submission_kind !== "abstract" && (
      <div className={activeTab === "Overview" ? "space-y-4" : "hidden"}>
          {/* Copy from another manuscript */}
          {!showClone ? (
            <button
              onClick={() => setShowClone(true)}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-2"
            >
              Copy fields from another manuscript…
            </button>
          ) : (
            <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Copy from manuscript</p>
                <button onClick={() => { setShowClone(false); setCloneFrom(""); setCloneFields([]); }} className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
              </div>
              <select
                value={cloneFrom}
                onChange={(e) => setCloneFrom(e.target.value)}
                className="field-input text-xs"
              >
                <option value="">— Select manuscript —</option>
                {allSubmissions.filter((s) => s.id !== id).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.project_label ? `[${s.project_label}] ` : ""}{s.title}
                  </option>
                ))}
              </select>
              {cloneFrom && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      ["authors", "Authors"],
                      ["funding", "Funding"],
                      ["irb_statement", "IRB Statement"],
                      ["data_availability", "Data Availability"],
                      ["acknowledgments", "Acknowledgments"],
                      ["conflicts_of_interest", "Conflicts of Interest"],
                      ["keywords", "Keywords"],
                      ["suggested_reviewers", "Suggested Reviewers"],
                      ["excluded_reviewers", "Excluded Reviewers"],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cloneFields.includes(key)}
                          onChange={(e) => setCloneFields(e.target.checked ? [...cloneFields, key] : cloneFields.filter((f) => f !== key))}
                          className="rounded"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={applyClone}
                    disabled={cloneFields.length === 0}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
                  >
                    Apply {cloneFields.length > 0 ? `${cloneFields.length} field${cloneFields.length > 1 ? "s" : ""}` : ""}
                  </button>
                </>
              )}
            </div>
          )}

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
                onChange={(e) => updateMs({ journal: e.target.value })}
                onBlur={async () => {
                  save({ journal: ms.journal });
                  if (ms.journal?.trim() && !ms.journal_abbrev?.trim()) {
                    const res = await fetch(`/api/submissions/${id}/generate`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type: "journal-abbrev", journal_name: ms.journal }),
                    });
                    const data = await res.json();
                    if (data.abbrev) {
                      setMs((prev) => prev ? { ...prev, journal_abbrev: data.abbrev } : prev);
                      save({ journal_abbrev: data.abbrev });
                    }
                  }
                }}
                className="field-input"
                placeholder="Journal of Example Medicine"
              />
            </Field>
            <Field label="Journal Abbreviation">
              <input
                type="text"
                value={ms.journal_abbrev || ""}
                onChange={(e) => updateMs({ journal_abbrev: e.target.value })}
                onBlur={() => save({ journal_abbrev: ms.journal_abbrev })}
                className="field-input"
                placeholder="J Example Med"
              />
            </Field>
            <Field label="Status">
              <select
                value={ms.status}
                onChange={(e) => { updateMs({ status: e.target.value }); save({ status: e.target.value }); }}
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
                onChange={(e) => { updateMs({ submission_type: e.target.value }); save({ submission_type: e.target.value }); }}
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
                onChange={(e) => { updateMs({ submitted_date: e.target.value || null }); save({ submitted_date: e.target.value || null }); }}
                className="field-input"
              />
            </Field>
            <Field label="Decision Date">
              <input
                type="date"
                value={ms.decision_date || ""}
                onChange={(e) => { updateMs({ decision_date: e.target.value || null }); save({ decision_date: e.target.value || null }); }}
                className="field-input"
              />
            </Field>
          </div>

          <Field label="Next Action">
            <input
              type="text"
              value={ms.next_action || ""}
              onChange={(e) => updateMs({ next_action: e.target.value })}
              onBlur={() => save({ next_action: ms.next_action })}
              className="field-input"
              placeholder="Prepare submission package"
            />
          </Field>

          <Field label="Next Action Due">
            <input
              type="date"
              value={ms.next_action_due || ""}
              onChange={(e) => { updateMs({ next_action_due: e.target.value || null }); save({ next_action_due: e.target.value || null }); }}
              className="field-input"
            />
          </Field>

          <Field label="Keywords (comma-separated)">
            <input
              type="text"
              value={(ms.keywords || []).join(", ")}
              onChange={(e) => updateMs({ keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })}
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
                onChange={(e) => updateMs({ word_count: e.target.value ? parseInt(e.target.value) : null })}
                onBlur={() => save({ word_count: ms.word_count })}
                className="field-input"
              />
            </Field>
            <Field label="Abstract Word Count">
              <input
                type="number"
                value={ms.abstract_word_count ?? ""}
                onChange={(e) => updateMs({ abstract_word_count: e.target.value ? parseInt(e.target.value) : null })}
                onBlur={() => save({ abstract_word_count: ms.abstract_word_count })}
                className="field-input"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={ms.notes || ""}
              onChange={(e) => updateMs({ notes: e.target.value })}
              onBlur={() => save({ notes: ms.notes })}
              className="field-input min-h-[100px] resize-y"
              placeholder="Internal notes about this submission…"
            />
          </Field>

          {/* Administrative / Title Page Info */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wide">Title Page Info</h3>
            <div className="space-y-4">
              <Field label="Running Title">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ms.running_title || ""}
                    onChange={(e) => updateMs({ running_title: e.target.value })}
                    onBlur={() => save({ running_title: ms.running_title })}
                    className="field-input flex-1"
                    placeholder="Short title ≤ 50 characters"
                  />
                  <button
                    onClick={generateShortTitle}
                    disabled={generatingShortTitle || !ms.title?.trim()}
                    title="Generate running title with AI"
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 disabled:opacity-40 transition-colors font-medium shrink-0"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l1.88 5.76a1 1 0 00.95.69H21l-4.94 3.58a1 1 0 00-.36 1.12L17.56 20 12 16.42 6.44 20l1.86-5.85a1 1 0 00-.36-1.12L3 9.45h6.17a1 1 0 00.95-.69z"/>
                    </svg>
                    {generatingShortTitle ? "Generating…" : "Generate"}
                  </button>
                </div>
              </Field>
              <Field label="Funding Acknowledgment">
                <textarea
                  value={ms.funding || ""}
                  onChange={(e) => updateMs({ funding: e.target.value })}
                  onBlur={() => save({ funding: ms.funding })}
                  className="field-input resize-y min-h-[80px]"
                  placeholder="This work was supported by the National Institute of Diabetes and Digestive and Kidney Diseases (R01DK123456) to L.Y."
                />
              </Field>
              <Field label="Conflicts of Interest">
                <input
                  type="text"
                  value={ms.conflicts_of_interest || ""}
                  onChange={(e) => updateMs({ conflicts_of_interest: e.target.value })}
                  onBlur={() => save({ conflicts_of_interest: ms.conflicts_of_interest })}
                  className="field-input"
                  placeholder="There are no conflicts of interest in this study."
                />
              </Field>
              <Field label="Ethics / IRB Statement">
                <textarea
                  value={ms.irb_statement || ""}
                  onChange={(e) => updateMs({ irb_statement: e.target.value })}
                  onBlur={() => save({ irb_statement: ms.irb_statement })}
                  className="field-input resize-y min-h-[80px]"
                  placeholder="This study was approved by the University of Pittsburgh Institutional Review Board (Protocol No. STUDY21090203) and conducted in accordance with the Declaration of Helsinki."
                />
              </Field>
              <Field label="Data Availability">
                <textarea
                  value={ms.data_availability || ""}
                  onChange={(e) => updateMs({ data_availability: e.target.value })}
                  onBlur={() => save({ data_availability: ms.data_availability })}
                  className="field-input resize-y"
                  placeholder="The data that support the findings of this study are available from the corresponding author upon reasonable request."
                />
              </Field>
              <Field label="Acknowledgments">
                <textarea
                  value={ms.acknowledgments || ""}
                  onChange={(e) => updateMs({ acknowledgments: e.target.value })}
                  onBlur={() => save({ acknowledgments: ms.acknowledgments })}
                  className="field-input resize-y min-h-[80px]"
                  placeholder="We thank the research coordinators at…"
                />
              </Field>
            </div>
          </div>

          {/* Suggested Reviewers */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Suggested Reviewers</h3>
              <button
                onClick={() => {
                  const updated = [...(ms.suggested_reviewers || []), { name: "", email: "", institution: "", reason: "" }];
                  updateMs({ suggested_reviewers: updated });
                  save({ suggested_reviewers: updated });
                }}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                + Add reviewer
              </button>
            </div>
            <div className="space-y-3">
              {(ms.suggested_reviewers || []).map((r, i) => (
                <div key={i} className="border border-zinc-100 dark:border-zinc-800 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text" value={r.name} placeholder="Full name"
                      onChange={(e) => {
                        const updated = ms.suggested_reviewers!.map((x, j) => j === i ? { ...x, name: e.target.value } : x);
                        updateMs({ suggested_reviewers: updated });
                      }}
                      onBlur={() => save({ suggested_reviewers: ms.suggested_reviewers })}
                      className="field-input text-xs"
                    />
                    <input
                      type="email" value={r.email} placeholder="Email"
                      onChange={(e) => {
                        const updated = ms.suggested_reviewers!.map((x, j) => j === i ? { ...x, email: e.target.value } : x);
                        updateMs({ suggested_reviewers: updated });
                      }}
                      onBlur={() => save({ suggested_reviewers: ms.suggested_reviewers })}
                      className="field-input text-xs"
                    />
                    <input
                      type="text" value={r.institution} placeholder="Institution"
                      onChange={(e) => {
                        const updated = ms.suggested_reviewers!.map((x, j) => j === i ? { ...x, institution: e.target.value } : x);
                        updateMs({ suggested_reviewers: updated });
                      }}
                      onBlur={() => save({ suggested_reviewers: ms.suggested_reviewers })}
                      className="field-input text-xs"
                    />
                    <input
                      type="text" value={r.reason} placeholder="Area of expertise / reason"
                      onChange={(e) => {
                        const updated = ms.suggested_reviewers!.map((x, j) => j === i ? { ...x, reason: e.target.value } : x);
                        updateMs({ suggested_reviewers: updated });
                      }}
                      onBlur={() => save({ suggested_reviewers: ms.suggested_reviewers })}
                      className="field-input text-xs"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const updated = ms.suggested_reviewers!.filter((_, j) => j !== i);
                      updateMs({ suggested_reviewers: updated });
                      save({ suggested_reviewers: updated });
                    }}
                    className="text-xs text-red-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!(ms.suggested_reviewers?.length) && (
                <p className="text-xs text-zinc-400">No suggested reviewers yet.</p>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Excluded Reviewers</label>
              <input
                type="text"
                value={(ms.excluded_reviewers || []).join(", ")}
                onChange={(e) => updateMs({ excluded_reviewers: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                onBlur={() => save({ excluded_reviewers: ms.excluded_reviewers })}
                className="field-input text-xs"
                placeholder="Name 1, Name 2, Name 3"
              />
              <p className="text-xs text-zinc-400 mt-1">Comma-separated names of reviewers to exclude.</p>
            </div>
          </div>
      </div>
      )} {/* end manuscript overview */}

      {/* Always-mounted panels — hidden class preserves state across tab switches */}
      <div className={activeTab === "Authors" ? "" : "hidden"}>
        <AuthorsTab manuscriptId={id} authors={ms.authors || []} onSave={(authors) => save({ authors })} />
      </div>

      <div className={activeTab === "Checklist" && ms.submission_kind !== "abstract" ? "" : "hidden"}>
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
      </div>

      <div className={activeTab === "Files" && ms.submission_kind !== "abstract" ? "" : "hidden"}>
        <FilesTab
          manuscriptId={id}
          journal={ms.journal}
          requirements={ms.journal_requirements}
          onApply={(fields, authors) => {
            const updates: Partial<Manuscript> = { ...(fields as Partial<Manuscript>) };
            if (authors.length > 0) {
              const existing = new Set((ms.authors || []).map((a) => a.id));
              const newAuthors = authors.filter((a) => !existing.has(a.id)).map((a) => ({
                id: a.id,
                order: a.order,
                contributions: [],
              }));
              if (newAuthors.length > 0) {
                updates.authors = [...(ms.authors || []), ...newAuthors];
              }
            }
            updateMs({ ...updates });
            save(updates);
          }}
        />
      </div>

      <div className={activeTab === "Documents" && ms.submission_kind !== "abstract" ? "" : "hidden"}>
        <DocumentsTab manuscriptId={id} />
      </div>


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
