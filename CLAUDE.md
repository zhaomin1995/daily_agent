# Daily Agent

Personal automation toolkit that runs recurring tasks via Claude Code and surfaces results through a web dashboard.

## What this project does

The first (and currently only) tool is **Morning Briefing** — an automated daily routine that:

1. Checks for Microsoft Graph API tokens for two email accounts (UCSD and Pitt)
2. Carries over incomplete action items from yesterday's briefing
3. Fetches unread emails from the last 24 hours via Graph API
4. Triages emails: detects promotional mail, classifies within-org vs external, assigns priority (Urgent / Action Needed / FYI)
5. Generates self-contained Claude Code prompts for each Action Needed email
6. Reviews files in ~/Downloads/Workflow modified in the last 14 days
7. Saves a structured markdown briefing to ~/morning-brief/{date}.md
8. Creates draft replies via Graph API (never sends automatically)

## Email Draft Assistant

An interactive tool (`/email-draft` page + `/api/email-draft` route) for composing a new
email from context in emails you already received. Flow:

1. Search your mailbox for context (e.g. "Sherlock X drive access")
2. Check the emails whose details (links, steps, access info) should inform the new message
3. Describe the intent + recipients + tone; the route drafts subject + body via `claude -p`
   (JSON out), grounded in the selected message bodies
4. Save the result as a draft (never sent) — review and send from your mail client

Two mailbox providers, selectable in the UI:

- **Apple Mail (default)** — reads/writes Mail.app via `osascript`, the same approach as the
  Email Debriefing tool. No token needed. Search defaults to the last **7 days** (selectable
  1/7/30) for speed over a large mailbox; subject+sender by default, with an optional
  "search body" toggle. Apple Mail search returns message bodies inline, so generate uses
  them directly. Drafts are created with `make new outgoing message` + `save`.
- **Outlook (Graph)** — uses `~/.claude/msgraph-token-{account}.txt`; `$search`, then fetches
  bodies by id, and `POST /me/messages` for the draft.

The API route handles four actions in one POST: `accounts`, `search`, `generate`,
`create-draft`. Dynamic values are passed to AppleScript via env vars read with
`system attribute` (injection-safe), not string interpolation.

## Repo structure

```
daily_agent/
├── morning-prompt.md          # Claude Code prompt template ({{date}} and {{yesterday}} placeholders)
├── morning                    # Shell script: injects dates into prompt, pipes to `claude -p`
├── morning-setup-prompt.txt   # Original spec/requirements document
└── web/                       # Next.js 16 dashboard (React 19, Tailwind CSS, TypeScript)
    └── src/
        ├── app/
        │   ├── page.tsx                    # Dashboard — tool cards with run buttons
        │   ├── logs/page.tsx               # Log viewer — browse past briefings
        │   ├── config/page.tsx             # Config — manage tokens and account status
        │   └── api/
        │       ├── tools/route.ts          # GET: list tools with status
        │       ├── tools/[id]/run/route.ts # POST: execute a tool script
        │       ├── logs/route.ts           # GET: list briefing files
        │       ├── logs/[date]/route.ts    # GET: read a specific briefing
        │       └── config/route.ts         # GET/PUT: token status and save
        ├── components/
        │   ├── Sidebar.tsx                 # Nav sidebar
        │   ├── ToolCard.tsx                # Tool card with inline output
        │   ├── LogViewer.tsx               # Date list + content display
        │   └── ConfigPanel.tsx             # Account status + token input
        └── lib/
            ├── tools.ts                    # Tool registry (add new tools here)
            └── paths.ts                    # Shared path constants
```

## Adding a new tool

1. Add an entry to `web/src/lib/tools.ts` with id, name, description, script path, and category
2. Create the corresponding script in the repo root
3. If the tool needs a status check, add logic to `getToolStatus()` in `web/src/app/api/tools/route.ts`

## Running the web dashboard

```
cd web && npm run dev
```

Opens at http://localhost:3000.

## Workflow rules

- **Comment coverage**: When making changes, add clear comments to improve code readability. Every function, component, and non-obvious logic block should have a short comment explaining its purpose.
- **Keep CLAUDE.md up to date**: If you add new files, tools, routes, or change the project structure, update this file to reflect the changes.
- **Commit after every change**: Always commit your changes before moving on. Do not leave uncommitted work — small, frequent commits prevent lost progress.

## Key design decisions

- The morning script calls `claude -p` (non-interactive pipe mode) — Claude Code executes the prompt end-to-end
- Draft replies are created via Graph API but never sent — user reviews and sends manually
- The tool registry in `tools.ts` is the single source of truth for what shows up in the dashboard
- Token files live in `~/.claude/` and are checked at runtime for status badges
- Briefing outputs go to `~/morning-brief/{date}.md`

## Action item states

Action items have three terminal states stored in `~/morning-brief/.action-items-state.json`:

- **Completed** (checkbox) — item is done; excluded from the next morning's carry-over
- **Won't do** (slash-circle icon, hover to reveal) — item is intentionally skipped; also excluded from carry-over and never resurfaces in future workflow summaries
- **Deleted** (trash icon) — permanently removed from the list

When the morning briefing runs, Step 1 reads the state file and skips any item whose ID appears in `completed` or `wontdo` before building the "Carried Over from Yesterday" section.
