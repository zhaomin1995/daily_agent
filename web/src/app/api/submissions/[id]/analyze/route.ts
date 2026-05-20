import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import yaml from "js-yaml";
import { SUBMISSIONS_DIR } from "@/lib/submissionPaths";

export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

interface ManuscriptMeta {
  title: string;
  journal: string;
  journal_requirements: {
    max_words: number | null;
    max_abstract_words: number | null;
    max_figures: number | null;
    max_tables: number | null;
    max_references: number | null;
    reference_style: string;
    required_sections: string[];
    checklist_type: string | null;
  };
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
  if (ext === ".pdf") {
    try {
      const { stdout } = await execAsync(
        `pdftotext "${filePath.replace(/"/g, '\\"')}" -`,
        { timeout: 30000 }
      );
      return stdout;
    } catch {
      throw new Error("PDF extraction requires pdftotext. Please upload a .docx file instead.");
    }
  }
  if (ext === ".txt" || ext === ".md") {
    return fs.readFileSync(filePath, "utf-8");
  }
  throw new Error(`Unsupported format: ${ext}. Upload a .docx, .doc, .pdf, or .txt file.`);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const TASK_INSTRUCTIONS: Record<string, (reqs: ManuscriptMeta["journal_requirements"]) => string> = {
  review: (reqs) =>
    `Thoroughly review the manuscript against all journal requirements. Identify every compliance issue, then return the complete edited manuscript with all necessary changes applied. ${reqs.max_words ? `The manuscript must be under ${reqs.max_words} words.` : ""} ${reqs.max_abstract_words ? `The abstract must be under ${reqs.max_abstract_words} words.` : ""}`,

  trim: (reqs) =>
    `Trim the manuscript to fit the ${reqs.max_words}-word limit. Cut evenly throughout — tighten sentences, eliminate redundancy, shorten verbose paragraphs — while preserving all key scientific content, findings, and methods. Do not remove any section headers. Return the complete trimmed manuscript.`,

  abstract: (reqs) =>
    `Focus on the abstract only. ${reqs.max_abstract_words ? `It must be under ${reqs.max_abstract_words} words.` : "Trim and improve it."} Ensure it has a clear Background, Methods, Results, and Conclusions structure. Return the full manuscript with the edited abstract in place.`,

  sections: (reqs) =>
    `Check that all required sections are present: ${reqs.required_sections?.join(", ") || "Introduction, Methods, Results, Discussion, Conclusion"}. Add any missing section headers with a one-sentence placeholder. Return the full manuscript.`,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { filename, task } = (await request.json()) as { filename: string; task: string };

  const msPath = path.join(SUBMISSIONS_DIR, `${id}.yaml`);
  if (!fs.existsSync(msPath)) return Response.json({ error: "Manuscript not found" }, { status: 404 });
  const ms = yaml.load(fs.readFileSync(msPath, "utf-8")) as ManuscriptMeta;

  const filePath = path.join(SUBMISSIONS_DIR, "files", id, filename);
  if (!fs.existsSync(filePath)) return Response.json({ error: "File not found" }, { status: 404 });

  let manuscriptText: string;
  try {
    manuscriptText = await extractText(filePath);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }

  const wordCount = countWords(manuscriptText);
  const reqs = ms.journal_requirements || ({} as ManuscriptMeta["journal_requirements"]);

  const reqLines = [
    ms.journal ? `Journal: ${ms.journal}` : null,
    reqs.max_words
      ? `Word limit: ${reqs.max_words} words (manuscript is currently ${wordCount} words — ${wordCount > (reqs.max_words || 0) ? `${wordCount - (reqs.max_words || 0)} over limit` : `${(reqs.max_words || 0) - wordCount} under limit`})`
      : `Current word count: ${wordCount}`,
    reqs.max_abstract_words ? `Abstract limit: ${reqs.max_abstract_words} words` : null,
    reqs.max_figures ? `Figure limit: ${reqs.max_figures}` : null,
    reqs.max_tables ? `Table limit: ${reqs.max_tables}` : null,
    reqs.max_references ? `Reference limit: ${reqs.max_references}` : null,
    reqs.reference_style ? `Reference style: ${reqs.reference_style}` : null,
    reqs.required_sections?.length ? `Required sections: ${reqs.required_sections.join(", ")}` : null,
    reqs.checklist_type ? `Reporting standard: ${reqs.checklist_type} (${reqs.checklist_type === "STROBE" ? "observational study" : reqs.checklist_type === "CONSORT" ? "randomized trial" : "systematic review"})` : null,
  ].filter(Boolean).join("\n");

  const taskFn = TASK_INSTRUCTIONS[task] ?? TASK_INSTRUCTIONS.review;
  const instruction = taskFn(reqs);

  const prompt = `You are editing an academic manuscript for journal submission.

JOURNAL REQUIREMENTS:
${reqLines}

TASK: ${instruction}

MANUSCRIPT TEXT:
${manuscriptText}

Respond in exactly this format (use the === delimiters):

===ISSUES===
[Bullet list of compliance issues found — be specific: name sections, cite word counts]

===EDITED MANUSCRIPT===
[The complete edited manuscript with all changes applied]

===CHANGES MADE===
[Brief bullet list of specific edits made and why]`;

  const escaped = prompt.replace(/'/g, "'\\''");
  let stdout: string;
  try {
    const result = await execAsync(`claude -p '${escaped}'`, {
      timeout: 240000,
      maxBuffer: 30 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (e) {
    return Response.json({ error: `Analysis failed: ${(e as Error).message}` }, { status: 500 });
  }

  const issuesMatch = stdout.match(/===ISSUES===\n([\s\S]*?)(?====EDITED MANUSCRIPT===|$)/);
  const editedMatch = stdout.match(/===EDITED MANUSCRIPT===\n([\s\S]*?)(?====CHANGES MADE===|$)/);
  const changesMatch = stdout.match(/===CHANGES MADE===\n([\s\S]*?)$/);

  const editedText = editedMatch?.[1]?.trim() || "";

  return Response.json({
    issues: issuesMatch?.[1]?.trim() || "",
    editedManuscript: editedText,
    changesMade: changesMatch?.[1]?.trim() || "",
    wordCountOriginal: wordCount,
    wordCountEdited: editedText ? countWords(editedText) : null,
  });
}
