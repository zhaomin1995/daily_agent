"use client";

import { useCallback, useEffect, useState } from "react";

interface JournalRequirements {
  max_words: number | null;
  max_abstract_words: number | null;
  max_figures: number | null;
  max_tables: number | null;
  max_references: number | null;
  reference_style: string;
  required_sections: string[];
  checklist_type: string | null;
}

interface ChecklistItem {
  item: string;
  checked: boolean;
  note: string;
}

export default function ChecklistTab({
  manuscriptId,
  requirements,
  onSave,
}: {
  manuscriptId: string;
  requirements: JournalRequirements;
  onSave: (requirements: JournalRequirements) => void;
}) {
  const [reqs, setReqs] = useState<JournalRequirements>(requirements);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [journalUrl, setJournalUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pastedText, setPastedText] = useState("");

  useEffect(() => { setReqs(requirements); }, [requirements]);

  const fetchChecklist = useCallback(async () => {
    if (!reqs.checklist_type) { setChecklist([]); return; }
    setChecklistLoading(true);
    const res = await fetch(`/api/submissions/${manuscriptId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "checklist" }),
    });
    const data = await res.json();
    setChecklist(data.items || []);
    setChecklistLoading(false);
  }, [manuscriptId, reqs.checklist_type]);

  useEffect(() => { fetchChecklist(); }, [fetchChecklist]);

  async function fetchJournalRequirements(usePaste = false) {
    if (usePaste ? !pastedText.trim() : !journalUrl.trim()) return;
    setFetching(true);
    setFetchResult(null);
    try {
      const res = await fetch(`/api/submissions/${manuscriptId}/fetch-journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(usePaste ? { text: pastedText.trim() } : { url: journalUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      // Merge extracted requirements into local state
      const extracted = data.extracted;
      const merged: JournalRequirements = {
        ...reqs,
        ...(extracted.max_words != null ? { max_words: extracted.max_words } : {}),
        ...(extracted.max_abstract_words != null ? { max_abstract_words: extracted.max_abstract_words } : {}),
        ...(extracted.max_figures != null ? { max_figures: extracted.max_figures } : {}),
        ...(extracted.max_tables != null ? { max_tables: extracted.max_tables } : {}),
        ...(extracted.max_references != null ? { max_references: extracted.max_references } : {}),
        ...(extracted.reference_style ? { reference_style: extracted.reference_style } : {}),
        ...(extracted.required_sections?.length ? { required_sections: extracted.required_sections } : {}),
        ...(extracted.checklist_type ? { checklist_type: extracted.checklist_type } : {}),
      };
      setReqs(merged);
      onSave(merged);
      setFetchResult({ ok: true, message: `Requirements fetched${extracted.journal_name ? ` from ${extracted.journal_name}` : ""}` });
      setShowPaste(false);
      setPastedText("");
    } catch (e) {
      const msg = (e as Error).message;
      setFetchResult({ ok: false, message: msg });
      // Suggest paste fallback on fetch errors
      if (msg.includes("403") || msg.includes("fetch")) setShowPaste(true);
    }
    setFetching(false);
  }

  function updateReq<K extends keyof JournalRequirements>(key: K, value: JournalRequirements[K]) {
    const updated = { ...reqs, [key]: value };
    setReqs(updated);
    onSave(updated);
  }

  function toggleItem(idx: number) {
    setChecklist((prev) => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item));
  }

  function updateNote(idx: number, note: string) {
    setChecklist((prev) => prev.map((item, i) => i === idx ? { ...item, note } : item));
  }

  const checkedCount = checklist.filter((i) => i.checked).length;
  const progress = checklist.length > 0 ? Math.round((checkedCount / checklist.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Journal URL fetch */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-1">Fetch from Journal Website</h3>
        <p className="text-xs text-zinc-500 mb-3">Paste the URL of the journal&apos;s author guidelines page — requirements will be extracted automatically.</p>
        <div className="flex gap-2">
          <input
            type="url"
            value={journalUrl}
            onChange={(e) => setJournalUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") fetchJournalRequirements(false); }}
            placeholder="https://www.journal.com/authors/guidelines"
            className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
          />
          <button
            onClick={() => fetchJournalRequirements(false)}
            disabled={fetching || !journalUrl.trim()}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition-colors disabled:opacity-50 shrink-0"
          >
            {fetching ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                Fetching…
              </span>
            ) : "Fetch Requirements"}
          </button>
        </div>
        {fetchResult && (
          <div className="mt-2">
            <p className={`text-xs ${fetchResult.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {fetchResult.ok ? "✓ " : "✗ "}{fetchResult.message}
            </p>
            {!fetchResult.ok && !showPaste && (
              <button onClick={() => setShowPaste(true)} className="mt-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-2">
                Site blocked automatic fetch — paste guidelines text instead
              </button>
            )}
          </div>
        )}

        {/* Paste fallback */}
        {showPaste && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-zinc-500">
              Open the journal guidelines page in your browser, select all text (⌘A), copy (⌘C), then paste below:
            </p>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste the journal guidelines text here…"
              rows={6}
              className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400 resize-y placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
            />
            <div className="flex gap-2">
              <button
                onClick={() => fetchJournalRequirements(true)}
                disabled={fetching || !pastedText.trim()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition-colors disabled:opacity-50"
              >
                {fetching ? "Extracting…" : "Extract Requirements"}
              </button>
              <button onClick={() => { setShowPaste(false); setPastedText(""); }} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Journal requirements */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Journal Requirements</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Max Words" value={reqs.max_words} onChange={(v) => updateReq("max_words", v)} />
          <NumField label="Max Abstract Words" value={reqs.max_abstract_words} onChange={(v) => updateReq("max_abstract_words", v)} />
          <NumField label="Max Figures" value={reqs.max_figures} onChange={(v) => updateReq("max_figures", v)} />
          <NumField label="Max Tables" value={reqs.max_tables} onChange={(v) => updateReq("max_tables", v)} />
          <NumField label="Max References" value={reqs.max_references} onChange={(v) => updateReq("max_references", v)} />
          <label className="block">
            <span className="text-xs font-medium text-zinc-500 mb-1 block">Reference Style</span>
            <select
              value={reqs.reference_style || ""}
              onChange={(e) => updateReq("reference_style", e.target.value)}
              className="field-input"
            >
              <option value="">Not specified</option>
              <option value="Vancouver">Vancouver</option>
              <option value="APA">APA</option>
              <option value="AMA">AMA</option>
              <option value="Chicago">Chicago</option>
            </select>
          </label>
        </div>
      </div>

      {/* Checklist type selector */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Reporting Checklist</h3>
        <div className="flex gap-2 mb-4">
          {["STROBE", "CONSORT", "PRISMA"].map((type) => (
            <button
              key={type}
              onClick={() => updateReq("checklist_type", reqs.checklist_type === type ? null : type)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                reqs.checklist_type === type
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        {checklist.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
              <span>{checkedCount} / {checklist.length} items completed</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Checklist items */}
        {checklistLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg" />)}
          </div>
        ) : checklist.length === 0 ? (
          <p className="text-sm text-zinc-400">Select a checklist type above to load items.</p>
        ) : (
          <div className="space-y-1">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleItem(i)}
                  className="mt-0.5 rounded shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${item.checked ? "line-through text-zinc-400" : ""}`}>
                    <span className="font-medium text-zinc-500 mr-1">{i + 1}.</span> {item.item}
                  </p>
                  <input
                    type="text"
                    value={item.note}
                    onChange={(e) => updateNote(i, e.target.value)}
                    placeholder="Notes…"
                    className="mt-1 w-full text-xs bg-transparent border-none outline-none text-zinc-400 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500 mb-1 block">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
        className="field-input"
        placeholder="—"
      />
    </label>
  );
}
