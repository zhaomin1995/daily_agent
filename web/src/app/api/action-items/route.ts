import fs from "fs";
import path from "path";
import { BRIEFING_DIR, ACTION_ITEMS_STATE } from "@/lib/paths";

export const dynamic = "force-dynamic";

interface ActionItem {
  id: string;
  text: string;
  date: string;
  completed: boolean;
  manual?: boolean;
}

interface ManualItem {
  id: string;
  text: string;
  date: string;
}

interface State {
  completed: string[];
  manual: ManualItem[];
}

function loadState(): State {
  try {
    if (fs.existsSync(ACTION_ITEMS_STATE)) {
      const data = JSON.parse(fs.readFileSync(ACTION_ITEMS_STATE, "utf-8"));
      return {
        completed: data.completed || [],
        manual: data.manual || [],
      };
    }
  } catch {}
  return { completed: [], manual: [] };
}

function saveState(state: State) {
  fs.mkdirSync(path.dirname(ACTION_ITEMS_STATE), { recursive: true });
  fs.writeFileSync(ACTION_ITEMS_STATE, JSON.stringify(state, null, 2));
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
  const state = loadState();
  const completedSet = new Set(state.completed);

  const all: ActionItem[] = [];

  // Items from last 7 workflow briefings
  if (fs.existsSync(BRIEFING_DIR)) {
    const files = fs
      .readdirSync(BRIEFING_DIR)
      .filter((f) => f.endsWith("-workflow.md"))
      .sort()
      .reverse()
      .slice(0, 7);

    for (const file of files) {
      const date = file.replace("-workflow.md", "");
      const content = fs.readFileSync(path.join(BRIEFING_DIR, file), "utf-8");
      for (const item of extractItems(content, date)) {
        all.push({ ...item, completed: completedSet.has(item.id) });
      }
    }
  }

  // Manual items appended after briefing items
  for (const m of state.manual) {
    all.push({ ...m, completed: completedSet.has(m.id), manual: true });
  }

  return Response.json(all);
}

// Toggle single item, mark-all-done, or clear-completed
export async function PUT(request: Request) {
  const body = await request.json();
  const state = loadState();
  const completedSet = new Set(state.completed);

  if (body.action === "mark-all-done") {
    const ids: string[] = body.ids || [];
    ids.forEach((id) => completedSet.add(id));
    saveState({ ...state, completed: [...completedSet] });
    return Response.json({ ok: true });
  }

  if (body.action === "clear-completed") {
    // Remove from completed set and delete manual items that were completed
    const newManual = state.manual.filter((m) => !completedSet.has(m.id));
    saveState({ completed: [], manual: newManual });
    return Response.json({ ok: true });
  }

  // Single toggle
  const { id, completed } = body;
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  if (completed) completedSet.add(id);
  else completedSet.delete(id);
  saveState({ ...state, completed: [...completedSet] });
  return Response.json({ ok: true });
}

// Add a manual item
export async function POST(request: Request) {
  const { text } = await request.json();
  if (!text?.trim()) return Response.json({ error: "text required" }, { status: 400 });

  const state = loadState();
  const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const date = new Date().toISOString().split("T")[0];
  const newItem: ManualItem = { id, text: text.trim(), date };
  saveState({ ...state, manual: [...state.manual, newItem] });
  return Response.json({ id, text: newItem.text, date, completed: false, manual: true });
}
