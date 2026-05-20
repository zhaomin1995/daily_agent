import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import yaml from "js-yaml";
import { SUBMISSIONS_DIR } from "@/lib/submissionPaths";
import path from "path";

export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

interface JournalRequirements {
  journal_name: string | null;
  max_words: number | null;
  max_abstract_words: number | null;
  max_figures: number | null;
  max_tables: number | null;
  max_references: number | null;
  reference_style: string;
  required_sections: string[];
  checklist_type: string | null;
  additional_notes: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ").trim();
}

function isBlockedPage(text: string): string | null {
  if (text.includes("Enable JavaScript and cookies") || text.includes("cf-browser-verification") || text.includes("cf_chl_opt"))
    return "Site uses Cloudflare bot protection — automatic fetch is blocked.";
  if (text.includes("Access Denied") || text.includes("403 Forbidden"))
    return "Site returned Access Denied.";
  if (text.length < 500)
    return "Page returned too little content to extract from.";
  return null;
}

function extractRelevantText(text: string): string {
  const keywords = ["word limit", "word count", "abstract", "figure", "table", "reference", "manuscript", "submission", "guidelines", "format", "author", "checklist", "reporting", "STROBE", "CONSORT", "PRISMA", "length", "limit"];
  const lines = text.split(/[.!?\n]+/);
  const relevant = lines.filter((l) => keywords.some((k) => l.toLowerCase().includes(k.toLowerCase())));
  const focused = relevant.join(". ").slice(0, 18000);
  return focused.length > 500 ? focused : text.slice(0, 18000);
}

function countExtracted(extracted: JournalRequirements): number {
  return [
    extracted.max_words, extracted.max_abstract_words, extracted.max_figures,
    extracted.max_tables, extracted.max_references,
    extracted.reference_style, extracted.checklist_type,
  ].filter((v) => v !== null && v !== "").length
    + (extracted.required_sections?.length ?? 0 > 0 ? 1 : 0);
}

const EXTRACTION_PROMPT = (text: string) => `You are extracting journal submission requirements from author guidelines text.

Extract the following fields and return ONLY valid JSON (no markdown, no explanation):

{
  "journal_name": string or null,
  "max_words": integer or null,
  "max_abstract_words": integer or null,
  "max_figures": integer or null,
  "max_tables": integer or null,
  "max_references": integer or null,
  "reference_style": string (e.g. "Vancouver", "APA", "AMA", "NLM", or ""),
  "required_sections": string array,
  "checklist_type": "STROBE" or "CONSORT" or "PRISMA" or "CARE" or "AGREE" or null,
  "additional_notes": string (key requirements not captured above, 1-3 sentences, or "")
}

Rules:
- Only extract what is explicitly stated; use null if not mentioned
- For max_words: total manuscript limit excluding references/abstract unless stated otherwise
- For checklist_type: STROBE=observational, CONSORT=randomized trials, PRISMA=systematic reviews
- For multiple word limits by article type, use the "original article" limit

TEXT:
${text}`;

async function runExtraction(plainText: string): Promise<JournalRequirements> {
  const escaped = EXTRACTION_PROMPT(plainText).replace(/'/g, "'\\''");
  const { stdout } = await execAsync(`claude -p '${escaped}'`, { timeout: 90000 });
  const jsonMatch = stdout.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Claude response");
  return JSON.parse(jsonMatch[0]) as JournalRequirements;
}

function saveExtracted(id: string, extracted: JournalRequirements, sourceUrl?: string) {
  const filePath = path.join(SUBMISSIONS_DIR, `${id}.yaml`);
  if (!fs.existsSync(filePath)) return;
  const existing = yaml.load(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  const { journal_name, additional_notes, ...reqFields } = extracted;
  const updated = {
    ...existing,
    ...(journal_name && !existing.journal ? { journal: journal_name } : {}),
    ...(sourceUrl ? { journal_url: sourceUrl } : {}),
    journal_requirements: {
      ...(existing.journal_requirements as object || {}),
      ...Object.fromEntries(
        Object.entries(reqFields).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
      ),
    },
    ...(additional_notes ? {
      notes: existing.notes ? `${existing.notes}\n\nFrom guidelines: ${additional_notes}` : `From guidelines: ${additional_notes}`
    } : {}),
  };
  fs.writeFileSync(filePath, yaml.dump(updated));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { url, text: pastedText } = body;

  if (!url?.trim() && !pastedText?.trim()) {
    return Response.json({ error: "url or text required" }, { status: 400 });
  }

  let plainText: string;

  if (pastedText?.trim()) {
    // Use pasted text directly
    plainText = extractRelevantText(pastedText.trim());
  } else {
    // Fetch via curl with browser headers
    const curlCmd = [
      "curl", "-s", "-L", "--max-time", "20", "--compressed",
      "-H", `"User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"`,
      "-H", `"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"`,
      "-H", `"Accept-Language: en-US,en;q=0.9"`,
      "-H", `"Accept-Encoding: gzip, deflate, br"`,
      "-H", `"Connection: keep-alive"`,
      "-H", `"Upgrade-Insecure-Requests: 1"`,
      "-H", `"Sec-Fetch-Dest: document"`,
      "-H", `"Sec-Fetch-Mode: navigate"`,
      "-H", `"Sec-Fetch-Site: none"`,
      `"${url.replace(/"/g, '\\"')}"`,
    ].join(" ");

    let html: string;
    try {
      const { stdout, stderr } = await execAsync(curlCmd, { timeout: 25000, maxBuffer: 10 * 1024 * 1024 });
      if (!stdout.trim()) throw new Error(stderr || "Empty response");
      html = stdout;
    } catch (e) {
      return Response.json({ error: `Failed to fetch URL: ${(e as Error).message}`, needsPaste: true }, { status: 422 });
    }

    const rawText = stripHtml(html);
    const blockReason = isBlockedPage(rawText);
    if (blockReason) {
      return Response.json({ error: blockReason, needsPaste: true }, { status: 422 });
    }

    plainText = extractRelevantText(rawText);
  }

  // Run Claude extraction
  let extracted: JournalRequirements;
  try {
    extracted = await runExtraction(plainText);
  } catch (e) {
    return Response.json({ error: `Extraction failed: ${(e as Error).message}`, needsPaste: !pastedText }, { status: 500 });
  }

  // If nothing was extracted, tell the UI to fall back to paste
  const fieldsFound = countExtracted(extracted);
  if (fieldsFound === 0) {
    return Response.json({
      error: "No requirements found in page content — the page may require JavaScript to load.",
      needsPaste: true,
    }, { status: 422 });
  }

  saveExtracted(id, extracted, url);

  return Response.json({ ok: true, extracted, fieldsFound });
}
