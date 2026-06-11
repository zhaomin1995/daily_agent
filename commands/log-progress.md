---
description: Log today's grant/paper/admin progress into Workflow pipeline.md (+ status files)
argument-hint: <what you worked on and what's next>
---

You are logging the user's end-of-day progress into their GTD workflow.

What the user did today:

$ARGUMENTS

Do this:

1. Read `~/Documents/Workflow/pipeline.md` (the one-line-per-item index) and
   `~/Documents/Workflow/CLAUDE.md` (the staging contract). Get today's date with
   `date +%Y-%m-%d`.
2. Match what the user described to the relevant `pipeline.md` row(s) by project name. If you
   cannot tell which item they mean, ask before editing — do not guess.
3. For each affected item, update its **Status** and **Next action** cells to reflect the
   progress and the concrete next step. Preserve the markdown table formatting exactly; do not
   touch unrelated rows or columns. The "Next action" column is what the morning workflow brief
   reads into Today's Priorities, so make it the real next step, not a vague note.
4. If the user mentions a new or changed deadline, append it to `~/morning-brief/deadlines.md`
   (create if missing) under a `## <today>` heading, without duplicating an existing entry.
5. If the affected project has a `STATUS.md` or `*_status.md` file and the update has detail
   worth keeping (a decision, blocker, or where things stand), update that file too. Find them:
   `find -L ~/Documents/Workflow/0*/ -maxdepth 3 \( -iname STATUS.md -o -iname '*_status.md' \) 2>/dev/null`
6. If an item is now finished, follow the contract's "How to archive" steps — BUT per the
   contract's deletion policy, never delete a file/folder or remove a symlink without explicit
   confirmation. Propose the archive move and ask.
7. End with a short summary: for each item, the old vs new **Status** / **Next action**, plus
   any deadline or status-file change. Keep it to a few lines.

Keep edits minimal and surgical. Touch only what the user actually reported progress on.
