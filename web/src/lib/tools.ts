export interface Tool {
  id: string;
  name: string;
  description: string;
  script: string;
  category: string;
  schedule: string | null;
  type?: "script" | "link";
  href?: string;
}

export const tools: Tool[] = [
  {
    id: "email-brief",
    name: "Email Debriefing",
    description:
      "Fetches unread emails from all Apple Mail accounts, triages by priority (Urgent / Action Needed / FYI / Promotional / Predatory), drafts replies with tone matching, and saves action prompts for later.",
    script: "email-brief",
    category: "Daily Automation",
    schedule: "Weekdays 8:00 AM",
    type: "script",
  },
  {
    id: "workflow-brief",
    name: "Workflow Summary",
    description:
      "Summarizes documents in ~/Documents/Workflow, carries over unresolved action items from yesterday, tracks deadlines, and generates today's ranked priority list.",
    script: "workflow-brief",
    category: "Daily Automation",
    schedule: "Weekdays 8:00 AM",
    type: "script",
  },
  {
    id: "submissions",
    name: "Submission Manager",
    description:
      "Manage manuscript submissions — track co-authors with affiliations & ORCID, assign CRediT contributions, paste author lists for instant selection and export as formatted Word documents.",
    script: "",
    category: "Research",
    schedule: null,
    type: "link",
    href: "/submissions",
  },
  {
    id: "availability",
    name: "Availability",
    description:
      "Pull your Outlook calendar and generate ready-to-paste availability windows for meeting scheduling. Set working hours, minimum slot size, and get a formatted block you can paste directly into email.",
    script: "",
    category: "Daily",
    schedule: null,
    type: "link",
    href: "/availability",
  },
  {
    id: "email-draft",
    name: "Email Draft Assistant",
    description:
      "Search emails you received for context (instructions, links, access info), then draft a new email that reuses those details. Saves to Outlook Drafts — never sends.",
    script: "",
    category: "Daily",
    schedule: null,
    type: "link",
    href: "/email-draft",
  },
  {
    id: "references",
    name: "Reference Generator",
    description:
      "Paste manuscript text, a rough reference list, or DOIs/PMIDs and generate a clean, numbered reference list in APA, Vancouver, or NLM format ready to copy or download as .docx.",
    script: "",
    category: "Research",
    schedule: null,
    type: "link",
    href: "/references",
  },
];
