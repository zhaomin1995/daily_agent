You are running the workflow summary tool. Today's date is {{date}}.

## Step 1: Load Yesterday's Open Items

Check if ~/morning-brief/{{yesterday}}-workflow.md exists. If it does, read the "## Today's Priorities" section and collect all numbered items.

Read ~/morning-brief/.action-items-state.json if it exists. Parse the `completed`, `wontdo`, and `deleted` arrays. Each item's ID has the format `{{yesterday}}-LINE_INDEX` where LINE_INDEX is the 0-based index of its line in the file. Remove any item whose ID appears in those arrays.

Keep this filtered list in memory — it becomes the base of Today's Priorities in Step 4. Do NOT write a separate "Carried Over" section.

## Step 2: Review Workflow Folder (Cached)

Read ~/morning-brief/workflow-cache.md if it exists. For each file in ~/Documents/Workflow:
1. Run `stat -f "%Sm" -t "%Y-%m-%d %H:%M" FILENAME` to get its modification date
2. If modification date matches cache → use cached summary
3. If new or modified → read full contents, write 2–3 sentence summary, note action items

Rewrite ~/morning-brief/workflow-cache.md with all entries:

```
## workflow-cache

### filename.docx
Last-modified: YYYY-MM-DD HH:MM
Summary: ...
Action items: ...
```

## Step 3: Extract Deadlines

Scan all workflow documents for explicit dates, deadlines, or due dates. Append to ~/morning-brief/deadlines.md (create if missing):

```
## {{date}}
- [Source: filename] Description of deadline — due DATE
```

Do not duplicate entries already listed under a previous date.

## Step 4: Save Workflow Summary

Run `mkdir -p ~/morning-brief` first. Estimate read time (word count / 200, rounded up).

Save to ~/morning-brief/{{date}}-workflow.md:

```
# Workflow Summary — {{date}}
~X min read

## Document Summaries
[Changed/new files only: filename | summary | action items. One line per file: "_(N file(s) unchanged)_" for the rest.]

## Upcoming Deadlines
[5 nearest future deadlines from ~/morning-brief/deadlines.md]

## Today's Priorities
[Single unified list. Start with yesterday's open items (filtered list from Step 1). Then append only action items from documents that are NEW or MODIFIED since yesterday — skip unchanged documents since their tasks are already in the list above. End with deadline reminders within 7 days if not already listed. No item should appear more than once.]
```
