export interface Tool {
  id: string;
  name: string;
  description: string;
  script: string;
  category: string;
  schedule: string | null;
}

export const tools: Tool[] = [
  {
    id: "email-brief",
    name: "Email Debriefing",
    description:
      "Fetches unread emails from all Apple Mail accounts, triages by priority (Urgent / Action Needed / FYI / Promotional / Predatory), drafts replies with tone matching, and saves action prompts for later.",
    script: "email-brief",
    category: "Daily Automation",
    schedule: null,
  },
  {
    id: "workflow-brief",
    name: "Workflow Summary",
    description:
      "Summarizes documents in ~/Downloads/Workflow, carries over unresolved action items from yesterday, tracks deadlines, and generates today's ranked priority list.",
    script: "workflow-brief",
    category: "Daily Automation",
    schedule: "Weekdays 8:00 AM",
  },
];
