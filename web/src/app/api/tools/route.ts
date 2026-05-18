import fs from "fs";
import path from "path";
import { tools } from "@/lib/tools";
import { TOKEN_DIR, BRIEFING_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

// Checks whether a tool has the required setup (e.g. tokens) to run
function getToolStatus(toolId: string): "ready" | "needs-setup" {
  if (toolId === "morning-briefing") {
    const ucsd = path.join(TOKEN_DIR, "msgraph-token-ucsd.txt");
    const pitt = path.join(TOKEN_DIR, "msgraph-token-pitt.txt");
    const ucsdOk = fs.existsSync(ucsd) && fs.statSync(ucsd).size > 0;
    const pittOk = fs.existsSync(pitt) && fs.statSync(pitt).size > 0;
    return ucsdOk || pittOk ? "ready" : "needs-setup";
  }
  return "ready";
}

// Returns the ISO timestamp of the most recent briefing file, or null
function getLastRun(toolId: string): string | null {
  if (toolId === "morning-briefing" && fs.existsSync(BRIEFING_DIR)) {
    const files = fs
      .readdirSync(BRIEFING_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    if (files.length > 0) {
      const stat = fs.statSync(path.join(BRIEFING_DIR, files[0]));
      return stat.mtime.toISOString();
    }
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
