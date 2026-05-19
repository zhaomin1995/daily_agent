You are running my morning briefing routine. Today's date is {{date}}.

## Pre-flight: Check Apple Mail is Running

```bash
osascript -e 'tell application "System Events" to set isRunning to (name of processes) contains "Mail"'
```

If Mail is not running, launch it and wait:

```bash
osascript -e 'tell application "Mail" to activate' && sleep 8
```

## Step 1: Carry Over from Yesterday

Check if ~/morning-brief/{{yesterday}}.md exists. If it does, read it and extract any action items not marked as completed. List them under "## Carried Over from Yesterday" at the top of today's briefing.

## Step 2: Load Frequent Contacts

Read ~/.claude/frequent-contacts.txt if it exists. This is a plain list of email addresses (one per line) representing people I frequently correspond with. Use this list in Step 3 to help identify Urgent emails. If the file does not exist, skip this step.

## Step 3 — Pass 1: Fetch Email Headers + Preview (25 Most Recent Unread)

```bash
osascript << 'EOF'
tell application "Mail"
    set cutoff to (current date) - (1 * days)
    set emailData to ""
    set allAccounts to every account
    repeat with acct in allAccounts
        set acctName to name of acct
        set acctEmail to item 1 of (email addresses of acct)
        set allUnread to (messages of mailbox "Inbox" of acct whose read status is false and date received > cutoff)
        set msgCount to count of allUnread
        if msgCount > 25 then set msgCount to 25
        repeat with i from 1 to msgCount
            set msg to item i of allUnread
            set bodyText to content of msg
            if length of bodyText > 255 then
                set bodyText to (text 1 thru 255 of bodyText) & "..."
            end if
            set emailData to emailData & "ACCOUNT: " & acctName & " (" & acctEmail & ")" & return
            set emailData to emailData & "MSG_INDEX: " & i & return
            set emailData to emailData & "FROM: " & (sender of msg as string) & return
            set emailData to emailData & "FROM_ADDR: " & (address of sender of msg) & return
            set emailData to emailData & "SUBJECT: " & subject of msg & return
            set emailData to emailData & "DATE: " & (date received of msg as string) & return
            set emailData to emailData & "PREVIEW: " & bodyText & return
            set emailData to emailData & "---END---" & return
        end repeat
    end repeat
    return emailData
end tell
EOF
```

## Step 4: Triage All Emails Using Preview Only

**Detect Promotional/Social**: sender contains `no-reply`, `noreply`, `newsletter`, `donotreply`, `notifications`, `marketing`, or `automated` — OR subject contains `unsubscribe`, `% off`, `deal`, `offer`, `coupon`, or `newsletter` → **Promotional**. Subject line only. No draft.

**Detect Predatory**: subject or preview contains phrases like `submit your manuscript`, `call for papers`, `special issue`, `editorial board`, `open access journal`, `impact factor`, `publish your research`, `invite you to submit`, `conference invitation`, `peer-reviewed journal` from an unknown or external sender not in frequent-contacts.txt → **Predatory**. Subject line only. No draft, no action prompt.

**Classify within-org vs external**:
- `@ucsd.edu` or `@health.ucsd.edu` → Within-org (UCSD)
- `@pitt.edu` → Within-org (Pitt)
- All others → External

**Assign priority tier**:
- **Urgent**: Sender is in frequent-contacts.txt AND within-org, OR clear deadline/direct question in subject or preview
- **Action Needed**: Requires reply or decision but not urgent
- **FYI**: Informational only — subject line only, no further processing
- **Promotional**: Subject line only

Record which MSG_INDEX values are Urgent or Action Needed for Pass 2.

## Step 5 — Pass 2: Full Body + Draft for Urgent + Action Needed Only

For each Urgent or Action Needed email, fetch the full body:

```bash
osascript << 'EOF'
tell application "Mail"
    set acct to first account whose name is "ACCOUNT_NAME"
    set cutoff to (current date) - (1 * days)
    set allUnread to (messages of mailbox "Inbox" of acct whose read status is false and date received > cutoff)
    set msg to item MSG_INDEX of allUnread
    return content of msg
end tell
EOF
```

For each email:
1. Extract the full request, deadline, and context
2. **Detect tone**: is the email formal (professional salutation, full sentences) or casual (first name, informal language)? Note it.
3. Draft a reply matching that tone — formal stays formal, casual stays casual
4. Write a short 2-line Claude Code prompt: sender + what they asked + action needed

Save all Claude Code prompts to ~/morning-brief/{{date}}-action-prompts.md:

```
# Action Prompts — {{date}}
(Open when ready to act. Delete entries you want to ignore.)

## 1. [Sender Name] — [Subject]
[One line: what they asked.] Draft a reply and save to ~/morning-brief/{{date}}-[sender-shortname].md

## 2. [Sender Name] — [Subject]
[One line: what they asked.] Review and summarize, save to ~/morning-brief/{{date}}-[sender-shortname].md
```

## Step 6: Review Workflow Folder (Cached)

Read ~/morning-brief/workflow-cache.md if it exists. For each file in ~/Downloads/Workflow:
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

## Step 7: Extract Deadlines

Scan all Urgent and Action Needed emails and all Workflow documents for any explicit dates, deadlines, or due dates. Append them to ~/morning-brief/deadlines.md (create if missing):

```
## {{date}}
- [Source: sender name or filename] Description of deadline — due DATE
```

Do not duplicate entries already listed under a previous date in that file.

## Step 8: Save Morning Briefing

Run `mkdir -p ~/morning-brief` first. Estimate reading time as (total word count of briefing / 200), rounded up to nearest minute.

Save to ~/morning-brief/{{date}}.md:

```
# Morning Briefing — {{date}}
~X min read

## Carried Over from Yesterday
[Action items from {{yesterday}}.md still open, or "None"]

## [Account: UCSD]

### Urgent
[sender | subject | what is needed | deadline]

### Action Needed
[sender | subject | one-line description]

→ Claude Code prompts saved to ~/morning-brief/{{date}}-action-prompts.md

### FYI
[subject line only]

### Promotional
[subject line only]

### Predatory
[subject line only]

## [Account: Pitt]
[Same structure]

## Drafted Email Responses
[Full draft per Urgent/Action Needed email — tone matched to original]

## Workflow Document Summaries
[filename | summary | action items]

## Upcoming Deadlines
[Pull the 5 nearest future deadlines from ~/morning-brief/deadlines.md]

## Today's Priorities
[Ranked: carried-over → Urgent → Action Needed → document tasks]
```

## Step 9: Update Frequent Contacts

Read ~/.claude/frequent-contacts.txt (create if missing). For every within-org email sender processed today (UCSD or Pitt domain), add their address to the file if not already present. Save the updated file. One address per line.

## Step 10: Create Draft Replies in Apple Mail

For each email requiring a response, create a draft (do NOT send):

```bash
osascript << 'EOF'
tell application "Mail"
    set acct to first account whose name is "ACCOUNT_NAME_HERE"
    set newDraft to make new outgoing message with properties {subject:"Re: SUBJECT_HERE", content:"BODY_HERE", sender:"SENDER_EMAIL_HERE"}
    make new to recipient at newDraft with properties {address:"RECIPIENT_EMAIL_HERE"}
end tell
EOF
```
