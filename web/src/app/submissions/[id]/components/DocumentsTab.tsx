"use client";

import { useState } from "react";

interface CoverLetterFields {
  editor_name: string;
  editor_title: string;
  article_type: string;
  study_summary: string;
  conflicts: string;
  phone: string;
}

const DEFAULT_COVER_LETTER: CoverLetterFields = {
  editor_name: "",
  editor_title: "Editor-in-Chief",
  article_type: "an Original Investigation",
  study_summary: "",
  conflicts: "There are no conflicts of interest in this study.",
  phone: "",
};

interface SimpleDoc {
  type: string;
  title: string;
  description: string;
}

const simpleDocs: SimpleDoc[] = [
  { type: "title-page", title: "Title Page", description: "Full title page with authors, affiliations, word counts, funding, IRB, and data availability." },
  { type: "author-block", title: "Author Block", description: "Formatted author list with numbered affiliations and corresponding author line." },
  { type: "contributor-statement", title: "Contributor Statement", description: "CRediT author contribution statement." },
  { type: "suggested-reviewers", title: "Suggested Reviewers", description: "Formatted list of suggested and excluded reviewers for the submission portal." },
  { type: "checklist", title: "Reporting Checklist", description: "Full STROBE/CONSORT/PRISMA checklist as plain text." },
];

export default function DocumentsTab({ manuscriptId }: { manuscriptId: string }) {
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [clFields, setClFields] = useState<CoverLetterFields>(DEFAULT_COVER_LETTER);
  const [showCLForm, setShowCLForm] = useState(false);
  const [reviewerComments, setReviewerComments] = useState("");
  const [showRRForm, setShowRRForm] = useState(true);

  async function generate(type: string, extra: Record<string, string> = {}) {
    setLoading((prev) => ({ ...prev, [type]: true }));
    const res = await fetch(`/api/submissions/${manuscriptId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...extra }),
    });
    const data = await res.json();
    let content: string;
    if (type === "checklist" && data.items) {
      content = data.items
        .map((item: { item: string }, i: number) => `${i + 1}. [ ] ${item.item}`)
        .join("\n");
    } else {
      content = data.content || JSON.stringify(data, null, 2);
    }
    setResults((prev) => ({ ...prev, [type]: content }));
    setLoading((prev) => ({ ...prev, [type]: false }));
  }

  async function copyToClipboard(type: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied((prev) => ({ ...prev, [type]: true }));
    setTimeout(() => setCopied((prev) => ({ ...prev, [type]: false })), 2000);
  }

  function downloadAsTxt(text: string, filename: string) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function updateCL(field: keyof CoverLetterFields, value: string) {
    setClFields((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-4">
      {/* Cover Letter — has its own form */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-sm font-semibold">Cover Letter</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Submission cover letter addressed to the journal editor.</p>
          </div>
          <button
            onClick={() => setShowCLForm(!showCLForm)}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shrink-0"
          >
            {showCLForm ? "Hide fields ↑" : "Edit fields ↓"}
          </button>
        </div>

        {showCLForm && (
          <div className="space-y-3 mb-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Editor Name</label>
                <input type="text" value={clFields.editor_name} onChange={(e) => updateCL("editor_name", e.target.value)}
                  placeholder="Dr. Rita F. Redberg" className="field-input" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Editor Title</label>
                <input type="text" value={clFields.editor_title} onChange={(e) => updateCL("editor_title", e.target.value)}
                  placeholder="Editor-in-Chief" className="field-input" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Article Type</label>
                <input type="text" value={clFields.article_type} onChange={(e) => updateCL("article_type", e.target.value)}
                  placeholder="an Original Investigation" className="field-input" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Phone (optional)</label>
                <input type="text" value={clFields.phone} onChange={(e) => updateCL("phone", e.target.value)}
                  placeholder="412-330-9432" className="field-input" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                Study Summary <span className="text-red-400">*</span>
                <span className="ml-1 text-zinc-400 font-normal">(2–4 sentences on key findings and significance)</span>
              </label>
              <textarea
                value={clFields.study_summary}
                onChange={(e) => updateCL("study_summary", e.target.value)}
                placeholder="Using a nationally representative cohort of…"
                rows={5}
                className="field-input resize-y min-h-[100px]"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Conflicts of Interest Statement</label>
              <input type="text" value={clFields.conflicts} onChange={(e) => updateCL("conflicts", e.target.value)}
                className="field-input" />
            </div>
          </div>
        )}

        <button
          onClick={() => generate("cover-letter", clFields as unknown as Record<string, string>)}
          disabled={loading["cover-letter"]}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          {loading["cover-letter"] ? "Generating…" : "Generate"}
        </button>

        {results["cover-letter"] && (
          <ResultBlock
            type="cover-letter"
            content={results["cover-letter"]}
            copied={copied["cover-letter"]}
            onCopy={() => copyToClipboard("cover-letter", results["cover-letter"])}
            onDownload={() => downloadAsTxt(results["cover-letter"], "cover-letter.txt")}
          />
        )}
      </div>

      {/* Reviewer Response Letter */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-sm font-semibold">Reviewer Response Letter</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Point-by-point response template. Paste the decision letter with reviewer comments below.</p>
          </div>
          <button
            onClick={() => setShowRRForm(!showRRForm)}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shrink-0"
          >
            {showRRForm ? "Hide ↑" : "Show ↓"}
          </button>
        </div>

        {showRRForm && (
          <div className="mb-4">
            <label className="block text-xs text-zinc-500 mb-1">
              Reviewer Comments <span className="text-red-400">*</span>
              <span className="ml-1 text-zinc-400 font-normal">(paste the full decision letter)</span>
            </label>
            <textarea
              value={reviewerComments}
              onChange={(e) => setReviewerComments(e.target.value)}
              placeholder={"Dear Dr. Yang,\n\nThank you for submitting your manuscript...\n\nREVIEWER 1\n1. The authors should clarify..."}
              rows={8}
              className="field-input resize-y min-h-[140px] font-mono text-xs"
            />
          </div>
        )}

        <button
          onClick={() => generate("reviewer-response", { reviewer_comments: reviewerComments })}
          disabled={loading["reviewer-response"] || !reviewerComments.trim()}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          {loading["reviewer-response"] ? "Generating…" : "Generate Response Template"}
        </button>

        {results["reviewer-response"] && (
          <ResultBlock
            type="reviewer-response"
            content={results["reviewer-response"]}
            copied={copied["reviewer-response"]}
            onCopy={() => copyToClipboard("reviewer-response", results["reviewer-response"])}
            onDownload={() => downloadAsTxt(results["reviewer-response"], "reviewer-response.txt")}
          />
        )}
      </div>

      {/* Other documents */}
      {simpleDocs.map((doc) => (
        <div key={doc.type} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h3 className="text-sm font-semibold">{doc.title}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{doc.description}</p>
            </div>
            <button
              onClick={() => generate(doc.type)}
              disabled={loading[doc.type]}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 shrink-0"
            >
              {loading[doc.type] ? "Generating…" : "Generate"}
            </button>
          </div>
          {results[doc.type] && (
            <ResultBlock
              type={doc.type}
              content={results[doc.type]}
              copied={copied[doc.type]}
              onCopy={() => copyToClipboard(doc.type, results[doc.type])}
              onDownload={() => downloadAsTxt(results[doc.type], `${doc.type}.txt`)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ResultBlock({ type, content, copied, onCopy, onDownload }: {
  type: string; content: string; copied: boolean;
  onCopy: () => void; onDownload: () => void;
}) {
  return (
    <div className="mt-3">
      <pre className="text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed font-sans">
        {content}
      </pre>
      <div className="flex gap-2 mt-2">
        <button onClick={onCopy}
          className="px-3 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          {copied ? "Copied!" : "Copy"}
        </button>
        <button onClick={onDownload}
          className="px-3 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          Download .txt
        </button>
      </div>
    </div>
  );
}
