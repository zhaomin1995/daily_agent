import fs from "fs";
import path from "path";
import { BRIEFING_DIR, ACTION_ITEMS_STATE } from "@/lib/paths";

export const dynamic = "force-dynamic";

type Priority = "high" | "medium" | "low";
type Source = "workflow" | "email-urgent" | "email-action" | "manual";

interface ActionItem {
  id: string;
  text: string;
  date: string;
  completed: boolean;
  source: Source;
  priority?: Priority;
}

interface ManualItem {
  id: string;
  text: string;
  date: string;
}

interface State {
  completed: string[];
  deleted: string[];
  overrides: Record<string, string>;
  priorities: Record<string, Priority>;
  manual: ManualItem[];
}

function loadState(): State {
  try {
    if (fs.existsSync(ACTION_ITEMS_STATE)) {
      const data = JSON.parse(fs.readFileSync(ACTION_ITEMS_STATE, "utf-8"));
      return {
        completed: data.completed || [],
        deleted: data.deleted || [],
        overrides: data.overrides || {},
        priorities: data.priorities || {},
        manual: data.manual || [],
      };
    }
  } catch {}
  return { completed: [], deleted: [], overrides: {}, priorities: {}, manual: [] };
}

function saveState(state: State) {
  fs.mkdirSync(path.dirname(ACTION_ITEMS_STATE), { recursive: true });
  fs.writeFileSync(ACTION_ITEMS_STATE, JSON.stringify(state, null, 2));
}

function extractWorkflowItems(content: string, date: string): { id: string; text: string; date: string; source: Source }[] {
  const items: { id: string; text: string; date: string; source: Source }[] = [];
  const idx = content.indexOf("## Today's Priorities");
  if (idx === -1) return items;
  const after = content.slice(idx);
  const end = after.indexOf("\n## ", 4);
  const section = end === -1 ? after : after.slice(0, end);
  section.split("\n").forEach((line, i) => {
    const m = line.match(/^\d+\.\s+(.+)/);
    if (m) items.push({ id: `${date}-${i}`, text: m[1].replace(/\*\*/g, "").trim(), date, source: "workflow" });
  });
  return items;
}

// Extract Urgent and Action Needed items from email briefings.
// Format: **Sender** (context) | Subject
function extractEmailItems(content: string, date: string): { id: string; text: string; date: string; source: Source }[] {
  const items: { id: string; text: string; date: string; source: Source }[] = [];
  const sections: { heading: string; source: Source }[] = [
    { heading: "### Urgent", source: "email-urgent" },
    { heading: "### Action Needed", source: "email-action" },
  ];

  for (const { heading, source } of sections) {
    const idx = content.indexOf(heading);
    if (idx === -1) continue;
    const after = content.slice(idx + heading.length);
    const end = after.search(/\n###/);
    const section = end === -1 ? after : after.slice(0, end);
    if (section.includes("*(none)*")) continue;

    let i = 0;
    for (const line of section.split("\n")) {
      // Match: **Sender Name** (optional context) | Subject
      const m = line.match(/^\*\*(.+?)\*\*[^|]*\|\s*(.+)/);
      if (m) {
        const sender = m[1].trim();
        const subject = m[2].trim();
        items.push({ id: `${date}-${source}-${i}`, text: `${sender} — ${subject}`, date, source });
        i++;
      }
    }
  }
  return items;
}

export async function GET() {
  const state = loadState();
  const completedSet = new Set(state.completed);
  const deletedSet = new Set(state.deleted);
  const all: ActionItem[] = [];

  if (fs.existsSync(BRIEFING_DIR)) {
    const dates = [...new Set(
      fs.readdirSync(BRIEFING_DIR)
        .filter((f) => f.endsWith("-workflow.md") || f.endsWith("-email.md"))
        .map((f) => f.replace(/-workflow\.md|-email\.md/, ""))
    )].sort().reverse().slice(0, 7);

    for (const date of dates) {
      const workflowFile = path.join(BRIEFING_DIR, `${date}-workflow.md`);
      const emailFile = path.join(BRIEFING_DIR, `${date}-email.md`);
      const extracted: { id: string; text: string; date: string; source: Source }[] = [];

      if (fs.existsSync(workflowFile)) {
        extracted.push(...extractWorkflowItems(fs.readFileSync(workflowFile, "utf-8"), date));
      }
      if (fs.existsSync(emailFile)) {
        extracted.push(...extractEmailItems(fs.readFileSync(emailFile, "utf-8"), date));
      }

      for (const item of extracted) {
        if (deletedSet.has(item.id)) continue;
        all.push({
          ...item,
          text: state.overrides[item.id] ?? item.text,
          completed: completedSet.has(item.id),
          priority: state.priorities[item.id],
        });
      }
    }
  }

  for (const m of state.manual) {
    if (deletedSet.has(m.id)) continue;
    all.push({ ...m, source: "manual" as Source, completed: completedSet.has(m.id), priority: state.priorities[m.id] });
  }

  return Response.json(all);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const state = loadState();
  const completedSet = new Set(state.completed);

  if (body.action === "mark-all-done") {
    (body.ids as string[]).forEach((id) => completedSet.add(id));
    saveState({ ...state, completed: [...completedSet] });
    return Response.json({ ok: true });
  }

  if (body.action === "clear-completed") {
    const newManual = state.manual.filter((m) => !completedSet.has(m.id));
    saveState({ ...state, completed: [], manual: newManual });
    return Response.json({ ok: true });
  }

  const { id, completed } = body;
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  if (completed) completedSet.add(id);
  else completedSet.delete(id);
  saveState({ ...state, completed: [...completedSet] });
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  const { text } = await request.json();
  if (!text?.trim()) return Response.json({ error: "text required" }, { status: 400 });
  const state = loadState();
  const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const date = new Date().toISOString().split("T")[0];
  saveState({ ...state, manual: [...state.manual, { id, text: text.trim(), date }] });
  return Response.json({ id, text: text.trim(), date, completed: false, source: "manual" });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id } = body;
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const state = loadState();

  if (body.text !== undefined) {
    const text = body.text.trim();
    if (id.startsWith("manual-")) {
      saveState({ ...state, manual: state.manual.map((m) => m.id === id ? { ...m, text } : m) });
    } else {
      saveState({ ...state, overrides: { ...state.overrides, [id]: text } });
    }
  }

  if ("priority" in body) {
    const priorities = { ...state.priorities };
    if (body.priority === null) delete priorities[id];
    else priorities[id] = body.priority as Priority;
    saveState({ ...loadState(), priorities }); // reload after potential text save above
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const state = loadState();
  if (id.startsWith("manual-")) {
    saveState({ ...state, manual: state.manual.filter((m) => m.id !== id) });
  } else {
    const deletedSet = new Set(state.deleted);
    deletedSet.add(id);
    saveState({ ...state, deleted: [...deletedSet] });
  }
  return Response.json({ ok: true });
}
