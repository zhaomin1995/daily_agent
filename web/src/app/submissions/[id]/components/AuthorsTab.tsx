"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Affiliation {
  institution: string;
  department?: string;
  city?: string;
}

interface Coauthor {
  id: string;
  name: string;
  email: string;
  orcid: string;
  role: string;
  institution: string;
  department: string;
  affiliations?: Affiliation[];
}

interface ManuscriptAuthor {
  id: string;
  order: number;
  contributions: string[];
}

function CopyField({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      title={`Copy: ${value}`}
      className={`group inline-flex items-center gap-1 text-left transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 ${className}`}
    >
      <span>{copied ? <span className="text-green-500">Copied!</span> : value}</span>
      <svg className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    </button>
  );
}

const CREDIT_ROLES = [
  "Conceptualization", "Data curation", "Formal analysis", "Funding acquisition",
  "Investigation", "Methodology", "Project administration", "Resources", "Software",
  "Supervision", "Validation", "Visualization", "Writing – original draft",
  "Writing – review & editing",
];

export default function AuthorsTab({
  manuscriptId,
  authors,
  onSave,
}: {
  manuscriptId: string;
  authors: ManuscriptAuthor[];
  onSave: (authors: ManuscriptAuthor[]) => void;
}) {
  const [coauthors, setCoauthors] = useState<Coauthor[]>([]);
  const [localAuthors, setLocalAuthors] = useState<ManuscriptAuthor[]>(authors);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const fetchCoauthors = useCallback(async () => {
    const res = await fetch("/api/coauthors");
    setCoauthors(await res.json());
  }, []);

  useEffect(() => { fetchCoauthors(); }, [fetchCoauthors]);
  useEffect(() => { setLocalAuthors(authors); }, [authors]);

  function getCoauthor(id: string) {
    return coauthors.find((c) => c.id === id);
  }

  function updateAndSave(updated: ManuscriptAuthor[]) {
    setLocalAuthors(updated);
    onSave(updated);
  }

  function addAuthor(id: string) {
    if (localAuthors.some((a) => a.id === id)) return;
    const updated = [...localAuthors, { id, order: localAuthors.length + 1, contributions: [] }];
    updateAndSave(updated);
    setShowAdd(false);
    setAddSearch("");
  }

  function removeAuthor(id: string) {
    const updated = localAuthors
      .filter((a) => a.id !== id)
      .map((a, i) => ({ ...a, order: i + 1 }));
    updateAndSave(updated);
  }

  function toggleContribution(authorId: string, role: string) {
    const updated = localAuthors.map((a) => {
      if (a.id !== authorId) return a;
      const has = a.contributions.includes(role);
      return { ...a, contributions: has ? a.contributions.filter((r) => r !== role) : [...a.contributions, role] };
    });
    updateAndSave(updated);
  }

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const s = [...sorted];
    const fromIdx = s.findIndex((a) => a.id === fromId);
    const toIdx = s.findIndex((a) => a.id === toId);
    const [moved] = s.splice(fromIdx, 1);
    s.splice(toIdx, 0, moved);
    updateAndSave(s.map((a, i) => ({ ...a, order: i + 1 })));
  }

  const sorted = [...localAuthors].sort((a, b) => a.order - b.order);
  const availableToAdd = coauthors.filter((c) => !localAuthors.some((a) => a.id === c.id));
  const filteredToAdd = addSearch.trim()
    ? availableToAdd.filter((c) => {
        const q = addSearch.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.institution?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
      })
    : availableToAdd;

  // Contributor statement preview
  const statement = sorted
    .map((a) => {
      const c = getCoauthor(a.id);
      if (!c || a.contributions.length === 0) return null;
      return `**${c.name}**: ${a.contributions.join(", ")}.`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-6">
      {/* Author list */}
      <div className="space-y-2">
        {sorted.map((a) => {
          const c = getCoauthor(a.id);
          return (
            <div
              key={a.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragId(a.id); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId !== null) reorder(dragId, a.id); setDragId(null); }}
              onDragEnd={() => setDragId(null)}
              className={`border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all ${dragId === a.id ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-3 p-4">
                {/* Drag handle */}
                <div className="cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-600 shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                  </svg>
                </div>

                <span className="text-xs text-zinc-400 font-mono w-5 shrink-0">{a.order}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{c?.name || a.id}</span>
                    {c?.role === "corresponding" && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                        corresponding
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {c?.affiliations && c.affiliations.length > 0 ? (
                      c.affiliations.map((af, i) => af.institution ? (
                        <div key={i} className="flex items-center gap-3 flex-wrap">
                          <CopyField value={[af.institution, af.city].filter(Boolean).join(", ")} className="text-xs text-zinc-500" />
                        </div>
                      ) : null)
                    ) : c?.institution ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <CopyField value={c.institution} className="text-xs text-zinc-500" />
                      </div>
                    ) : null}
                    <div className="flex items-center gap-3 flex-wrap">
                      {c?.email && <CopyField value={c.email} className="text-xs text-zinc-400" />}
                      {c?.orcid && <CopyField value={`https://orcid.org/${c.orcid}`} className="text-xs text-zinc-400" />}
                    </div>
                  </div>
                </div>

                <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  {expanded === a.id ? "Collapse" : "CRediT"}
                </button>
                <button onClick={() => removeAuthor(a.id)} className="text-xs text-red-400 hover:text-red-500">
                  Remove
                </button>
              </div>

              {expanded === a.id && (
                <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                  <p className="text-xs text-zinc-500 mb-2">CRediT contributions:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {CREDIT_ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={a.contributions.includes(role)}
                          onChange={() => toggleContribution(a.id, role)}
                          className="rounded"
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add author */}
      {showAdd ? (
        <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-4">
          {availableToAdd.length === 0 ? (
            <p className="text-xs text-zinc-400">All coauthors are already added.</p>
          ) : (
            <>
              <div className="relative mb-3">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input
                  autoFocus
                  type="text"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Search by name, institution…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                />
                {addSearch && (
                  <button onClick={() => setAddSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {filteredToAdd.length === 0 ? (
                  <p className="text-xs text-zinc-400 px-3 py-2">No matches for &ldquo;{addSearch}&rdquo;</p>
                ) : filteredToAdd.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => addAuthor(c.id)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.institution && <span className="text-xs text-zinc-400 ml-2">{c.institution}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
          <button onClick={() => { setShowAdd(false); setAddSearch(""); }} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 mt-3 block">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl py-3 text-sm text-zinc-400 hover:text-zinc-600 hover:border-zinc-400 dark:hover:text-zinc-300 dark:hover:border-zinc-600 transition-colors"
        >
          + Add Author
        </button>
      )}

      {/* Contributor statement preview */}
      {statement && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 mb-2">Contributor Statement Preview</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{
            __html: statement.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          }} />
        </div>
      )}
    </div>
  );
}
