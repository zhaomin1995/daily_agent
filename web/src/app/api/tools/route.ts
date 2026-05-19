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

export async function GET() {
  const result = tools.map((t) => ({
    ...t,
    status: getToolStatus(t.id),
    lastRun: getLastRun(t.id),
  }));
  return Response.json(result);
}
