import { spawn } from "child_process";
import path from "path";
import { tools } from "@/lib/tools";
import { REPO_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tool = tools.find((t) => t.id === id);

  if (!tool) {
    return Response.json({ error: "Tool not found" }, { status: 404 });
  }

  const scriptPath = path.join(REPO_DIR, tool.script);

  return new Promise<Response>((resolve) => {
    const proc = spawn("/bin/zsh", [scriptPath], {
      env: { ...process.env, HOME: process.env.HOME },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve(
        Response.json({
          exitCode: code,
          stdout: stdout.slice(-5000),
          stderr: stderr.slice(-2000),
        })
      );
    });

    proc.on("error", (err) => {
      resolve(
        Response.json(
          { error: `Failed to start: ${err.message}` },
          { status: 500 }
        )
      );
    });
  });
}
