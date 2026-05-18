import { spawn } from "child_process";
import path from "path";
import { tools } from "@/lib/tools";
import { REPO_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

/* Runs a tool script and streams stdout/stderr back as Server-Sent Events.
   Event types: "stdout", "stderr", "done" (with exit code). */
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

      // Stream stdout chunks as SSE events
      proc.stdout.on("data", (data) => {
        const event = `data: ${JSON.stringify({ type: "stdout", text: data.toString() })}\n\n`;
        controller.enqueue(encoder.encode(event));
      });

      // Stream stderr chunks as SSE events
      proc.stderr.on("data", (data) => {
        const event = `data: ${JSON.stringify({ type: "stderr", text: data.toString() })}\n\n`;
        controller.enqueue(encoder.encode(event));
      });

      // Send final event with exit code and close the stream
      proc.on("close", (code) => {
        const event = `data: ${JSON.stringify({ type: "done", exitCode: code })}\n\n`;
        controller.enqueue(encoder.encode(event));
        controller.close();
      });

      proc.on("error", (err) => {
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
