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
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Focus the text on sections most likely to contain submission requirements
function extractRelevantText(text: string): string {
  const keywords = ["word limit", "word count", "abstract", "figure", "table", "reference", "manuscript", "submission", "guidelines", "format", "author", "checklist", "reporting", "STROBE", "CONSORT", "PRISMA"];
  const lines = text.split(/[.!?\n]+/);
  const relevant = lines.filter((l) => keywords.some((k) => l.toLowerCase().includes(k.toLowerCase())));
  const focused = relevant.join(". ").slice(0, 18000);
  // Fall back to first 18k chars if nothing keyword-matched
  return focused.length > 500 ? focused : text.slice(0, 18000);
}

const EXTRACTION_PROMPT = (text: string) => `You are extracting journal submission requirements from a journal's author guidelines page.

Extract the following fields from the text below and return ONLY valid JSON (no markdown, no explanation):

{
  "journal_name": string or null,
  "max_words": integer or null (total manuscript word limit, excluding abstract/references unless stated),
  "max_abstract_words": integer or null,
  "max_figures": integer or null,
  "max_tables": integer or null,
  "max_references": integer or null,
  "reference_style": string (e.g. "Vancouver", "APA", "AMA", "Chicago", "NLM", or "" if not found),
  "required_sections": array of strings (e.g. ["Introduction", "Methods", "Results", "Discussion"]),
  "checklist_type": "STROBE" or "CONSORT" or "PRISMA" or "CARE" or "AGREE" or null,
  "additional_notes": string (any other important requirements in 1-3 sentences, or "")
}

Rules:
- Only extract what is explicitly stated; use null if not mentioned
- For checklist_type: STROBE = observational studies, CONSORT = randomized trials, PRISMA = systematic reviews/meta-analyses
- If multiple word limits are given for different article types, pick the most common or "original article" limit
- required_sections: only list sections that are explicitly required, not just mentioned

TEXT:
${text}`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { url } = await request.json();

  if (!url?.trim()) {
    return Response.json({ error: "url required" }, { status: 400 });
  }

  // Fetch the journal guidelines page
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return Response.json({ error: `Failed to fetch URL: ${(e as Error).message}` }, { status: 422 });
  }

  const plainText = extractRelevantText(stripHtml(html));

  // Run extraction via claude -p
  const prompt = EXTRACTION_PROMPT(plainText).replace(/'/g, "'\\''");
  let raw: string;
  try {
    const { stdout } = await execAsync(`claude -p '${prompt}'`, { timeout: 60000 });
    raw = stdout.trim();
  } catch (e) {
    return Response.json({ error: `Claude extraction failed: ${(e as Error).message}` }, { status: 500 });
  }

  // Parse JSON from Claude output (strip any markdown code fences if present)
  let extracted: JournalRequirements;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON found");
    extracted = JSON.parse(jsonMatch[0]);
  } catch {
    return Response.json({ error: "Could not parse extraction result", raw }, { status: 500 });
  }

  // Update the submission YAML with extracted requirements
  const filePath = path.join(SUBMISSIONS_DIR, `${id}.yaml`);
  if (fs.existsSync(filePath)) {
    const existing = yaml.load(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    const { journal_name, additional_notes, ...reqFields } = extracted;
    const updated = {
      ...existing,
      ...(journal_name && !existing.journal ? { journal: journal_name } : {}),
      journal_url: url,
      journal_requirements: {
        ...(existing.journal_requirements as object || {}),
        ...Object.fromEntries(Object.entries(reqFields).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))),
      },
      ...(additional_notes ? { notes: existing.notes ? `${existing.notes}\n\nFetched: ${additional_notes}` : `Fetched: ${additional_notes}` } : {}),
    };
    fs.writeFileSync(filePath, yaml.dump(updated));
  }

  return Response.json({ ok: true, extracted });
}
