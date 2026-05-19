import fs from "fs";
import path from "path";
import { BRIEFING_DIR, ACTION_ITEMS_STATE } from "@/lib/paths";

export const dynamic = "force-dynamic";

interface ActionItem {
  id: string;
  text: string;
  date: string;
  completed: boolean;
}

function loadState(): Set<string> {
  try {
    if (fs.existsSync(ACTION_ITEMS_STATE)) {
      const data = JSON.parse(fs.readFileSync(ACTION_ITEMS_STATE, "utf-8"));
      return new Set(data.completed || []);
    }
  } catch {}
  return new Set();
}

function saveState(completed: Set<string>) {
  fs.mkdirSync(path.dirname(ACTION_ITEMS_STATE), { recursive: true });
  fs.writeFileSync(ACTION_ITEMS_STATE, JSON.stringify({ completed: [...completed] }, null, 2));
}

function extractItems(content: string, date: string): { id: string; text: string; date: string }[] {
  const items: { id: string; text: string; date: string }[] = [];
  const idx = content.indexOf("## Today's Priorities");
  if (idx === -1) return items;

  const after = content.slice(idx);
  const end = after.indexOf("\n## ", 4);
  const section = end === -1 ? after : after.slice(0, end);

  section.split("\n").forEach((line, i) => {
    const m = line.match(/^\d+\.\s+(.+)/);
    if (m) {
      const text = m[1].replace(/\*\*/g, "").trim();
      items.push({ id: `${date}-${i}`, text, date });
    }
  });

  return items;
}

export async function GET() {
  if (!fs.existsSync(BRIEFING_DIR)) return Response.json([]);

  const completed = loadState();
  const files = fs
    .readdirSync(BRIEFING_DIR)
    .filter((f) => f.endsWith("-workflow.md"))
    .sort()
    .reverse()
    .slice(0, 7); // last 7 days

  const all: ActionItem[] = [];
  for (const file of files) {
    const date = file.replace("-workflow.md", "");
    const content = fs.readFileSync(path.join(BRIEFING_DIR, file), "utf-8");
    const items = extractItems(content, date);
    for (const item of items) {
      all.push({ ...item, completed: completed.has(item.id) });
    }
  }

  return Response.json(all);
}

export async function PUT(request: Request) {
  const { id, completed } = await request.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const state = loadState();
  if (completed) state.add(id);
  else state.delete(id);
  saveState(state);

  return Response.json({ ok: true });
}
