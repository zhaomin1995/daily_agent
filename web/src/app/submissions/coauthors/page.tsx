"use client";

import { useEffect, useState, useRef } from "react";

interface Coauthor {
  id: string;
  name: string;
  credentials?: string;
  email: string;
  email_alt?: string;
  orcid?: string;
  role?: string;
  institution?: string;
  department?: string;
  city?: string;
  contributions?: string[];
}

const EMPTY_FORM: Omit<Coauthor, "id"> = {
  name: "", credentials: "", email: "", email_alt: "", orcid: "",
  role: "coauthor", institution: "", department: "", city: "", contributions: [],
};

function formatAuthorBlock(authors: Coauthor[]): string {
  // Collect unique affiliations in order
  const affMap = new Map<string, number>();
  authors.forEach((a) => {
    const aff = [a.department, a.institution, a.city].filter(Boolean).join(", ");
    if (aff && !affMap.has(aff)) affMap.set(aff, affMap.size + 1);
  });

  const nameLines = authors.map((a) => {
    const aff = [a.department, a.institution, a.city].filter(Boolean).join(", ");
    const supNum = aff ? affMap.get(aff) : null;
    const nameWithCreds = a.credentials ? `${a.name}, ${a.credentials}` : a.name;
    return supNum ? `${nameWithCreds}${supNum}` : nameWithCreds;
  }).join("; ");

  const affLines = [...affMap.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([aff, n]) => `${n} ${aff}`)
    .join("\n");

  const corrAuthor = authors.find((a) => a.role === "corresponding");
  const corrLine = corrAuthor
    ? `\nCorresponding author: ${corrAuthor.name}${corrAuthor.credentials ? `, ${corrAuthor.credentials}` : ""}\nEmail: ${corrAuthor.email}`
    : "";

  return `${nameLines}\n\n${affLines}${corrLine}`;
}

function formatContactSheet(authors: Coauthor[]): string {
  return authors.map((a, i) => {
    const lines = [
      `${i + 1}. ${a.name}${a.credentials ? ` ${a.credentials}` : ""}`,
      a.institution || "",
      a.department || "",
      a.city || "",
      a.email,
      a.email_alt ? `Alt: ${a.email_alt}` : "",
      a.orcid ? `ORCID: https://orcid.org/${a.orcid}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }).join("\n\n");
}

export default function CoauthorsPage() {
  const [authors, setAuthors] = useState<Coauthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportType, setExportType] = useState<"block" | "contacts">("block");
  const [copied, setCopied] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/coauthors").then((r) => r.json()).then((data) => {
      setAuthors(data);
      setLoading(false);
    });
  }, []);

  const filtered = authors.filter((a) => {
    const q = search.toLowerCase();
    return !q || a.name.toLowerCase().includes(q) || a.institution?.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((a) => a.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowAdd(true);
  }

  function openEdit(a: Coauthor) {
    const { id, ...rest } = a;
    setForm({ ...EMPTY_FORM, ...rest });
    setEditingId(id);
    setShowAdd(true);
  }

  async function saveForm() {
    setSaving(true);
    if (editingId) {
      await fetch("/api/coauthors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...form }),
      });
      setAuthors((prev) => prev.map((a) => a.id === editingId ? { ...a, ...form } : a));
    } else {
      const res = await fetch("/api/coauthors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const newAuthor = await res.json();
      setAuthors((prev) => [...prev, newAuthor]);
    }
    setSaving(false);
    setShowAdd(false);
    setEditingId(null);
  }

  async function deleteAuthor(id: string) {
    await fetch("/api/coauthors", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setAuthors((prev) => prev.filter((a) => a.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function generateExport(type: "block" | "contacts") {
    const selectedAuthors = authors.filter((a) => selected.has(a.id));
    setExportType(type);
    setExportText(type === "block" ? formatAuthorBlock(selectedAuthors) : formatContactSheet(selectedAuthors));
  }

  async function copyExport() {
    if (!exportText) return;
    await navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadExport() {
    if (!exportText) return;
    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `authors-${exportType}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedAuthors = authors.filter((a) => selected.has(a.id));

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      {/* Add/Edit modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-sm mb-4">{editingId ? "Edit Author" : "Add Author"}</h3>
            <div className="space-y-3">
              {([
                ["name", "Full Name *"],
                ["credentials", "Credentials (MPH, PhD, MD, etc.)"],
                ["email", "Email *"],
                ["email_alt", "Alt Email"],
                ["orcid", "ORCID (without https://orcid.org/)"],
                ["institution", "Institution"],
                ["department", "Department"],
                ["city", "City, State ZIP"],
              ] as [keyof typeof form, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs text-zinc-500 mb-1">{label}</label>
                  <input
                    type="text"
                    value={(form[field] as string) || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                    className="w-full px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 ring-zinc-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Role</label>
                <select value={form.role || "coauthor"} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none">
                  <option value="coauthor">Co-author</option>
                  <option value="corresponding">Corresponding Author</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={saveForm} disabled={saving || !form.name.trim()} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition-colors disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export modal */}
      {exportText !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{exportType === "block" ? "Author Block" : "Contact Sheet"}</h3>
              <div className="flex gap-2">
                <button onClick={copyExport} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button onClick={downloadExport} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition-colors">
                  Download .txt
                </button>
                <button onClick={() => setExportText(null)} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Close</button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto text-xs font-mono bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 whitespace-pre-wrap">{exportText}</pre>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Co-authors</h1>
          <p className="text-sm text-zinc-500 mt-1">{authors.length} authors · select any to export</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition-colors">
          + Add Author
        </button>
      </div>

      {/* Search + select controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input ref={searchRef} type="text" placeholder="Search by name, institution…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400" />
        </div>
        <button onClick={selectAll} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Select all</button>
        {selected.size > 0 && <button onClick={clearSelection} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Clear ({selected.size})</button>}
      </div>

      {/* Export bar — shown when authors selected */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl flex-wrap">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{selected.size} selected:</span>
          <button onClick={() => generateExport("block")}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition-colors">
            Author Block
          </button>
          <button onClick={() => generateExport("contacts")}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Contact Sheet
          </button>
          <span className="text-xs text-zinc-400 ml-1">Order: {selectedAuthors.map((a) => a.name.split(" ").slice(-1)[0]).join(", ")}</span>
        </div>
      )}

      {/* Author list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-14 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id}
              className={`group flex items-center gap-3 p-3 border rounded-xl transition-colors cursor-pointer ${selected.has(a.id) ? "border-zinc-400 dark:border-zinc-500 bg-zinc-50 dark:bg-zinc-800/60" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
              onClick={() => toggleSelect(a.id)}
            >
              {/* Checkbox */}
              <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${selected.has(a.id) ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-600"}`}>
                {selected.has(a.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white dark:text-zinc-900"><polyline points="20 6 9 17 4 12" /></svg>}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {a.name}{a.credentials ? <span className="text-zinc-400 font-normal ml-1">{a.credentials}</span> : null}
                  {a.role === "corresponding" && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">Corresponding</span>}
                </p>
                <p className="text-xs text-zinc-500 truncate">{[a.department, a.institution].filter(Boolean).join(", ")}</p>
                <p className="text-xs text-zinc-400 truncate">{a.email}{a.orcid ? ` · ORCID: ${a.orcid}` : ""}</p>
              </div>

              {/* Edit / delete on hover */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(a)} title="Edit" className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
                <button onClick={() => deleteAuthor(a.id)} title="Delete" className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
