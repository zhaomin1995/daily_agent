"use client";

import { useEffect, useState, useRef } from "react";

interface Affiliation {
  institution: string;
  department?: string;
  city?: string;
}

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
  affiliations?: Affiliation[];
  contributions?: string[];
}

interface OrcidResult {
  "orcid-identifier": { path: string; uri: string };
  person?: {
    name?: {
      "given-names"?: { value: string };
      "family-name"?: { value: string };
    };
  };
  "activities-summary"?: {
    employments?: {
      "affiliation-group"?: Array<{
        summaries?: Array<{
          "employment-summary"?: {
            organization?: { name: string };
            "department-name"?: string;
          };
        }>;
      }>;
    };
  };
}

type FormData = Omit<Coauthor, "id" | "affiliations"> & { affiliations: Affiliation[] };

const EMPTY_FORM: FormData = {
  name: "", credentials: "", email: "", email_alt: "", orcid: "",
  role: "coauthor", affiliations: [{ institution: "", department: "", city: "" }], contributions: [],
};

function getAffiliationStrings(a: Coauthor): string[] {
  if (a.affiliations && a.affiliations.length > 0) {
    return a.affiliations
      .filter((af) => af.institution || af.department || af.city)
      .map((af) => [af.department, af.institution, af.city].filter(Boolean).join(", "));
  }
  const single = [a.department, a.institution, a.city].filter(Boolean).join(", ");
  return single ? [single] : [];
}

function formatAuthorBlock(authors: Coauthor[]): string {
  const affMap = new Map<string, number>();
  authors.forEach((a) => {
    getAffiliationStrings(a).forEach((aff) => {
      if (!affMap.has(aff)) affMap.set(aff, affMap.size + 1);
    });
  });

  const nameLines = authors.map((a) => {
    const affs = getAffiliationStrings(a);
    const supNums = affs.map((aff) => affMap.get(aff)).filter(Boolean) as number[];
    const nameWithCreds = a.credentials ? `${a.name}, ${a.credentials}` : a.name;
    return supNums.length ? `${nameWithCreds}${supNums.join(",")}` : nameWithCreds;
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
    const affs = getAffiliationStrings(a);
    const lines = [
      `${i + 1}. ${a.name}${a.credentials ? ` ${a.credentials}` : ""}`,
      ...affs,
      a.email,
      a.email_alt ? `Alt: ${a.email_alt}` : "",
      a.orcid ? `ORCID: https://orcid.org/${a.orcid}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }).join("\n\n");
}

function getOrcidEmployment(r: OrcidResult): { institution: string; department: string } {
  const groups = r["activities-summary"]?.employments?.["affiliation-group"] || [];
  const first = groups[0]?.summaries?.[0]?.["employment-summary"];
  return {
    institution: first?.organization?.name || "",
    department: first?.["department-name"] || "",
  };
}

export default function CoauthorsPage() {
  const [authors, setAuthors] = useState<Coauthor[]>([]);
  const [loading, setLoading] = useState(true);
  // selectedOrder tracks both membership (Set for O(1) lookup) and sequence (array for ordering)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [dragOrderId, setDragOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportType, setExportType] = useState<"block" | "contacts" | "full">("block");
  const [copied, setCopied] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<Coauthor[] | null>(null);
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // ORCID search state
  const [showOrcidSearch, setShowOrcidSearch] = useState(false);
  const [orcidQuery, setOrcidQuery] = useState("");
  const [orcidResults, setOrcidResults] = useState<OrcidResult[]>([]);
  const [orcidLoading, setOrcidLoading] = useState(false);

  useEffect(() => {
    fetch("/api/coauthors").then((r) => r.json()).then((data) => {
      setAuthors(data);
      setLoading(false);
    });
  }, []);

  const filtered = authors.filter((a) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const affs = getAffiliationStrings(a).join(" ").toLowerCase();
    return a.name.toLowerCase().includes(q) || affs.includes(q) || a.email.toLowerCase().includes(q);
  });

  function toggleSelect(id: string) {
    if (selectedIds.has(id)) {
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      setSelectedOrder((prev) => prev.filter((x) => x !== id));
    } else {
      setSelectedIds((prev) => new Set([...prev, id]));
      setSelectedOrder((prev) => [...prev, id]);
    }
  }

  function selectAll() {
    const ids = filtered.map((a) => a.id);
    setSelectedIds(new Set(ids));
    setSelectedOrder(ids);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectedOrder([]);
  }

  function reorderSelected(fromId: string, toId: string) {
    if (fromId === toId) return;
    setSelectedOrder((prev) => {
      const arr = [...prev];
      const fromIdx = arr.indexOf(fromId);
      const toIdx = arr.indexOf(toId);
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, fromId);
      return arr;
    });
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowAdd(true);
    setShowOrcidSearch(false);
    setOrcidQuery("");
    setOrcidResults([]);
  }

  function openEdit(a: Coauthor) {
    const { id, institution, department, city, affiliations, ...rest } = a;
    const affs: Affiliation[] = affiliations && affiliations.length > 0
      ? affiliations
      : institution
        ? [{ institution: institution || "", department: department || "", city: city || "" }]
        : [{ institution: "", department: "", city: "" }];
    setForm({ ...EMPTY_FORM, ...rest, affiliations: affs });
    setEditingId(id);
    setShowAdd(true);
    setShowOrcidSearch(false);
    setOrcidQuery("");
    setOrcidResults([]);
  }

  async function saveForm() {
    setSaving(true);
    const payload = {
      ...form,
      // strip empty affiliations
      affiliations: form.affiliations.filter((af) => af.institution.trim()),
      // clear legacy single fields
      institution: undefined,
      department: undefined,
      city: undefined,
    };
    if (editingId) {
      await fetch("/api/coauthors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });
      setAuthors((prev) => prev.map((a) => a.id === editingId ? { ...a, ...payload } : a));
    } else {
      const res = await fetch("/api/coauthors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setSelectedOrder((prev) => prev.filter((x) => x !== id));
  }

  function generateExport(type: "block" | "contacts" | "full") {
    setExportType(type);
    if (type === "block") setExportText(formatAuthorBlock(selectedAuthors));
    else if (type === "contacts") setExportText(formatContactSheet(selectedAuthors));
    else setExportText(null);
  }

  async function copyExport() {
    if (!exportText) return;
    await navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadTxt() {
    if (!exportText) return;
    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `authors-${exportType}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadDocx(type: "block" | "contacts" | "full") {
    const res = await fetch("/api/export/coauthors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authors: selectedAuthors, type }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `authors-${type}-${new Date().toISOString().split("T")[0]}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function searchOrcid() {
    if (!orcidQuery.trim()) return;
    setOrcidLoading(true);
    setOrcidResults([]);
    try {
      const q = encodeURIComponent(orcidQuery.trim());
      const res = await fetch(`https://pub.orcid.org/v3.0/search/?q=${q}&rows=8`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      setOrcidResults(data.result || []);
    } catch {
      setOrcidResults([]);
    }
    setOrcidLoading(false);
  }

  function applyOrcidResult(r: OrcidResult) {
    const orcidId = r["orcid-identifier"]?.path || "";
    const givenName = r.person?.name?.["given-names"]?.value || "";
    const familyName = r.person?.name?.["family-name"]?.value || "";
    const fullName = [givenName, familyName].filter(Boolean).join(" ");
    const { institution, department } = getOrcidEmployment(r);
    setForm((prev) => {
      const updatedForm = { ...prev, orcid: orcidId };
      if (fullName && !prev.name.trim()) updatedForm.name = fullName;
      if (institution) {
        const firstAff = prev.affiliations[0];
        if (!firstAff?.institution.trim()) {
          updatedForm.affiliations = [
            { institution, department, city: firstAff?.city || "" },
            ...prev.affiliations.slice(1),
          ];
        }
      }
      return updatedForm;
    });
    setShowOrcidSearch(false);
    setOrcidQuery("");
    setOrcidResults([]);
  }

  function updateAffiliation(idx: number, field: keyof Affiliation, value: string) {
    setForm((prev) => {
      const affs = [...prev.affiliations];
      affs[idx] = { ...affs[idx], [field]: value };
      return { ...prev, affiliations: affs };
    });
  }

  function addAffiliation() {
    setForm((prev) => ({ ...prev, affiliations: [...prev.affiliations, { institution: "", department: "", city: "" }] }));
  }

  function removeAffiliation(idx: number) {
    setForm((prev) => {
      const affs = prev.affiliations.filter((_, i) => i !== idx);
      return { ...prev, affiliations: affs.length ? affs : [{ institution: "", department: "", city: "" }] };
    });
  }

  async function parsePastedText() {
    if (!pasteText.trim()) return;
    setParsing(true);
    setParsedPreview(null);
    const res = await fetch("/api/coauthors/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: pasteText }),
    });
    const data = await res.json();
    // Assign temp IDs for preview tracking
    const withIds = (data.authors || []).map((a: Omit<Coauthor, "id">, i: number) => ({
      ...a,
      id: `preview-${i}`,
      affiliations: a.affiliations || [],
    }));
    setParsedPreview(withIds);
    setParsing(false);
  }

  async function importParsedAuthor(a: Coauthor) {
    setImportingIds((prev) => new Set([...prev, a.id]));
    const { id, ...payload } = a;
    void id;
    const res = await fetch("/api/coauthors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const saved = await res.json();
    setAuthors((prev) => [...prev, saved]);
    setImportingIds((prev) => { const next = new Set(prev); next.delete(a.id); return next; });
  }

  async function importAllParsed() {
    if (!parsedPreview) return;
    for (const a of parsedPreview) {
      await importParsedAuthor(a);
    }
  }

  // Match a parsed name against existing authors (case-insensitive, tolerates middle initials / suffixes)
  function matchAuthor(parsedName: string): Coauthor | undefined {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, "").trim();
    const pn = norm(parsedName);
    // Exact normalized match first
    let match = authors.find((a) => norm(a.name) === pn);
    if (match) return match;
    // Last-name + first-initial match
    const pParts = pn.split(/\s+/);
    const pLast = pParts[pParts.length - 1];
    const pFirst = pParts[0]?.[0];
    match = authors.find((a) => {
      const parts = norm(a.name).split(/\s+/);
      return parts[parts.length - 1] === pLast && (!pFirst || parts[0]?.[0] === pFirst);
    });
    return match;
  }

  function selectParsedForExport() {
    if (!parsedPreview) return;
    const ids: string[] = [];
    for (const p of parsedPreview) {
      const existing = matchAuthor(p.name);
      if (existing) ids.push(existing.id);
    }
    setSelectedIds(new Set(ids));
    setSelectedOrder(ids);
    setShowPaste(false);
    setParsedPreview(null);
    setPasteText("");
    setImportingIds(new Set());
  }

  // Ordered list of selected authors (respects user-defined sequence)
  const selectedAuthors = selectedOrder
    .map((id) => authors.find((a) => a.id === id))
    .filter(Boolean) as Coauthor[];

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      {/* Add/Edit modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-sm mb-4">{editingId ? "Edit Author" : "Add Author"}</h3>
            <div className="space-y-3">
              {/* Simple string fields */}
              {([
                ["name", "Full Name *"],
                ["credentials", "Credentials (MPH, PhD, MD, etc.)"],
                ["email", "Email *"],
                ["email_alt", "Alt Email"],
              ] as [keyof FormData, string][]).map(([field, label]) => (
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

              {/* ORCID with search */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-zinc-500">ORCID (without https://orcid.org/)</label>
                  <button
                    type="button"
                    onClick={() => { setShowOrcidSearch(!showOrcidSearch); setOrcidResults([]); setOrcidQuery(""); }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {showOrcidSearch ? "Cancel" : "Search ORCID"}
                  </button>
                </div>
                <input
                  type="text"
                  value={form.orcid || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, orcid: e.target.value }))}
                  placeholder="0000-0000-0000-0000"
                  className="w-full px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 ring-zinc-400"
                />
                {showOrcidSearch && (
                  <div className="mt-2 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                    <div className="flex gap-1.5 p-2 bg-zinc-50 dark:bg-zinc-800">
                      <input
                        autoFocus
                        type="text"
                        value={orcidQuery}
                        onChange={(e) => setOrcidQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchOrcid()}
                        placeholder="Search by name (e.g. John Smith)"
                        className="flex-1 px-2.5 py-1 text-xs border border-zinc-200 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 ring-zinc-400"
                      />
                      <button
                        onClick={searchOrcid}
                        disabled={orcidLoading || !orcidQuery.trim()}
                        className="px-3 py-1 text-xs font-medium rounded-md bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-50 transition-colors"
                      >
                        {orcidLoading ? "…" : "Search"}
                      </button>
                    </div>
                    {orcidResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                        {orcidResults.map((r) => {
                          const orcidId = r["orcid-identifier"]?.path;
                          const given = r.person?.name?.["given-names"]?.value || "";
                          const family = r.person?.name?.["family-name"]?.value || "";
                          const { institution } = getOrcidEmployment(r);
                          return (
                            <button
                              key={orcidId}
                              onClick={() => applyOrcidResult(r)}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <p className="text-xs font-medium">{[given, family].filter(Boolean).join(" ") || "Unknown"}</p>
                              <p className="text-[11px] text-zinc-400">{orcidId}{institution ? ` · ${institution}` : ""}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!orcidLoading && orcidResults.length === 0 && orcidQuery && (
                      <p className="text-xs text-zinc-400 px-3 py-2">No results. Try a different name.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Role</label>
                <select
                  value={form.role || "coauthor"}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none"
                >
                  <option value="coauthor">Co-author</option>
                  <option value="corresponding">Corresponding Author</option>
                </select>
              </div>

              {/* Affiliations */}
              <div>
                <p className="text-xs text-zinc-500 mb-2">Affiliations</p>
                <div className="space-y-3">
                  {form.affiliations.map((aff, idx) => (
                    <div key={idx} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-zinc-400 font-medium">Affiliation {form.affiliations.length > 1 ? idx + 1 : ""}</span>
                        {form.affiliations.length > 1 && (
                          <button
                            onClick={() => removeAffiliation(idx)}
                            className="text-[11px] text-red-400 hover:text-red-500"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {([
                        ["institution", "Institution"] as const,
                        ["department", "Department"] as const,
                        ["city", "City, State ZIP"] as const,
                      ]).map(([field, label]) => (
                        <div key={field}>
                          <label className="block text-[11px] text-zinc-400 mb-0.5">{label}</label>
                          <input
                            type="text"
                            value={aff[field] || ""}
                            onChange={(e) => updateAffiliation(idx, field, e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 ring-zinc-400"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                  <button
                    onClick={addAffiliation}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 w-full transition-colors"
                  >
                    + Add Affiliation
                  </button>
                </div>
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
              <div className="flex gap-2 flex-wrap">
                <button onClick={copyExport} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button onClick={downloadTxt} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  .txt
                </button>
                <button onClick={() => downloadDocx(exportType as "block" | "contacts" | "full")} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition-colors">
                  .docx
                </button>
                <button onClick={() => setExportText(null)} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Close</button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto text-xs font-mono bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 whitespace-pre-wrap">{exportText}</pre>
          </div>
        </div>
      )}

      {/* Paste & parse modal */}
      {showPaste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Paste Author Information</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Paste any format — author block, contact list, email signatures, Word tables, etc.</p>
              </div>
              <button onClick={() => { setShowPaste(false); setParsedPreview(null); setPasteText(""); }} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Input area — hidden once parsed */}
            {!parsedPreview && (
              <>
                <textarea
                  autoFocus
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`Examples of supported formats:\n\nJohn Smith, MD¹; Jane Doe, PhD¹²\n¹ University of Pittsburgh, Pittsburgh, PA\n² UPMC\n\n— or —\n\n1. John Smith, MD\nUniversity of Pittsburgh\njohn.smith@pitt.edu\nORCID: 0000-0001-2345-6789`}
                  rows={10}
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 ring-zinc-400 resize-y font-mono leading-relaxed placeholder:font-sans placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowPaste(false); setPasteText(""); }} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                  <button
                    onClick={parsePastedText}
                    disabled={parsing || !pasteText.trim()}
                    className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-50 transition-colors"
                  >
                    {parsing && (
                      <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                    )}
                    {parsing ? "Parsing…" : "Parse with AI"}
                  </button>
                </div>
              </>
            )}

            {/* Parsed preview */}
            {parsedPreview && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {parsedPreview.length === 0
                      ? "No authors found — try repasting with more detail."
                      : `Found ${parsedPreview.length} author${parsedPreview.length !== 1 ? "s" : ""}`}
                  </p>
                  <button onClick={() => { setParsedPreview(null); setImportingIds(new Set()); }} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">← Edit text</button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 max-h-[40vh]">
                  {parsedPreview.map((a) => {
                    const matched = matchAuthor(a.name);
                    const importing = importingIds.has(a.id);
                    return (
                      <div key={a.id} className={`flex items-center gap-3 p-3 border rounded-xl ${matched ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-zinc-200 dark:border-zinc-800"}`}>
                        {/* Match indicator */}
                        <div className="shrink-0">
                          {matched ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 dark:text-zinc-600">
                              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{a.name}</span>
                            {a.credentials && <span className="text-xs text-zinc-400">{a.credentials}</span>}
                            {matched
                              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">in list</span>
                              : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">not found</span>
                            }
                          </div>
                          {matched && <p className="text-[11px] text-zinc-400 mt-0.5">{getAffiliationStrings(matched).join(" · ")}</p>}
                        </div>
                        {/* Add to list if not matched */}
                        {!matched && (
                          <button
                            onClick={() => importParsedAuthor(a)}
                            disabled={importing}
                            className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                          >
                            {importing ? "…" : "Add to list"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(() => {
                  const matchedCount = parsedPreview.filter((a) => matchAuthor(a.name)).length;
                  return (
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <p className="text-xs text-zinc-400">{matchedCount} of {parsedPreview.length} matched in your list</p>
                      <div className="flex gap-2">
                        <button onClick={() => { setShowPaste(false); setParsedPreview(null); setPasteText(""); setImportingIds(new Set()); }} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                        <button
                          onClick={selectParsedForExport}
                          disabled={matchedCount === 0}
                          className="px-4 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-40 transition-colors"
                        >
                          Select {matchedCount > 0 ? `${matchedCount} ` : ""}for Export
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Co-authors</h1>
          <p className="text-sm text-zinc-500 mt-1">{authors.length} authors · select any to export</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowPaste(true); setParsedPreview(null); setPasteText(""); }} className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            Paste Authors
          </button>
          <button onClick={openAdd} className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition-colors">
            + Add Author
          </button>
        </div>
      </div>

      {/* Search + select controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input ref={searchRef} type="text" placeholder="Search by name, institution…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400" />
        </div>
        <button onClick={selectAll} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Select all</button>
        {selectedIds.size > 0 && <button onClick={clearSelection} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Clear ({selectedIds.size})</button>}
      </div>

      {/* Export bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{selectedIds.size} selected · preview:</span>
            <button onClick={() => generateExport("block")}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition-colors">
              Author Block
            </button>
            <button onClick={() => generateExport("contacts")}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              Contact Sheet
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Download .docx:</span>
            <button onClick={() => downloadDocx("block")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Author Block
            </button>
            <button onClick={() => downloadDocx("contacts")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Contact Sheet
            </button>
            <button onClick={() => downloadDocx("full")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Full Profile Table
            </button>
          </div>
          {/* Drag-to-reorder chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-zinc-400 font-medium shrink-0">Order:</span>
            {selectedAuthors.map((a, i) => (
              <div
                key={a.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragOrderId(a.id); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragOrderId) reorderSelected(dragOrderId, a.id); setDragOrderId(null); }}
                onDragEnd={() => setDragOrderId(null)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium cursor-grab active:cursor-grabbing select-none transition-opacity ${dragOrderId === a.id ? "opacity-40" : ""} bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300`}
              >
                <span className="text-zinc-400 text-[10px]">{i + 1}</span>
                <span>{a.name.split(" ").slice(-1)[0]}</span>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-300 dark:text-zinc-600">
                  <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                </svg>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Author list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-14 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const affs = getAffiliationStrings(a);
            return (
              <div key={a.id}
                className={`group flex items-center gap-3 p-3 border rounded-xl transition-colors cursor-pointer ${selectedIds.has(a.id) ? "border-zinc-400 dark:border-zinc-500 bg-zinc-50 dark:bg-zinc-800/60" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}`}
                onClick={() => toggleSelect(a.id)}
              >
                <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedIds.has(a.id) ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-600"}`}>
                  {selectedIds.has(a.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white dark:text-zinc-900"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {a.name}{a.credentials ? <span className="text-zinc-400 font-normal ml-1">{a.credentials}</span> : null}
                    {a.role === "corresponding" && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">Corresponding</span>}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{affs.join(" · ")}</p>
                  <p className="text-xs text-zinc-400 truncate">{a.email}{a.orcid ? ` · ${a.orcid}` : ""}</p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEdit(a)} title="Edit" className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button onClick={() => deleteAuthor(a.id)} title="Delete" className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
