import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import yaml from "js-yaml";
import { SUBMISSIONS_DIR, COAUTHORS_FILE } from "@/lib/submissionPaths";

export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

interface Coauthor {
  id: string;
  name: string;
  credentials?: string;
  role: string;
  institution: string;
  department: string;
}

interface ExtractedMetadata {
  title: string | null;
  running_title: string | null;
  abstract: string | null;
  keywords: string[] | null;
  funding: string | null;
  irb_statement: string | null;
  data_availability: string | null;
  acknowledgments: string | null;
  conflicts_of_interest: string | null;
  author_names: string[];
}

interface MatchedAuthor {
  id: string;
  name: string;
  order: number;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".docx" || ext === ".doc") {
    const { stdout } = await execAsync(
      `textutil -convert txt -stdout "${filePath.replace(/"/g, '\\"')}"`,
      { timeout: 30000 }
    );
    return stdout;
  }
  if (ext === ".txt" || ext === ".md") return fs.readFileSync(filePath, "utf-8");
  if (ext === ".pdf") {
    const { stdout } = await execAsync(`pdftotext "${filePath.replace(/"/g, '\\"')}" -`, { timeout: 30000 });
    return stdout;
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

// Strip degree abbreviations to get clean name for matching
function cleanAuthorName(raw: string): string {
  return raw
    .replace(/,?\s*(PhD|MD|PharmD|MPH|MS|MA|MBA|ScM|DrPH|DO|RN|NP|PA|FACP|FAHA|FAHMS|AO|MSc|MHS|BSc|BS|BA|ScD|DrSc|FCCP)[,.]?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchAuthors(
  authorNames: string[],
  coauthors: Coauthor[]
): { matched: MatchedAuthor[]; unmatched: string[] } {
  const matched: MatchedAuthor[] = [];
  const unmatched: string[] = [];

  for (let i = 0; i < authorNames.length; i++) {
    const clean = cleanAuthorName(authorNames[i]);
    const lastName = clean.split(/\s+/).pop()?.toLowerCase() ?? "";
    const firstName = clean.split(/\s+/)[0]?.toLowerCase() ?? "";

    // Try full name match first (case-insensitive)
    let co = coauthors.find((c) => c.name.toLowerCase() === clean.toLowerCase());

    // Try last name + first initial
    if (!co) {
      co = coauthors.find((c) => {
        const cLast = c.name.split(/\s+/).pop()?.toLowerCase();
        const cFirst = c.name.split(/\s+/)[0]?.toLowerCase();
        return cLast === lastName && cFirst?.[0] === firstName[0];
      });
    }

    // Try last name only (if unique)
    if (!co) {
      const byLastName = coauthors.filter(
        (c) => c.name.split(/\s+/).pop()?.toLowerCase() === lastName
      );
      if (byLastName.length === 1) co = byLastName[0];
    }

    if (co) {
      matched.push({ id: co.id, name: co.name, order: i + 1 });
    } else {
      unmatched.push(authorNames[i]);
    }
  }

  return { matched, unmatched };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { filename } = (await request.json()) as { filename: string };

  const filePath = path.join(SUBMISSIONS_DIR, "files", id, filename);
  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  let text: string;
  try {
    text = await extractText(filePath);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }

  const prompt = `Extract structured metadata from this academic manuscript and return ONLY valid JSON with no markdown or explanation.

{
  "title": string or null (full manuscript title, verbatim),
  "running_title": string or null (only if explicitly labeled as running title or short title),
  "abstract": string or null (complete abstract text verbatim — used for word counting),
  "keywords": string array or null (individual keyword terms),
  "funding": string or null (complete funding acknowledgment/sources of funding paragraph, verbatim),
  "irb_statement": string or null (complete IRB/ethics/institutional approval statement, verbatim),
  "data_availability": string or null (complete data availability statement, verbatim),
  "acknowledgments": string or null (complete acknowledgments text excluding funding, verbatim),
  "conflicts_of_interest": string or null (complete conflict of interest/disclosures statement, verbatim),
  "author_names": string array (author names exactly as on the title page, including degrees/credentials, in listed order — empty array if not found)
}

Rules:
- Extract verbatim text for funding, IRB, data_availability, acknowledgments, conflicts_of_interest
- If a section is not present, use null
- For keywords: return each keyword as a separate array element
- For author_names: include full name with credentials as written (e.g. "Lanting Yang, PhD, MPH")

MANUSCRIPT TEXT:
${text.slice(0, 20000)}`;

  const escaped = prompt.replace(/'/g, "'\\''");
  let stdout: string;
  try {
    const result = await execAsync(`claude -p '${escaped}'`, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
    stdout = result.stdout;
  } catch (e) {
    return Response.json({ error: `Extraction failed: ${(e as Error).message}` }, { status: 500 });
  }

  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return Response.json({ error: "Could not parse Claude response" }, { status: 500 });

  let extracted: ExtractedMetadata;
  try {
    extracted = JSON.parse(jsonMatch[0]) as ExtractedMetadata;
  } catch {
    return Response.json({ error: "Invalid JSON from Claude" }, { status: 500 });
  }

  // Compute word counts in code (more reliable than asking Claude)
  const wordCount = countWords(text);
  const abstractWordCount = extracted.abstract ? countWords(extracted.abstract) : null;

  // Match author names against coauthors.yaml
  const coauthorsData = fs.existsSync(COAUTHORS_FILE)
    ? (yaml.load(fs.readFileSync(COAUTHORS_FILE, "utf-8")) as { coauthors: Coauthor[] })
    : { coauthors: [] };
  const coauthors = coauthorsData?.coauthors || [];
  const { matched, unmatched } = matchAuthors(extracted.author_names || [], coauthors);

  return Response.json({
    fields: {
      title: extracted.title,
      running_title: extracted.running_title,
      keywords: extracted.keywords,
      word_count: wordCount,
      abstract_word_count: abstractWordCount,
      funding: extracted.funding,
      irb_statement: extracted.irb_statement,
      data_availability: extracted.data_availability,
      acknowledgments: extracted.acknowledgments,
      conflicts_of_interest: extracted.conflicts_of_interest,
    },
    authors: { matched, unmatched },
  });
}
