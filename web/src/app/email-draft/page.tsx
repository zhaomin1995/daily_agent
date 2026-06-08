"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ *
 * Email Draft Assistant
 *
 * Flow:
 *  1. Search emails you received (Apple Mail by default, last 7 days) for
 *     context — e.g. "Sherlock X drive access".
 *  2. Check the emails whose details should inform the new message.
 *  3. Describe what you want to say + who it goes to, then generate.
 *  4. Edit the draft and save it to Drafts (never auto-sent).
 * ------------------------------------------------------------------ */

interface EmailMatch {
  id: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  receivedDateTime: string;
  bodyPreview: string;
  account?: string;
  body?: string; // full (capped) text, present for the Apple Mail provider
}

interface MailAccount {
  name: string;
  email: string;
}

const TONES = ["warm and professional", "concise and direct", "formal"];

const DAY_OPTIONS = [
  { label: "1 day", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
];

function formatDate(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.split(" at ")[0] || s; // Apple Mail date strings
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EmailDraftPage() {
  // Provider: Apple Mail (default, no token) or Outlook (Graph).
  const [provider, setProvider] = useState<"applemail" | "graph">("applemail");

  // Apple Mail accounts (for the "From" address on the draft).
  const [mailAccounts, setMailAccounts] = useState<MailAccount[]>([]);
  const [fromEmail, setFromEmail] = useState("");
  const [graphAccount, setGraphAccount] = useState("ucsd");

  // Context search
  const [query, setQuery] = useState("");
  const [days, setDays] = useState(7);
  const [deep, setDeep] = useState(false);
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

  // Save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ link?: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load Apple Mail accounts when that provider is active.
  useEffect(() => {
    if (provider !== "applemail") return;
    (async () => {
      try {
        const res = await fetch("/api/email-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accounts", provider: "applemail" }),
        });
        const data = await res.json();
        const accts: MailAccount[] = (data.accounts || []).filter((a: MailAccount) => a.email);
        setMailAccounts(accts);
        if (accts.length && !fromEmail) setFromEmail(accts[0].email);
      } catch {
        /* accounts are optional; sender just stays blank */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

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
    setSelected(new Set());
    try {
      const res = await fetch("/api/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          provider,
          account: graphAccount,
          query,
          days,
          deep,
        }),
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
    setSaved(null);
    try {
      // Apple Mail results carry their body inline; pass it straight through.
      const chosen = (results || []).filter((m) => selected.has(m.id));
      const contextEmails = chosen.map((m) => ({
        subject: m.subject,
        from: m.fromName || m.fromEmail,
        date: m.receivedDateTime,
        text: m.body || m.bodyPreview,
      }));

      const res = await fetch("/api/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          provider,
          account: graphAccount,
          // Graph has no inline body, so fall back to ids there.
          messageIds: provider === "graph" ? Array.from(selected) : undefined,
          contextEmails: provider === "applemail" ? contextEmails : undefined,
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

  async function saveDraft() {
    if (!draftBody.trim()) return;
    setSaving(true);
    setSaveError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-draft",
          provider,
          account: graphAccount,
          sender: provider === "applemail" ? fromEmail : undefined,
          subject: draftSubject,
          body: draftBody,
          recipients,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save draft");
      setSaved({ link: data.webLink });
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400";
  const draftTarget = provider === "applemail" ? "Apple Mail Drafts" : "Outlook Drafts";

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Email Draft Assistant</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Search emails you received, then draft a new one that reuses their details. Saves to {draftTarget} — never sends.
        </p>
      </div>

      {/* Provider + From row */}
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Mailbox</p>
          <div className="flex gap-1.5">
            {([
              { id: "applemail", label: "Apple Mail" },
              { id: "graph", label: "Outlook (Graph)" },
            ] as const).map((p) => (
              <button
                key={p.id}
                onClick={() => { setProvider(p.id); setResults(null); setSelected(new Set()); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  provider === p.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* From account */}
        {provider === "applemail" ? (
          mailAccounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">From</p>
              <select value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className={inputCls}>
                {mailAccounts.map((a) => (
                  <option key={a.email} value={a.email}>
                    {a.name} ({a.email})
                  </option>
                ))}
              </select>
            </div>
          )
        ) : (
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Account</p>
            <select value={graphAccount} onChange={(e) => setGraphAccount(e.target.value)} className={inputCls}>
              <option value="ucsd">UCSD</option>
              <option value="pitt">Pitt</option>
            </select>
          </div>
        )}
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

        {/* Search options: time window + deep toggle (Apple Mail) */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400">Window</span>
            {DAY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  days === opt.value
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {provider === "applemail" && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} className="rounded" />
              <span className="text-xs text-zinc-500">Also search email body (slower)</span>
            </label>
          )}
        </div>

        {searchError && (
          <div className="p-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
            <p className="text-sm text-red-600 dark:text-red-400">{searchError}</p>
          </div>
        )}

        {results && results.length === 0 && (
          <p className="text-sm text-zinc-400">No matching emails in the last {days} day{days !== 1 ? "s" : ""}. Try a wider window or the body-search option.</p>
        )}

        {results && results.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-400">{selected.size} of {results.length} selected as context</p>
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
                    <p className="text-xs text-zinc-500 truncate">{m.fromName || m.fromEmail}</p>
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
              <input type="text" value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} className={inputCls} />
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
                onClick={saveDraft}
                disabled={saving || !draftBody.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {saving && (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                )}
                {saving ? "Saving…" : `Save to ${draftTarget}`}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(`${draftSubject}\n\n${draftBody}`)}
                className="px-3 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Copy
              </button>
            </div>

            {saved && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Draft saved to {draftTarget} — review and send it from there.{" "}
                {saved.link && <a href={saved.link} target="_blank" rel="noopener noreferrer" className="underline">Open draft</a>}
              </p>
            )}
            {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
