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
