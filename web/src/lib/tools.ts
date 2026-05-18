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
    id: "morning-briefing",
    name: "Morning Briefing",
    description:
      "Fetches unread emails from UCSD and Pitt accounts via Microsoft Graph API, triages and prioritizes them, reviews workflow documents, generates a structured daily briefing, and creates draft replies.",
    script: "morning",
    category: "Daily Automation",
    schedule: "Weekdays 8:00 AM",
  },
];
