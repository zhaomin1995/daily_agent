"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface FileEntry {
  name: string;
  size: number;
  modified: string;
  category: string;
}

const CATEGORIES = [
  { value: "manuscript", label: "Manuscript" },
  { value: "blinded", label: "Blinded Manuscript" },
  { value: "figure", label: "Figure" },
  { value: "table", label: "Table" },
  { value: "supplementary", label: "Supplementary" },
  { value: "cover-letter", label: "Cover Letter" },
  { value: "other", label: "Other" },
];

// Which categories are required for a complete submission package
const REQUIRED_CATEGORIES = ["manuscript", "cover-letter"];
const COMMON_CATEGORIES = ["figure", "supplementary"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export default function FilesTab({ manuscriptId }: { manuscriptId: string }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("manuscript");
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    const res = await fetch(`/api/submissions/${manuscriptId}/files`);
    const data = await res.json();
    setFiles(data.files || []);
    setLoading(false);
  }, [manuscriptId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("category", uploadCategory);
    const res = await fetch(`/api/submissions/${manuscriptId}/files`, { method: "POST", body: form });
    if (res.ok) {
      await fetchFiles();
    } else {
      const data = await res.json();
      setUploadError(data.error || "Upload failed");
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
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  // Submission readiness: which required categories are present
  const presentCategories = new Set(files.map((f) => f.category));
  const ready = REQUIRED_CATEGORIES.every((c) => presentCategories.has(c));

  // Group files by category for display
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    files: files.filter((f) => f.category === cat.value),
  })).filter((g) => g.files.length > 0);

  return (
    <div className="space-y-5">
      {/* Readiness summary */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Submission Package</h3>
        <div className="flex flex-wrap gap-2">
          {REQUIRED_CATEGORIES.map((cat) => (
            <span key={cat} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              presentCategories.has(cat)
                ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
            }`}>
              <span>{presentCategories.has(cat) ? "✓" : "○"}</span>
              {categoryLabel(cat)}
            </span>
          ))}
          {COMMON_CATEGORIES.map((cat) => (
            <span key={cat} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              presentCategories.has(cat)
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
            }`}>
              <span>{presentCategories.has(cat) ? "✓" : "○"}</span>
              {categoryLabel(cat)}
            </span>
          ))}
          {ready && (
            <span className="ml-auto text-xs text-green-600 dark:text-green-400 font-medium self-center">
              ✓ Core files ready
            </span>
          )}
        </div>
      </div>

      {/* Upload zone */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">Upload File</h3>
        <div className="flex gap-2 mb-3">
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <span className="text-xs text-zinc-400 self-center">then drop a file or click below</span>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            dragOver
              ? "border-zinc-400 bg-zinc-50 dark:bg-zinc-800/50"
              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
          }`}
        >
          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Uploading…
            </div>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-300 dark:text-zinc-600">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-sm text-zinc-400">Drop file here or click to browse</span>
              <span className="text-xs text-zinc-300 dark:text-zinc-600">.docx, .pdf, .xlsx, .png, .jpg, or any format</span>
            </>
          )}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInput} />
        </div>
        {uploadError && <p className="mt-2 text-xs text-red-500">{uploadError}</p>}
      </div>

      {/* File list */}
      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg" />)}
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-4">No files uploaded yet.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.value}>
              <h4 className="text-xs font-medium text-zinc-500 mb-1.5">{group.label}</h4>
              <div className="space-y-1">
                {group.files.map((file) => (
                  <div key={file.name} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 group transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 shrink-0">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    <a
                      href={`/api/submissions/${manuscriptId}/files/${encodeURIComponent(file.name)}`}
                      className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 hover:underline truncate"
                      download
                    >
                      {file.name}
                    </a>
                    <span className="text-xs text-zinc-400 shrink-0">{formatSize(file.size)}</span>
                    <span className="text-xs text-zinc-300 dark:text-zinc-600 shrink-0 hidden sm:block">
                      {new Date(file.modified).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => deleteFile(file.name)}
                      className="text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
