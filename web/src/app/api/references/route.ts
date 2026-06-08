import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  const { text, format } = await request.json() as { text: string; format: string };
  if (!text?.trim()) {
    return Response.json({ error: "No text provided" }, { status: 400 });
  }

  const prompt = `You are a reference formatting assistant. Your task is to extract all references from the provided text and format them as a numbered reference list in ${format} format.

Instructions:
- Identify every citation or reference in the text (in-text citations like [1], (Smith 2020), superscripts, or a reference/bibliography section)
- If the input already contains a reference list, reformat it cleanly
- If the input contains only in-text citations with no reference list, generate placeholder references noting which citations need to be completed
- Number references in the order they first appear in the text
- Format each reference strictly according to ${format} style
- Include all available fields: authors, title, journal/publisher, year, volume, issue, pages, DOI if present
- If a DOI is present, format it as https://doi.org/...
- Output ONLY the numbered reference list, no preamble or explanation

${format} formatting rules:
${format === "Vancouver" ? `- Author(s) last name followed by initials (no periods), separated by commas
- Up to 6 authors, then "et al."
- Title in sentence case
- Abbreviated journal name
- Format: Author AA, Author BB. Title of article. Abbrev J Name. Year;Volume(Issue):Pages. doi:...` : ""}
${format === "APA 7th" ? `- Author(s): Last name, Initials.
- Up to 20 authors, then ellipsis + last author
- Title in sentence case
- Journal in title case, italicized
- Format: Last, F. M., & Last, F. M. (Year). Title of article. Journal Name, Volume(Issue), Pages. https://doi.org/...` : ""}
${format === "NLM/PubMed" ? `- Same as Vancouver but journal names use NLM abbreviations
- Format: Author AA, Author BB. Title. Abbrev J Name. Year Mon;Volume(Issue):Pages. doi: ...` : ""}

Text to process:
${text}`;

  try {
    const { stdout } = await execFileAsync("claude", ["-p", prompt], {
      timeout: 60000,
      env: process.env,
    });
    return Response.json({ references: stdout.trim() });
  } catch (err) {
    console.error("Reference generation error:", err);
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
