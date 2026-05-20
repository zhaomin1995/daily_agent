"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface FileEntry {
  name: string;
  size: number;
  modified: string;
  category: string;
}

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

interface AnalysisResult {
  issues: string;
  editedManuscript: string;
  changesMade: string;
  wordCountOriginal: number;
  wordCountEdited: number | null;
}

const CATEGORIES = [
  { value: "manuscript", label: "Manuscript" },
  { value: "blinded", label: "Blinded" },
  { value: "figure", label: "Figure" },
  { value: "table", label: "Table" },
  { value: "supplementary", label: "Supplementary" },
  { value: "cover-letter", label: "Cover Letter" },
  { value: "other", label: "Other" },
];

const TASKS = [
  { id: "review", label: "Full Review & Edit", desc: "Identify all issues and apply all fixes" },
  { id: "trim", label: "Trim to Word Limit", desc: "Cut to fit the journal word limit", needsWordLimit: true },
  { id: "abstract", label: "Edit Abstract", desc: "Fix abstract length and structure" },
  { id: "sections", label: "Check Sections", desc: "Verify required sections are present" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesTab({
  manuscriptId,
  journal,
  requirements,
}: {
  manuscriptId: string;
  journal?: string;
  requirements?: JournalRequirements;
}) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("manuscript");
  const [dragOver, setDragOver] = useState(false);
  const [selectedManuscript, setSelectedManuscript] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    const res = await fetch(`/api/submissions/${manuscriptId}/files`);
    const data = await res.json();
    const fetched: FileEntry[] = data.files || [];
    setFiles(fetched);
    // Auto-select single manuscript file
    const manuscripts = fetched.filter((f) => f.category === "manuscript");
    if (manuscripts.length === 1 && !selectedManuscript) {
      setSelectedManuscript(manuscripts[0].name);
    }
    setLoading(false);
  }, [manuscriptId, selectedManuscript]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  async function uploadFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("category", uploadCategory);
    const res = await fetch(`/api/submissions/${manuscriptId}/files`, { method: "POST", body: form });
    if (res.ok) {
      await fetchFiles();
    }
    setUploading(false);
  }

  async function deleteFile(name: string) {
    await fetch(`/api/submissions/${manuscriptId}/files`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: name }),
    });
    setFiles((prev) => prev.filter((f) => f.name !== name));
    if (selectedManuscript === name) setSelectedManuscript(null);
  }

  async function analyze(task: string) {
    if (!selectedManuscript) return;
    setAnalyzing(true);
    setActiveTask(task);
    setResult(null);
    setAnalysisError(null);
    const res = await fetch(`/api/submissions/${manuscriptId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: selectedManuscript, task }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAnalysisError(data.error || "Analysis failed");
    } else {
      setResult(data as AnalysisResult);
    }
    setAnalyzing(false);
    setActiveTask(null);
  }

  async function copyEdited() {
    if (!result?.editedManuscript) return;
    await navigator.clipboard.writeText(result.editedManuscript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadEdited() {
    if (!result?.editedManuscript) return;
    const blob = new Blob([result.editedManuscript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edited-${selectedManuscript?.replace(/\.[^.]+$/, "") || "manuscript"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const manuscriptFiles = files.filter((f) => f.category === "manuscript" || f.category === "blinded");
  const otherFiles = files.filter((f) => f.category !== "manuscript" && f.category !== "blinded");
  const hasRequirements = requirements && (
    requirements.max_words || requirements.max_abstract_words || requirements.required_sections?.length
  );

  return (
    <div className="space-y-5">
      {/* Upload + File list */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400"
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 flex items-center justify-center gap-2 h-10 border-2 border-dashed rounded-lg cursor-pointer text-xs transition-colors ${
              dragOver ? "border-zinc-400 bg-zinc-50 dark:bg-zinc-800/50" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-400 hover:text-zinc-500"
            }`}
          >
            {uploading ? (
              <><svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> Uploading…</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg> Drop file or click to upload</>
            )}
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
        </div>

        {loading ? (
          <div className="animate-pulse h-8 bg-zinc-100 dark:bg-zinc-800 rounded" />
        ) : files.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-2">No files uploaded yet.</p>
        ) : (
          <div className="space-y-1">
            {files.map((file) => {
              const catLabel = CATEGORIES.find((c) => c.value === file.category)?.label ?? file.category;
              const isSelected = selectedManuscript === file.name;
              const isManuscriptType = file.category === "manuscript" || file.category === "blinded";
              return (
                <div
                  key={file.name}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors group ${
                    isSelected
                      ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/50"
                      : "border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                  }`}
                >
                  {isManuscriptType && (
                    <input
                      type="radio"
                      name="manuscript-select"
                      checked={isSelected}
                      onChange={() => setSelectedManuscript(file.name)}
                      className="shrink-0"
                      title="Select for AI analysis"
                    />
                  )}
                  <a
                    href={`/api/submissions/${manuscriptId}/files/${encodeURIComponent(file.name)}`}
                    className="flex-1 text-xs text-zinc-700 dark:text-zinc-300 hover:underline truncate"
                    download
                  >
                    {file.name}
                  </a>
                  <span className="text-xs text-zinc-400 shrink-0">{catLabel}</span>
                  <span className="text-xs text-zinc-300 dark:text-zinc-600 shrink-0">{formatSize(file.size)}</span>
                  <button
                    onClick={() => deleteFile(file.name)}
                    className="text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </div>
              );
            })}
            {manuscriptFiles.length > 0 && (
              <p className="text-xs text-zinc-400 pt-1">Select a manuscript file (radio) to analyze it below.</p>
            )}
          </div>
        )}
      </div>

      {/* AI Manuscript Assistant */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold">AI Manuscript Assistant</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {selectedManuscript
                ? `Working with: ${selectedManuscript}`
                : "Upload a manuscript file and select it above to get started."}
            </p>
          </div>
        </div>

        {/* Requirements summary */}
        {hasRequirements && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {journal && <Badge>{journal}</Badge>}
            {requirements?.max_words && <Badge>{requirements.max_words.toLocaleString()} words</Badge>}
            {requirements?.max_abstract_words && <Badge>Abstract ≤ {requirements.max_abstract_words}</Badge>}
            {requirements?.max_references && <Badge>≤ {requirements.max_references} refs</Badge>}
            {requirements?.reference_style && <Badge>{requirements.reference_style}</Badge>}
            {requirements?.checklist_type && <Badge>{requirements.checklist_type}</Badge>}
            {requirements?.required_sections?.map((s) => <Badge key={s}>{s}</Badge>)}
          </div>
        )}

        {!hasRequirements && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
            No journal requirements set — go to the Checklist tab to add them for better editing.
          </p>
        )}

        {/* Task buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {TASKS.map((task) => {
            const disabled = !selectedManuscript || analyzing || (task.needsWordLimit && !requirements?.max_words);
            return (
              <button
                key={task.id}
                onClick={() => analyze(task.id)}
                disabled={disabled}
                title={task.needsWordLimit && !requirements?.max_words ? "Set word limit in Checklist tab first" : task.desc}
                className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  analyzing && activeTask === task.id
                    ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                {analyzing && activeTask === task.id ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    Working…
                  </div>
                ) : (
                  <span className="text-xs font-medium">{task.label}</span>
                )}
                <span className="text-xs text-zinc-400 mt-0.5 leading-tight">{task.desc}</span>
              </button>
            );
          })}
        </div>

        {analyzing && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            Analyzing manuscript — this may take 1–3 minutes…
          </div>
        )}

        {analysisError && (
          <p className="text-xs text-red-500 py-2">{analysisError}</p>
        )}

        {result && !analyzing && (
          <div className="space-y-4 mt-2">
            {/* Issues */}
            {result.issues && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-500 mb-2">Issues Found</h4>
                <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-3 whitespace-pre-wrap">
                  {result.issues}
                </div>
              </div>
            )}

            {/* Edited manuscript */}
            {result.editedManuscript && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-zinc-500">
                    Edited Manuscript
                    {result.wordCountEdited != null && (
                      <span className="ml-2 font-normal text-zinc-400">
                        ({result.wordCountEdited.toLocaleString()} words
                        {result.wordCountOriginal && result.wordCountEdited !== result.wordCountOriginal
                          ? ` — was ${result.wordCountOriginal.toLocaleString()}`
                          : ""})
                      </span>
                    )}
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={copyEdited}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={downloadEdited}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Download .txt
                    </button>
                  </div>
                </div>
                <pre className="text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed font-sans max-h-[500px] overflow-y-auto">
                  {result.editedManuscript}
                </pre>
              </div>
            )}

            {/* Changes made */}
            {result.changesMade && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-500 mb-2">Changes Made</h4>
                <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-lg p-3 whitespace-pre-wrap">
                  {result.changesMade}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
      {children}
    </span>
  );
}
