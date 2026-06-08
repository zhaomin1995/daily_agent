import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import { tools } from "@/lib/tools";
import { BRIEFING_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

// Checks whether Apple Mail is configured with at least one account
function isAppleMailReady(): boolean {
  try {
    const result = execSync(
      `osascript -e 'tell application "Mail" to count every account'`,
      { timeout: 5000 }
    ).toString().trim();
    return parseInt(result) > 0;
  } catch {
    return false;
  }
}

function getToolStatus(toolId: string): "ready" | "needs-setup" {
  if (toolId === "email-brief") {
    return isAppleMailReady() ? "ready" : "needs-setup";
  }
  if (toolId === "workflow-brief") {
    return fs.existsSync(path.join(process.env.HOME || "", "Downloads", "Workflow"))
      ? "ready"
      : "needs-setup";
  }
  return "ready";
}

function getLastRun(toolId: string): string | null {
  if (!fs.existsSync(BRIEFING_DIR)) return null;

  const suffix = toolId === "email-brief" ? "-email.md" : "-workflow.md";
  const files = fs
    .readdirSync(BRIEFING_DIR)
    .filter((f) => f.endsWith(suffix))
    .sort()
    .reverse();

  if (files.length > 0) {
    const stat = fs.statSync(path.join(BRIEFING_DIR, files[0]));
    return stat.mtime.toISOString();
  }
  return null;
}

function getBadgeCount(toolId: string): number | null {
  if (!fs.existsSync(BRIEFING_DIR)) return null;
  const today = new Date().toISOString().split("T")[0];

  if (toolId === "email-brief") {
    const f = path.join(BRIEFING_DIR, `${today}-email.md`);
    if (!fs.existsSync(f)) return null;
    const c = fs.readFileSync(f, "utf-8");
    const count = ["### Urgent", "### Action Needed"]
      .reduce((sum, heading) => {
        const idx = c.indexOf(heading);
        if (idx === -1) return sum;
        const after = c.slice(idx + heading.length);
        const end = after.search(/\n###/);
        const section = end === -1 ? after : after.slice(0, end);
        if (section.includes("*(none)*")) return sum;
        return sum + section.split("\n").filter((l) => /^\*\*(.+?)\*\*[^|]*\|/.test(l)).length;
      }, 0);
    return count > 0 ? count : null;
  }

  if (toolId === "workflow-brief") {
    const f = path.join(BRIEFING_DIR, `${today}-workflow.md`);
    if (!fs.existsSync(f)) return null;
    const c = fs.readFileSync(f, "utf-8");
    const idx = c.indexOf("## Today's Priorities");
    if (idx === -1) return null;
    const after = c.slice(idx);
    const end = after.indexOf("\n## ", 4);
    const section = end === -1 ? after : after.slice(0, end);
    const count = section.split("\n").filter((l) => /^\d+\./.test(l.trim())).length;
    return count > 0 ? count : null;
  }

  return null;
}

export async function GET() {
  const result = tools.map((t) => ({
    ...t,
    status: getToolStatus(t.id),
    lastRun: getLastRun(t.id),
    badge: null, // counts shown in SnapshotPanel instead
  }));
  return Response.json(result);
}
