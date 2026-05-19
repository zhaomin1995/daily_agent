import fs from "fs";
import { BRIEFING_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!fs.existsSync(BRIEFING_DIR)) {
    return Response.json([]);
  }

  const files = fs
    .readdirSync(BRIEFING_DIR)
    .filter((f) => f.endsWith("-email.md") || f.endsWith("-workflow.md"))
    .sort()
    .reverse()
    .map((f) => ({
      date: f.replace("-email.md", "").replace("-workflow.md", ""),
      type: f.endsWith("-email.md") ? "email" : "workflow",
      filename: f,
    }));

  return Response.json(files);
}
