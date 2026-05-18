import fs from "fs";
import path from "path";
import { tools } from "@/lib/tools";
import { TOKEN_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const result = tools.map((t) => ({
    ...t,
    status: getToolStatus(t.id),
  }));
  return Response.json(result);
}
