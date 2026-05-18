import { spawn } from "child_process";
import path from "path";
import { tools } from "@/lib/tools";
import { REPO_DIR } from "@/lib/paths";
import { register, unregister, kill } from "@/lib/processRegistry";

export const dynamic = "force-dynamic";

/* POST: Runs a tool script and streams stdout/stderr back as Server-Sent Events.
   Event types: "stdout", "stderr", "done" (with exit code), "cancelled". */
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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn("/bin/zsh", [scriptPath], {
        env: { ...process.env, HOME: process.env.HOME },
      });

      // Track the process so it can be cancelled via DELETE
      register(id, proc);

      proc.stdout.on("data", (data) => {
        const event = `data: ${JSON.stringify({ type: "stdout", text: data.toString() })}\n\n`;
        controller.enqueue(encoder.encode(event));
      });

      proc.stderr.on("data", (data) => {
        const event = `data: ${JSON.stringify({ type: "stderr", text: data.toString() })}\n\n`;
        controller.enqueue(encoder.encode(event));
      });

      proc.on("close", (code, signal) => {
        unregister(id);
        // SIGTERM means the user cancelled via the Stop button
        const type = signal === "SIGTERM" ? "cancelled" : "done";
        const event = `data: ${JSON.stringify({ type, exitCode: code })}\n\n`;
        controller.enqueue(encoder.encode(event));
        controller.close();
      });

      proc.on("error", (err) => {
        unregister(id);
        const event = `data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`;
        controller.enqueue(encoder.encode(event));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/* DELETE: Cancels a running tool by killing its process. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const killed = kill(id);
  if (killed) {
    return Response.json({ cancelled: true });
  }
  return Response.json({ cancelled: false, message: "No running process found" });
}
