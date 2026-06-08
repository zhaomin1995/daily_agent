"use client";

import { useState } from "react";

/* ------------------------------------------------------------------ *
 * Email Draft Assistant
 *
 * Flow:
 *  1. Pick an account and search your received emails for context
 *     (e.g. "Sherlock X drive access").
 *  2. Check the emails whose details should inform the new message.
 *  3. Describe what you want to say + who it goes to, then generate.
 *  4. Edit the draft and save it to Outlook Drafts (never auto-sent).
 * ------------------------------------------------------------------ */

interface EmailMatch {
  id: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  receivedDateTime: string;
  bodyPreview: string;
}

const ACCOUNTS = [
  { id: "ucsd", label: "UCSD" },
  { id: "pitt", label: "Pitt" },
];

const TONES = ["warm and professional", "concise and direct", "formal"];

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EmailDraftPage() {
  const [account, setAccount] = useState("ucsd");

  // Context search
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<EmailMatch[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchError, setSearchError] = useState<string | null>(null);

  // Draft inputs
  const [intent, setIntent] = useState("");
  const [recipients, setRecipients] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [tone, setTone] = useState(TONES[0]);

  // Generated draft
  const [generating, setGenerating] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [genError, setGenError] = useState<string | null>(null);

  // Save-to-Outlook state
  const [saving, setSaving] = useState(false);
  const [savedLink, setSavedLink] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setResults(null);
    try {
      const res = await fetch("/api/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", account, query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.messages || []);
    } catch (e) {
      setSearchError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function generate() {
    if (!intent.trim()) return;
    setGenerating(true);
    setGenError(null);
    setSavedLink(null);
    try {
      const res = await fetch("/api/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          account,
          messageIds: Array.from(selected),
          intent,
          recipients,
          extraContext,
          tone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setDraftSubject(data.subject || "");
      setDraftBody(data.body || "");
    } catch (e) {
      setGenError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function saveToOutlook() {
    if (!draftBody.trim()) return;
    setSaving(true);
    setSaveError(null);
    setSavedLink(null);
    try {
      const res = await fetch("/api/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-draft",
          account,
          subject: draftSubject,
          body: draftBody,
          recipients,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save draft");
      setSavedLink(data.webLink || "");
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400";

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Email Draft Assistant</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Search emails you received, then draft a new email that reuses their details. Saves to Outlook Drafts — never sends.
        </p>
      </div>

      {/* Account selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Account</span>
        <div className="flex gap-1.5">
          {ACCOUNTS.map((acc) => (
            <button
              key={acc.id}
              onClick={() => { setAccount(acc.id); setResults(null); setSelected(new Set()); }}
              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                account === acc.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {acc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 1: find context emails */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-4 space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">1 · Find context emails</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder='e.g. "Sherlock X drive access"'
            className={inputCls}
          />
          <button
            onClick={runSearch}
            disabled={searching || !query.trim()}
            className="shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {searching && (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            )}
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {searchError && (
          <div className="p-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
            <p className="text-sm text-red-600 dark:text-red-400">{searchError}</p>
            <p className="text-xs text-red-500 mt-1">Check your token in <a href="/config" className="underline">Config</a>.</p>
          </div>
        )}

        {results && results.length === 0 && (
          <p className="text-sm text-zinc-400">No matching emails found. Try different keywords.</p>
        )}

        {results && results.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-400">
              {selected.size} of {results.length} selected as context
            </p>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              {results.map((m) => (
                <label key={m.id} className="flex gap-3 px-3 py-2.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggleSelected(m.id)}
                    className="mt-1 rounded shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{m.subject}</span>
                      <span className="text-[11px] text-zinc-400 shrink-0">{formatDate(m.receivedDateTime)}</span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">
                      {m.fromName || m.fromEmail}
                    </p>
                    <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">{m.bodyPreview}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: describe the email */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-4 space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">2 · Describe the email</p>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">What should this email do?</label>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            rows={3}
            placeholder="e.g. Send the Sherlock users the X drive access steps so they can mount the shared drive."
            className={`${inputCls} resize-none leading-relaxed`}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-zinc-500 mb-1">Recipients (optional)</label>
            <input
              type="text"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="comma or semicolon separated emails"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className={inputCls}>
              {TONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-1">Anything else to include? (optional)</label>
          <textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            rows={2}
            placeholder="Extra context the emails don't cover."
            className={`${inputCls} resize-none`}
          />
        </div>

        <button
          onClick={generate}
          disabled={generating || !intent.trim()}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 disabled:opacity-40 transition-colors"
        >
          {generating && (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          )}
          {generating ? "Drafting…" : "Generate Draft"}
        </button>

        {genError && <p className="text-sm text-red-600 dark:text-red-400">{genError}</p>}
      </div>

      {/* Step 3: review + save */}
      {(draftBody || draftSubject) && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">3 · Review &amp; save</span>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Subject</label>
              <input
                type="text"
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Body</label>
              <textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={14}
                className={`${inputCls} resize-none leading-relaxed font-mono text-[13px]`}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={saveToOutlook}
                disabled={saving || !draftBody.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {saving && (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                )}
                {saving ? "Saving…" : "Save to Outlook Drafts"}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(`${draftSubject}\n\n${draftBody}`)}
                className="px-3 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Copy
              </button>
            </div>

            {savedLink !== null && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Draft saved to Outlook — review and send it from there.{" "}
                {savedLink && <a href={savedLink} target="_blank" rel="noopener noreferrer" className="underline">Open draft</a>}
              </p>
            )}
            {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
