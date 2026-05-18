import fs from "fs";
import path from "path";
import { BRIEFING_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

/* Returns the last 7 days of run history for sparkline display.
   Each entry: { date, success } derived from briefing file existence. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const history: Array<{ date: string; success: boolean | null }> = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split("T")[0];
    const file = path.join(BRIEFING_DIR, `${date}.md`);

    if (fs.existsSync(BRIEFING_DIR) && fs.existsSync(file)) {
      history.push({ date, success: true });
    } else {
      history.push({ date, success: null });
    }
  }

  return Response.json(history);
}
