import fs from "fs";
import path from "path";
import { BRIEFING_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

function emailBadge(content: string): number {
  return [content.indexOf("### Urgent"), content.indexOf("### Action Needed")]
    .filter((i) => i !== -1)
    .reduce((sum, idx) => {
      const after = content.slice(idx);
      const end = after.search(/\n###/);
      const section = end === -1 ? after : after.slice(0, end);
      return sum + section.split("\n").filter((l) => {
        const t = l.trim();
        return t && !t.startsWith("#") && t !== "*(none)*" && !t.startsWith("→");
      }).length;
    }, 0);
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
