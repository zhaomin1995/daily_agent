import { exec } from "child_process";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { filePath } = await request.json();

  if (!filePath || typeof filePath !== "string") {
    return Response.json({ error: "filePath required" }, { status: 400 });
  }

  // Resolve ~ and restrict to home directory to prevent path traversal
  const resolved = filePath.startsWith("~")
    ? path.join(os.homedir(), filePath.slice(1))
    : path.resolve(filePath);

  if (!resolved.startsWith(os.homedir())) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  return new Promise<Response>((resolve) => {
    exec(`open "${resolved}"`, (err) => {
      if (err) {
        resolve(Response.json({ error: err.message }, { status: 500 }));
      } else {
        resolve(Response.json({ opened: true }));
      }
    });
  });
}
