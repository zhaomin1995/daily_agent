import { isRunning } from "@/lib/processRegistry";

export const dynamic = "force-dynamic";

/* Returns whether a tool is currently running. Used for status polling. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return Response.json({ running: isRunning(id) });
}
