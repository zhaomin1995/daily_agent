import fs from "fs";
import path from "path";
import { tools } from "@/lib/tools";
import { REPO_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

/* Returns the raw prompt template file content for a tool.
   Used by the "View prompt template" quick action. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tool = tools.find((t) => t.id === id);

  if (!tool) {
    return Response.json({ error: "Tool not found" }, { status: 404 });
  }

  // Look for a markdown prompt file matching the tool script name
  const promptPath = path.join(REPO_DIR, `${tool.script}-prompt.md`);

  if (!fs.existsSync(promptPath)) {
    return new Response(`No prompt template found at ${tool.script}-prompt.md`, {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const content = fs.readFileSync(promptPath, "utf-8");
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
