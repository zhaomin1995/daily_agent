import fs from "fs";
import path from "path";
import { BRIEFING_DIR, ACTION_ITEMS_STATE } from "@/lib/paths";
import { localDate } from "@/lib/date";

export const dynamic = "force-dynamic";

type Priority = "high" | "medium" | "low";
type Source = "workflow" | "email-urgent" | "email-action" | "manual";

interface ActionItem {
  id: string;
  text: string;
  date: string;
  completed: boolean;
  wontdo: boolean;
  source: Source;
  priority?: Priority;
}

interface ManualItem {
  id: string;
  text: string;
  date: string;
}

// Tasks written by the briefings (and dashboard) through the `taskstore` CLI.
// These are the shared substrate that lets the tools update each other: the email
// brief pushes source="email" tasks here, the workflow brief reads them, and the
// dashboard renders them in the Today view.
interface StoredTask {
  id: string;
  text: string;
  date: string;
  source: string; // e.g. "email", "workflow", "manual"
  ref?: string;
}

interface State {
  completed: string[];
  deleted: string[];
  wontdo: string[];
  overrides: Record<string, string>;
  priorities: Record<string, Priority>;
  manual: ManualItem[];
  tasks: StoredTask[];
}

function loadState(): State {
  try {
    if (fs.existsSync(ACTION_ITEMS_STATE)) {
      const data = JSON.parse(fs.readFileSync(ACTION_ITEMS_STATE, "utf-8"));
      return {
        completed: data.completed || [],
        deleted: data.deleted || [],
        wontdo: data.wontdo || [],
        overrides: data.overrides || {},
        priorities: data.priorities || {},
        manual: data.manual || [],
        tasks: data.tasks || [],
      };
    }
  } catch {}
  return { completed: [], deleted: [], wontdo: [], overrides: {}, priorities: {}, manual: [], tasks: [] };
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
  const wontdoSet = new Set(state.wontdo);
  const all: ActionItem[] = [];

  if (fs.existsSync(BRIEFING_DIR)) {
    // The latest brief of each kind is the current snapshot. The workflow brief
    // carries forward every still-open item each day, and email follow-ups that span
    // days live in the durable `tasks` array — so aggregating older briefs would only
    // re-surface stale, superseded versions of the same items (e.g. "revise v3"
    // lingering after it became "awaiting v5 edits", or weeks-old handled emails).
    const files = fs.readdirSync(BRIEFING_DIR);
    const latestDate = (suffix: string) =>
      files
        .filter((f) => f.endsWith(suffix))
        .map((f) => f.replace(suffix, ""))
        .sort()
        .reverse()[0];

    const extracted: { id: string; text: string; date: string; source: Source }[] = [];

    const wfDate = latestDate("-workflow.md");
    if (wfDate) {
      extracted.push(...extractWorkflowItems(fs.readFileSync(path.join(BRIEFING_DIR, `${wfDate}-workflow.md`), "utf-8"), wfDate));
    }
    const emDate = latestDate("-email.md");
    if (emDate) {
      extracted.push(...extractEmailItems(fs.readFileSync(path.join(BRIEFING_DIR, `${emDate}-email.md`), "utf-8"), emDate));
    }

    for (const item of extracted) {
      if (deletedSet.has(item.id)) continue;
      all.push({
        ...item,
        text: state.overrides[item.id] ?? item.text,
        completed: completedSet.has(item.id),
        wontdo: wontdoSet.has(item.id),
        priority: state.priorities[item.id],
      });
    }
  }

  for (const m of state.manual) {
    if (deletedSet.has(m.id)) continue;
    all.push({
      ...m,
      source: "manual" as Source,
      completed: completedSet.has(m.id),
      wontdo: wontdoSet.has(m.id),
      priority: state.priorities[m.id],
    });
  }

  // Tasks pushed through the taskstore CLI (e.g. the email brief's follow-ups).
  // Map the store's free-form source onto the UI's known Source values so they get
  // the right badge — email tasks show the "Email" badge in the Today view.
  for (const t of state.tasks) {
    if (deletedSet.has(t.id)) continue;
    const uiSource: Source =
      t.source === "email" ? "email-action" : t.source === "workflow" ? "workflow" : "manual";
    all.push({
      id: t.id,
      text: state.overrides[t.id] ?? t.text,
      date: t.date,
      source: uiSource,
      completed: completedSet.has(t.id),
      wontdo: wontdoSet.has(t.id),
      priority: state.priorities[t.id],
    });
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
  const date = localDate();
  saveState({ ...state, manual: [...state.manual, { id, text: text.trim(), date }] });
  return Response.json({ id, text: text.trim(), date, completed: false, wontdo: false, source: "manual" });
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

  if (body.wontdo === true) {
    const wontdoSet = new Set(loadState().wontdo);
    wontdoSet.add(id);
    saveState({ ...loadState(), wontdo: [...wontdoSet] });
  } else if (body.wontdo === false) {
    // Undo: remove from wontdo
    const wontdoSet = new Set(loadState().wontdo);
    wontdoSet.delete(id);
    saveState({ ...loadState(), wontdo: [...wontdoSet] });
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const state = loadState();
  if (id.startsWith("manual-")) {
    saveState({ ...state, manual: state.manual.filter((m) => m.id !== id) });
  } else if (id.startsWith("task-")) {
    // Stored task: remove the record outright (keeps the tasks array from growing).
    saveState({ ...state, tasks: state.tasks.filter((t) => t.id !== id) });
  } else {
    const deletedSet = new Set(state.deleted);
    deletedSet.add(id);
    saveState({ ...state, deleted: [...deletedSet] });
  }
  return Response.json({ ok: true });
}
