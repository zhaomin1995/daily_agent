import fs from "fs";
import path from "path";
import { BRIEFING_DIR, DEADLINES_FILE, ACTION_ITEMS_STATE } from "@/lib/paths";
import { localDate } from "@/lib/date";

export const dynamic = "force-dynamic";

function countSection(content: string, header: string): number {
  const idx = content.indexOf(header);
  if (idx === -1) return 0;
  const after = content.slice(idx + header.length);
  const end = after.search(/\n###/);
  const section = end === -1 ? after : after.slice(0, end);
  if (section.includes("*(none)*")) return 0;
  return section.split("\n").filter((l) => /^\*\*(.+?)\*\*[^|]*\|/.test(l)).length;
}

function loadCompleted(): Set<string> {
  try {
    if (fs.existsSync(ACTION_ITEMS_STATE)) {
      const data = JSON.parse(fs.readFileSync(ACTION_ITEMS_STATE, "utf-8"));
      return new Set<string>(data.completed || []);
    }
  } catch {}
  return new Set();
}

function parseNearestDeadline(): string | null {
  if (!fs.existsSync(DEADLINES_FILE)) return null;
  const content = fs.readFileSync(DEADLINES_FILE, "utf-8");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const datePattern = /due\s+(\d{4}-\d{2}-\d{2})/gi;
  const wordPattern = /due\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/gi;
  const dates: { date: Date; text: string }[] = [];

  let m;
  while ((m = datePattern.exec(content)) !== null) {
    const d = new Date(m[1]);
    if (!isNaN(d.getTime()) && d >= today) dates.push({ date: d, text: m[1] });
  }
  while ((m = wordPattern.exec(content)) !== null) {
    const d = new Date(m[1]);
    if (!isNaN(d.getTime()) && d >= today) dates.push({ date: d, text: m[1] });
  }

  if (dates.length === 0) return null;
  dates.sort((a, b) => a.date.getTime() - b.date.getTime());
  return dates[0].text;
}

function countPriorities(content: string): number {
  const idx = content.indexOf("## Today's Priorities");
  if (idx === -1) return 0;
  const after = content.slice(idx);
  const end = after.indexOf("\n## ", 4);
  const section = end === -1 ? after : after.slice(0, end);
  return section.split("\n").filter((l) => /^\d+\./.test(l.trim())).length;
}

export async function GET() {
  if (!fs.existsSync(BRIEFING_DIR)) {
    return Response.json({ urgent: 0, actionNeeded: 0, priorities: 0, nearestDeadline: null });
  }

  const today = localDate();
  const emailFile = path.join(BRIEFING_DIR, `${today}-email.md`);
  const workflowFile = path.join(BRIEFING_DIR, `${today}-workflow.md`);

  let urgent = 0;
  let actionNeeded = 0;
  let priorities = 0;
  const completed = loadCompleted();

  if (fs.existsSync(emailFile)) {
    const c = fs.readFileSync(emailFile, "utf-8");
    const rawUrgent = countSection(c, "### Urgent");
    const rawAction = countSection(c, "### Action Needed");
    // Subtract completed items using stable IDs: ${date}-email-urgent-${i}
    let doneUrgent = 0;
    for (let i = 0; i < rawUrgent; i++) {
      if (completed.has(`${today}-email-urgent-${i}`)) doneUrgent++;
    }
    let doneAction = 0;
    for (let i = 0; i < rawAction; i++) {
      if (completed.has(`${today}-email-action-${i}`)) doneAction++;
    }
    urgent = Math.max(0, rawUrgent - doneUrgent);
    actionNeeded = Math.max(0, rawAction - doneAction);
  }

  if (fs.existsSync(workflowFile)) {
    const c = fs.readFileSync(workflowFile, "utf-8");
    const rawPriorities = countPriorities(c);
    // Subtract completed workflow items using IDs: ${date}-${lineIndex}
    // Line indexes are assigned during extraction — count completed ones for today
    const doneWorkflow = [...completed].filter((id) => id.startsWith(`${today}-`) && !id.includes("email-") && !id.startsWith("manual-")).length;
    priorities = Math.max(0, rawPriorities - doneWorkflow);
  }

  return Response.json({ urgent, actionNeeded, priorities, nearestDeadline: parseNearestDeadline() });
}
