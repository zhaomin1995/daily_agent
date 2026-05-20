"use client";

import { useState } from "react";

interface DocCard {
  type: string;
  title: string;
  description: string;
}

const docs: DocCard[] = [
  { type: "cover-letter", title: "Cover Letter", description: "Generate a submission cover letter addressed to the journal editors." },
  { type: "author-block", title: "Author Block", description: "Formatted author list with numbered affiliations." },
  { type: "contributor-statement", title: "Contributor Statement", description: "CRediT author contribution statement." },
  { type: "checklist", title: "Reporting Checklist", description: "Full STROBE/CONSORT/PRISMA checklist as text." },
];

export default function DocumentsTab({ manuscriptId }: { manuscriptId: string }) {
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function generate(type: string) {
    setLoading((prev) => ({ ...prev, [type]: true }));
    const res = await fetch(`/api/submissions/${manuscriptId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const data = await res.json();

    let content: string;
    if (type === "checklist" && data.items) {
      content = data.items
        .map((item: { item: string; checked: boolean; note: string }, i: number) =>
          `${i + 1}. [ ] ${item.item}`)
        .join("\n");
    } else {
      content = data.content || JSON.stringify(data, null, 2);
    }

    setResults((prev) => ({ ...prev, [type]: content }));
    setLoading((prev) => ({ ...prev, [type]: false }));
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function downloadAsTxt(text: string, filename: string) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {docs.map((doc) => (
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
            <div className="mt-3">
              <pre className="text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {results[doc.type]}
              </pre>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => copyToClipboard(results[doc.type])}
                  className="px-3 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => downloadAsTxt(results[doc.type], `${doc.type}.txt`)}
                  className="px-3 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Download .txt
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
