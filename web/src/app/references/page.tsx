"use client";

import { useRef, useState } from "react";

const FORMATS = ["Vancouver", "APA 7th", "NLM/PubMed"] as const;
type Format = typeof FORMATS[number];

export default function ReferencesPage() {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<Format>("Vancouver");
  const [output, setOutput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  async function generate() {
    if (!input.trim()) return;
    setGenerating(true);
    setOutput("");
    const res = await fetch("/api/references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input, format }),
    });
    const data = await res.json();
    setOutput(data.references || data.error || "No references found.");
    setGenerating(false);
    setTimeout(() => outputRef.current?.focus(), 100);
  }

  function copyOutput() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadTxt() {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `references-${format.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadDocx() {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
    const lines = output.split("\n").filter(Boolean);
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: "References", heading: HeadingLevel.HEADING_1, spacing: { after: 240 } }),
          ...lines.map((line) =>
            new Paragraph({
              children: [new TextRun({ text: line, size: 20 })],
              spacing: { after: 120 },
            })
          ),
        ],
      }],
    });
    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([buffer as unknown as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `references-${format.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Reference Generator</h1>
        <p className="text-sm text-zinc-500 mt-1">Paste manuscript text, a rough reference list, or DOIs/PMIDs — get a clean numbered list in your preferred format.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Input</label>
            {input && (
              <button onClick={() => setInput("")} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">Clear</button>
            )}
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Paste any of the following:\n\n• Manuscript text with in-text citations\n• A rough or partial reference list\n• A list of DOIs or PMIDs\n• Mixed formats — AI will sort it out\n\nExample:\nSmith J, Jones A. Cardiac outcomes in heart failure. NEJM. 2021;384:1234-45.\ndoi:10.1056/NEJMoa2026787`}
            rows={16}
            className="flex-1 w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400 resize-none font-mono leading-relaxed placeholder:font-sans placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
          />

          {/* Format selector */}
          <div>
            <p className="text-xs text-zinc-500 mb-2 font-medium">Output format</p>
            <div className="flex gap-1.5 flex-wrap">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    format === f
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generate}
            disabled={generating || !input.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {generating && (
              <svg className="animate-spin shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/>
              </svg>
            )}
            {generating ? "Generating…" : "Generate References"}
          </button>
        </div>

        {/* Output panel */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Output
              {output && <span className="ml-2 text-xs text-zinc-400 font-normal">{format}</span>}
            </label>
            {output && (
              <div className="flex items-center gap-1.5">
                <button onClick={copyOutput} className="text-xs px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button onClick={downloadTxt} className="text-xs px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">.txt</button>
                <button onClick={downloadDocx} className="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity">.docx</button>
              </div>
            )}
          </div>

          {output ? (
            <textarea
              ref={outputRef}
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              rows={16}
              className="flex-1 w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 ring-zinc-400 resize-none leading-relaxed"
            />
          ) : (
            <div className="flex-1 min-h-[300px] border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-2 text-center p-6">
              {generating ? (
                <>
                  <svg className="animate-spin text-zinc-400" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                  <p className="text-sm text-zinc-400">Generating reference list…</p>
                </>
              ) : (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 dark:text-zinc-700">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  <p className="text-sm text-zinc-400">References will appear here</p>
                  <p className="text-xs text-zinc-400">Output is editable before export</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
