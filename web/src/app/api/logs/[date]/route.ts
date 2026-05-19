import fs from "fs";
import path from "path";
import { BRIEFING_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  // Support YYYY-MM-DD, YYYY-MM-DD-email, YYYY-MM-DD-workflow, YYYY-MM-DD-action-prompts
  const filePath = path.join(BRIEFING_DIR, `${date}.md`);

  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "Log not found" }, { status: 404 });
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return Response.json({ date, content });
}
