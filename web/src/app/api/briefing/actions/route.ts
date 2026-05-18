import fs from "fs";
import path from "path";
import { BRIEFING_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

interface ActionItem {
  text: string;
  completed: boolean;
  source: string;
}

/* Extracts uncompleted action items from the most recent briefing.
   Looks for markdown checkbox patterns: - [ ] and - [x] */
function extractActionItems(content: string, date: string): ActionItem[] {
  const items: ActionItem[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const unchecked = line.match(/^[\s]*[-*]\s*\[\s*\]\s*(.+)/);
    if (unchecked) {
      items.push({ text: unchecked[1].trim(), completed: false, source: date });
    }
    const checked = line.match(/^[\s]*[-*]\s*\[[xX]\]\s*(.+)/);
    if (checked) {
      items.push({ text: checked[1].trim(), completed: true, source: date });
    }
  }

  return items;
}

/* Also looks for items under "Today's Priorities" or "Carried Over" sections
   that aren't in checkbox format */
function extractPriorityItems(content: string, date: string): ActionItem[] {
  const items: ActionItem[] = [];
  const sections = ["## Today's Priorities", "## Carried Over from Yesterday"];

  for (const sectionHeader of sections) {
    const idx = content.indexOf(sectionHeader);
    if (idx === -1) continue;

    const afterHeader = content.slice(idx + sectionHeader.length);
    // Read until the next ## header or end of file
    const nextSection = afterHeader.indexOf("\n## ");
    const sectionContent = nextSection === -1 ? afterHeader : afterHeader.slice(0, nextSection);

    const lines = sectionContent.split("\n");
    for (const line of lines) {
      const bullet = line.match(/^[\s]*[-*]\s+(?!\[)(.+)/);
      if (bullet) {
        const text = bullet[1].trim();
        // Skip "None" or empty-ish lines
        if (text && text.toLowerCase() !== "none") {
          items.push({ text, completed: false, source: date });
        }
      }
    }
  }

  return items;
}

export async function GET() {
  if (!fs.existsSync(BRIEFING_DIR)) {
    return Response.json({ items: [], date: null });
  }

  const files = fs
    .readdirSync(BRIEFING_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();

  if (files.length === 0) {
    return Response.json({ items: [], date: null });
  }

  const latestFile = files[0];
  const date = latestFile.replace(".md", "");
  const content = fs.readFileSync(path.join(BRIEFING_DIR, latestFile), "utf-8");

  // Combine checkbox items and priority/carryover bullet items, deduplicated
  const checkboxItems = extractActionItems(content, date);
  const priorityItems = extractPriorityItems(content, date);

  // Only return uncompleted items
  const seen = new Set<string>();
  const uncompleted: ActionItem[] = [];

  for (const item of [...checkboxItems, ...priorityItems]) {
    if (!item.completed && !seen.has(item.text)) {
      seen.add(item.text);
      uncompleted.push(item);
    }
  }

  return Response.json({ items: uncompleted, date });
}
