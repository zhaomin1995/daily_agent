import fs from "fs";
import path from "path";
import { BRIEFING_DIR, ACTION_ITEMS_STATE } from "@/lib/paths";

export const dynamic = "force-dynamic";

function loadResolved(): Set<string> {
  try {
    if (fs.existsSync(ACTION_ITEMS_STATE)) {
      const data = JSON.parse(fs.readFileSync(ACTION_ITEMS_STATE, "utf-8"));
      return new Set<string>([...(data.completed || []), ...(data.wontdo || [])]);
    }
  } catch {}
  return new Set();
}

function emailBadge(content: string, date: string, resolved: Set<string>): number {
  let count = 0;
  const sections = [
    { heading: "### Urgent", prefix: `${date}-email-urgent` },
    { heading: "### Action Needed", prefix: `${date}-email-action` },
  ];
  for (const { heading, prefix } of sections) {
    const idx = content.indexOf(heading);
    if (idx === -1) continue;
    const after = content.slice(idx + heading.length);
    const end = after.search(/\n###/);
    const section = end === -1 ? after : after.slice(0, end);
    if (section.includes("*(none)*")) continue;
    let i = 0;
    for (const line of section.split("\n")) {
      if (/^\*\*(.+?)\*\*[^|]*\|/.test(line)) {
        if (!resolved.has(`${prefix}-${i}`)) count++;
        i++;
      }
    }
  }
  return count;
}

function workflowBadge(content: string, date: string, resolved: Set<string>): number {
  const idx = content.indexOf("## Today's Priorities");
  if (idx === -1) return 0;
  const after = content.slice(idx);
  const end = after.indexOf("\n## ", 4);
  const section = end === -1 ? after : after.slice(0, end);
  const lines = section.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  // Workflow item IDs are ${date}-${lineIndex} where lineIndex is the 0-based position in the file
  // Count unresolved by checking how many extracted IDs aren't in the resolved set
  let count = 0;
  section.split("\n").forEach((line, i) => {
    if (/^\d+\./.test(line.trim())) {
      if (!resolved.has(`${date}-${i}`)) count++;
    }
  });
  return count;
}

export async function GET() {
  if (!fs.existsSync(BRIEFING_DIR)) return Response.json([]);

  const resolved = loadResolved();

  const files = fs
    .readdirSync(BRIEFING_DIR)
    .filter((f) => f.endsWith("-email.md") || f.endsWith("-workflow.md"))
    .sort()
    .reverse();

  return Response.json(files.map((f) => {
    const type = f.endsWith("-email.md") ? "email" : "workflow";
    const date = f.replace("-email.md", "").replace("-workflow.md", "");
    const content = fs.readFileSync(path.join(BRIEFING_DIR, f), "utf-8");
    const badge = type === "email"
      ? emailBadge(content, date, resolved)
      : workflowBadge(content, date, resolved);
    return { date, type, filename: f, badge: badge > 0 ? badge : null };
  }));
}
