import fs from "fs";
import path from "path";
import { BRIEFING_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

function emailBadge(content: string): number {
  let count = 0;
  for (const heading of ["### Urgent", "### Action Needed"]) {
    const idx = content.indexOf(heading);
    if (idx === -1) continue;
    const after = content.slice(idx + heading.length);
    const end = after.search(/\n###/);
    const section = end === -1 ? after : after.slice(0, end);
    if (section.includes("*(none)*")) continue;
    for (const line of section.split("\n")) {
      if (/^\*\*(.+?)\*\*[^|]*\|/.test(line)) count++;
    }
  }
  return count;
}

function workflowBadge(content: string): number {
  const idx = content.indexOf("## Today's Priorities");
  if (idx === -1) return 0;
  const after = content.slice(idx);
  const end = after.indexOf("\n## ", 4);
  const section = end === -1 ? after : after.slice(0, end);
  return section.split("\n").filter((l) => /^\d+\./.test(l.trim())).length;
}

export async function GET() {
  if (!fs.existsSync(BRIEFING_DIR)) return Response.json([]);

  const files = fs
    .readdirSync(BRIEFING_DIR)
    .filter((f) => f.endsWith("-email.md") || f.endsWith("-workflow.md"))
    .sort()
    .reverse();

  return Response.json(files.map((f) => {
    const type = f.endsWith("-email.md") ? "email" : "workflow";
    const date = f.replace("-email.md", "").replace("-workflow.md", "");
    const content = fs.readFileSync(path.join(BRIEFING_DIR, f), "utf-8");
    const badge = type === "email" ? emailBadge(content) : workflowBadge(content);
    return { date, type, filename: f, badge: badge > 0 ? badge : null };
  }));
}
