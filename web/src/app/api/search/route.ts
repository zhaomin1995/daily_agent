import fs from "fs";
import path from "path";
import { BRIEFING_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

interface SearchResult {
  date: string;
  type: string;
  filename: string;
  excerpts: string[];
}

function getExcerpts(content: string, query: string, maxExcerpts = 3): string[] {
  const lines = content.split("\n");
  const q = query.toLowerCase();
  const excerpts: string[] = [];

  for (let i = 0; i < lines.length && excerpts.length < maxExcerpts; i++) {
    if (lines[i].toLowerCase().includes(q) && lines[i].trim()) {
      // Include one line of context before and after
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length - 1, i + 1);
      const excerpt = lines.slice(start, end + 1).join(" ").trim().slice(0, 200);
      excerpts.push(excerpt);
    }
  }
  return excerpts;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return Response.json({ results: [], query: "" });
  }

  if (!fs.existsSync(BRIEFING_DIR)) {
    return Response.json({ results: [], query });
  }

  const files = fs.readdirSync(BRIEFING_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("."));
  const results: SearchResult[] = [];

  for (const file of files.sort().reverse()) {
    const content = fs.readFileSync(path.join(BRIEFING_DIR, file), "utf-8");
    if (!content.toLowerCase().includes(query.toLowerCase())) continue;

    const excerpts = getExcerpts(content, query);
    if (excerpts.length === 0) continue;

    const type = file.includes("-email") ? "email"
      : file.includes("-workflow") ? "workflow"
      : file.includes("-action-prompts") ? "action-prompts"
      : "other";

    results.push({
      date: file.replace(/-email\.md|-workflow\.md|-action-prompts\.md|\.md/, ""),
      type,
      filename: file,
      excerpts,
    });

    if (results.length >= 20) break;
  }

  return Response.json({ results, query });
}
