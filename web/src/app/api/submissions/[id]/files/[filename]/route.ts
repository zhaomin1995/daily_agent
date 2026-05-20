import fs from "fs";
import path from "path";
import { SUBMISSIONS_DIR } from "@/lib/submissionPaths";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params;
  const filePath = path.join(SUBMISSIONS_DIR, "files", id, decodeURIComponent(filename));

  if (!fs.existsSync(filePath)) return new Response("Not found", { status: 404 });

  const buffer = fs.readFileSync(filePath);
  return new Response(buffer, {
    headers: {
      "Content-Disposition": `attachment; filename="${decodeURIComponent(filename)}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}
