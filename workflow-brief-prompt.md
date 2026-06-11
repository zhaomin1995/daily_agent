You are running the workflow summary tool. Today's date is {{date}}.

## Step 1: Load Yesterday's Open Items

Check if ~/morning-brief/{{yesterday}}-workflow.md exists. If it does, read the "## Today's Priorities" section and collect all numbered items.

Read ~/morning-brief/.action-items-state.json if it exists. Parse the `completed`, `wontdo`, and `deleted` arrays. Each item's ID has the format `{{yesterday}}-LINE_INDEX` where LINE_INDEX is the 0-based index of its line in the file. Remove any item whose ID appears in those arrays.

Keep this filtered list in memory — it becomes the base of Today's Priorities in Step 4. Do NOT write a separate "Carried Over" section.

Also run `taskstore list --open --json` to pull tasks injected by the **email briefing** (which runs just before this tool) and any manual/dashboard tasks. This is how email-driven follow-ups reach the workflow priorities. Add each open task to the in-memory list for Step 4; tag email-sourced ones so they are recognizable (e.g. prefix "Email — "). Skip the `task-...` items already covered by a workflow document, and skip any whose `id` is in the resolved sets above.

## Step 2: Read the Pipeline + Status Files (not full documents)

The per-project to-dos live in lightweight index/status files, not the manuscripts.
`~/Documents/Workflow/pipeline.md` is the authoritative digest and is tiny; full documents
(some are 1 MB+) are expensive and unnecessary for this brief. Do NOT read `.docx`/manuscript
contents when pipeline.md or a status file already covers the item.

1. Read `~/Documents/Workflow/pipeline.md`. Each row has Name, Status, Stage, a detailed
   **Next action**, and the canonical path. The "Next action" column is the per-project
   to-do and is the main source for Today's Priorities.
2. Read any per-project status file for current detail. Discover them with:

   ```bash
   find -L ~/Documents/Workflow/00_Active ~/Documents/Workflow/01_Waiting ~/Documents/Workflow/02_Follow_Up \
     -maxdepth 3 \( -iname STATUS.md -o -iname '*_status.md' \) 2>/dev/null
   ```

   (As of this writing: R01_COVID_AF_Heat has `STATUS.md` + `Drafts/heat_af_manuscript_status.md`,
   R01_Final_RPPR has `rppr_status.md`, ADA_Relinquishment has `relinquishment_status.md`. Most
   projects have none and are covered by pipeline.md alone.)
3. Last resort only — if an active item has NO pipeline.md row AND no status file, open its
   single most-recently-modified document to summarize it. This should be rare.

This replaces the old full-document scan and the `workflow-cache.md` summary cache, which
existed only to avoid re-reading large files.

## Step 3: Extract Deadlines

Pull explicit dates/deadlines from `pipeline.md` and the status files read in Step 2 (not from
full documents). Append new ones to ~/morning-brief/deadlines.md (create if missing):

```
## {{date}}
- [Source: pipeline.md | <project>] Description of deadline — due DATE
```

Do not duplicate entries already listed under a previous date.

## Step 4: Save Workflow Summary

Run `mkdir -p ~/morning-brief` first. Estimate read time (word count / 200, rounded up).

Save to ~/morning-brief/{{date}}-workflow.md:

```
# Workflow Summary — {{date}}
~X min read

## Project Status
[One line per active project from pipeline.md: project | status | next action. Flag any project whose status file changed since yesterday.]

## Upcoming Deadlines
[5 nearest future deadlines from ~/morning-brief/deadlines.md]

## Today's Priorities
[Single unified list. Start with yesterday's open items (filtered list from Step 1) plus the open `taskstore` tasks. Then add any project from pipeline.md whose "Next action" is not already represented. End with deadline reminders within 7 days if not already listed. No item should appear more than once.]
```
