# Daily Agent

Personal automation toolkit that runs recurring tasks via Claude Code and surfaces results through a web dashboard.

## What this project does

The daily routine is split into **two tools** run in sequence by the `morning` wrapper:

### Email Debriefing (`email-brief`)

An automated email triage that:

1. Ensures Apple Mail is running (launches and waits if not)
2. Loads frequent contacts from `~/.claude/frequent-contacts.txt`
3. Fetches the 25 most recent unread emails from the last 24h across **all Apple Mail accounts** (UCSD Exchange, Pitt) via AppleScript/`osascript`
4. Triages each: detects Promotional and Predatory mail, classifies within-org vs external, assigns priority (Urgent / Action Needed / FYI)
5. Re-fetches full bodies for Urgent + Action Needed mail and drafts tone-matched replies
6. Generates self-contained Claude Code prompts for each Action Needed email
7. Saves the briefing to `~/morning-brief/{date}-email.md` and action prompts to `~/morning-brief/{date}-action-prompts.md`
8. Creates draft replies in Apple Mail (never sends automatically)

### Workflow Summary (`workflow-brief`)

A workflow-folder digest that:

1. Loads yesterday's open priorities from `~/morning-brief/{yesterday}-workflow.md`, filtering out items marked completed/wontdo/deleted in `~/morning-brief/.action-items-state.json`
2. Reviews files in `~/Documents/Workflow` using a modification-time cache (`~/morning-brief/workflow-cache.md`) so unchanged files are not re-read
3. Extracts deadlines into `~/morning-brief/deadlines.md`
4. Saves a single ranked priority list to `~/morning-brief/{date}-workflow.md`

> Note: `~/Documents/Workflow` is a GTD staging area of **symlinks** to canonical files in `~/Documents/Research` and `~/Documents/Career`. See `~/Documents/Workflow/CLAUDE.md`.

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
├── morning                     # Wrapper: runs email-brief then workflow-brief
├── email-brief                 # Email triage script: injects dates into prompt, pipes to `claude -p`
├── workflow-brief              # Workflow digest script: same pattern
├── email-brief-prompt.md       # Email triage prompt template ({{date}}, {{yesterday}} placeholders)
├── workflow-brief-prompt.md    # Workflow digest prompt template
├── taskstore                   # Shared task-store CLI both briefings + dashboard use (see below)
├── coauthors.yaml              # Co-author registry for the Submission Manager
├── morning-setup-prompt.txt    # Original spec/requirements document (historical)
├── submissions/                # Submission Manager data
└── web/                        # Next.js 16 dashboard (React 19, Tailwind CSS, TypeScript)
    └── src/
        ├── app/
        │   ├── page.tsx            # Dashboard — tool cards + today snapshot + action-item summary
        │   ├── action-items/       # Unified "Today" view — ranked email+workflow+manual items
        │   ├── logs/               # Log viewer — browse split briefings + action items
        │   ├── config/             # Config — tokens and account status
        │   ├── availability/       # Calendar availability generator
        │   ├── email-draft/        # Email Draft Assistant
        │   ├── email/[id]/         # Single-email view
        │   ├── references/         # Reference Generator
        │   ├── submissions/        # Submission Manager (+ [id], coauthors)
        │   ├── login/              # Auth (NextAuth)
        │   └── api/                # ~29 route handlers, including:
        │       ├── tools/route.ts            # GET: list tools with status
        │       ├── tools/[id]/{run,status,history,prompt}/route.ts
        │       ├── logs/route.ts             # GET: list split briefing files (badges)
        │       ├── logs/[date]/route.ts      # GET/PUT: read/edit one file ({date}-{type})
        │       ├── action-items/route.ts     # GET/PUT/PATCH/DELETE: action-item state
        │       ├── briefing/actions/route.ts, summary/route.ts, calendar/route.ts
        │       ├── search/route.ts, open-file/route.ts, email/[id]/route.ts
        │       ├── email-draft/route.ts, coauthors/*, submissions/*
        │       └── config/route.ts, auth/[...nextauth]/route.ts
        ├── components/             # ~22 components (LogViewer, ActionItems, ToolCard,
        │                           #   Sidebar, ConfigPanel, SnapshotPanel, StatsBar, …)
        └── lib/
            ├── tools.ts            # Tool registry (add new tools here)
            ├── paths.ts            # Shared path constants
            └── date.ts             # localDate() — YYYY-MM-DD in LOCAL time (see note below)
```

> Date handling: always use `localDate()` from `lib/date.ts` to compute "today"
> for matching brief files. `new Date().toISOString()` returns UTC and rolls the
> date over in the evening for timezones behind UTC, which previously made the
> snapshot/today views look empty at night.

> The dashboard is more built-out than this tree implies (logs viewer with
> interactive action-item state, calendar availability, search, submissions,
> references, email draft). Run `find web/src/app/api -name route.ts` for the
> full route list before assuming a capability is missing.

## Deployment

The scripts and prompt templates are the source of truth in **this repo**; the live
locations are **symlinks** back here, so editing a file in the repo updates the live tool
and vice versa (no copy/deploy step that can drift):

| Repo file | Symlinked from |
|---|---|
| `morning` | `~/.local/bin/morning` |
| `email-brief` | `~/.local/bin/email-brief` |
| `workflow-brief` | `~/.local/bin/workflow-brief` |
| `email-brief-prompt.md` | `~/.claude/email-brief-prompt.md` |
| `workflow-brief-prompt.md` | `~/.claude/workflow-brief-prompt.md` |
| `taskstore` | `~/.local/bin/taskstore` |

Scheduling: `~/Library/LaunchAgents/com.lantingyang.morning.plist` runs `morning` at
8:00 AM Mon–Fri. Run logs go to `~/morning-brief/logs/`. Manage with:

```
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.lantingyang.morning.plist  # load
launchctl bootout   gui/$(id -u) ~/Library/LaunchAgents/com.lantingyang.morning.plist  # unload
launchctl kickstart -k gui/$(id -u)/com.lantingyang.morning                            # run now
```

> macOS caveat: a launchd job that drives Apple Mail via `osascript` needs Automation
> (and Full Disk Access) permission. The first scheduled run may be blocked by TCC until
> granted in System Settings → Privacy & Security.

## Adding a new tool

1. Add an entry to `web/src/lib/tools.ts` with id, name, description, script path, and category
2. Create the corresponding script in the repo root (and symlink it into `~/.local/bin` if it should run standalone)
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

- Each script substitutes `{{date}}`/`{{yesterday}}` into its prompt template and pipes it to `claude -p` (non-interactive). Tools are pinned (`--allowedTools "Bash,Read,Write"`) so unattended runs never block on a permission prompt; the model is pinned (`--model claude-sonnet-4-6`) for reproducible cost/latency.
- Email access is **Apple Mail via AppleScript** — no API token. Drafts are created but never sent; the user reviews and sends manually.
- The tool registry in `tools.ts` is the single source of truth for what shows up in the dashboard.
- Briefing outputs go to `~/morning-brief/` as split `{date}-email.md` + `{date}-workflow.md` (plus `{date}-action-prompts.md`).

## How the tools update each other (shared task store)

The two briefings are otherwise independent `claude -p` runs, but they share one
substrate so a task found by one shows up in the other: the `tasks` array in
`~/morning-brief/.action-items-state.json`, written and read through the
**`taskstore`** CLI (repo root, symlinked to `~/.local/bin`). The CLI does atomic
writes and `add` is idempotent (de-duped by source + text), so re-running a brief
never creates duplicates.

Flow:

1. **email-brief** (Step 4b) pushes one task per Urgent / Action Needed email:
   `taskstore add --source email --text "<action>" --ref "<sender | subject>" [--priority high]`
2. **workflow-brief** (Step 1) runs `taskstore list --open --json` and folds those
   tasks into Today's Priorities — this is how email follow-ups reach the workflow
   list. (`morning` runs email-brief first, so the tasks exist by then.)
3. The **dashboard** `/api/action-items` reads the same `tasks` array and renders
   them in the Today view (email tasks get the "Email" badge). Complete / won't-do /
   priority / delete all work on these via the existing id-keyed state sets.

CLI: `taskstore add|list|done|rm` — see `taskstore -h`. It only touches the `tasks`
array and preserves all other keys the dashboard owns.

## Action item states

Action items have three terminal states stored in `~/morning-brief/.action-items-state.json`:

- **Completed** (checkbox) — item is done; excluded from the next morning's carry-over
- **Won't do** (slash-circle icon, hover to reveal) — item is intentionally skipped; also excluded from carry-over and never resurfaces in future workflow summaries
- **Deleted** (trash icon) — permanently removed from the list

When `workflow-brief` runs, Step 1 reads the state file and skips any item whose ID appears in `completed` or `wontdo` before building the carried-over priorities.
