export interface Tool {
  id: string;
  name: string;
  description: string;
  script: string;
  category: string;
}

export const tools: Tool[] = [
  {
    id: "morning-briefing",
    name: "Morning Briefing",
    description:
      "Fetches unread emails from UCSD and Pitt accounts via Microsoft Graph API, triages and prioritizes them, reviews workflow documents, generates a structured daily briefing, and creates draft replies.",
    script: "morning",
    category: "Daily Automation",
  },
];
