import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  const { text } = await request.json() as { text: string };
  if (!text?.trim()) {
    return Response.json({ error: "No text provided" }, { status: 400 });
  }

  const prompt = `Extract all authors from the following text and return a JSON array. For each author extract:
- name (full name, required)
- credentials (e.g. MD, PhD, MPH — omit if none)
- email (if present)
- email_alt (second email if present)
- orcid (just the ID digits e.g. "0000-0001-2345-6789" — omit if not present)
- role ("corresponding" if they are the corresponding author, otherwise "coauthor")
- affiliations: array of { institution, department, city } objects

Important notes for parsing:
- Numbers immediately after names/credentials (like "PhD1" or "MPH2") are affiliation superscripts, NOT part of the credentials. Strip them and use them to match affiliations listed separately.
- If no affiliations are listed separately, set affiliations to [].
- Credentials are only degree abbreviations like PhD, MD, MPH, MS, PharmD, MSPH, MA, BS, BA, etc.

Return ONLY a valid JSON array with no markdown, no explanation, no code fences.

Text:
${text}`;

  try {
    const { stdout } = await execFileAsync("claude", ["-p", prompt], {
      timeout: 30000,
      env: process.env,
    });

    const raw = stdout.trim();
    // Strip any accidental markdown fences
    const json = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(json);
    return Response.json({ authors: Array.isArray(parsed) ? parsed : [] });
  } catch (err) {
    console.error("Parse error:", err);
    return Response.json({ authors: [] }, { status: 500 });
  }
}
