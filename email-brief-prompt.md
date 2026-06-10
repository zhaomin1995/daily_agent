You are running the email debriefing tool. Today's date is {{date}}.

## Pre-flight: Check Apple Mail is Running

```bash
osascript -e 'tell application "System Events" to set isRunning to (name of processes) contains "Mail"'
```

If not running, launch it and wait:

```bash
osascript -e 'tell application "Mail" to activate' && sleep 8
```

## Step 1: Load Frequent Contacts

Read ~/.claude/frequent-contacts.txt if it exists. One email address per line. Use this in triage to identify Urgent emails.

## Step 2 — Pass 1: Fetch 25 Most Recent Unread Emails

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
            -- Capture the stable RFC Message-ID so Pass 2 can re-fetch by identity,
            -- not by position (positions shift if new mail arrives between passes).
            try
                set msgId to message id of msg
            on error
                set msgId to ""
            end try
            set emailData to emailData & "MESSAGE_ID: " & msgId & return
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

## Step 3: Triage All Emails

**Detect Promotional**: sender contains `no-reply`, `noreply`, `newsletter`, `donotreply`, `notifications`, `marketing`, `automated` — OR subject contains `unsubscribe`, `% off`, `deal`, `offer`, `coupon`, `newsletter` → **Promotional**. Subject line only. No draft.

**Detect Predatory**: subject or preview contains `submit your manuscript`, `call for papers`, `special issue`, `editorial board`, `open access journal`, `impact factor`, `publish your research`, `invite you to submit`, `conference invitation`, `peer-reviewed journal` from an unknown external sender → **Predatory**. Subject line only. No draft.

**Classify within-org vs external**:
- `@ucsd.edu` or `@health.ucsd.edu` → Within-org (UCSD)
- `@pitt.edu` → Within-org (Pitt)
- All others → External

**Assign priority tier**:
- **Urgent**: Sender is in frequent-contacts.txt AND within-org, OR clear deadline or direct question in subject/preview
- **Action Needed**: Requires reply or decision, not urgent
- **FYI**: Informational only — subject line only

Record MESSAGE_ID (and MSG_INDEX as a fallback) for Urgent and Action Needed emails only.

## Step 4 — Pass 2: Full Body + Draft for Urgent + Action Needed

For each Urgent or Action Needed email, fetch the full body by its stable MESSAGE_ID —
not by position, since mail arriving between Pass 1 and Pass 2 would shift positional
indexes and make you draft against the wrong message:

```bash
osascript << 'EOF'
tell application "Mail"
    set acct to first account whose name is "ACCOUNT_NAME"
    set theMsg to first message of mailbox "Inbox" of acct whose message id is "MESSAGE_ID_HERE"
    return content of theMsg
end tell
EOF
```

If MESSAGE_ID is empty (rare — the header was missing), fall back to the positional form:
re-fetch `(messages of mailbox "Inbox" of acct whose read status is false and date received > cutoff)`
with `cutoff` set to `(current date) - (1 * days)`, then take `item MSG_INDEX`.

For each email:
1. Extract the full request, deadline, and context
2. Detect tone: formal or casual — match it in the draft reply
3. Draft a reply
4. Write a 2-line Claude Code prompt: sender + what they asked + action needed

Save all Claude Code prompts to ~/morning-brief/{{date}}-action-prompts.md:

```
# Action Prompts — {{date}}
(Open when ready to act. Delete entries you want to ignore.)

## 1. [Sender Name] — [Subject]
[One line: what they asked.] Draft a reply and save to ~/morning-brief/{{date}}-[sender-shortname].md
```

## Step 4b: Push Tasks to the Shared Store

So email-driven follow-ups appear in the **workflow briefing** and the dashboard
Today view, push one task per Urgent / Action Needed email into the shared task
store. `taskstore add` is idempotent (de-duped by source + text), so re-running is
safe and never creates duplicates.

For each Urgent or Action Needed email, run:

```bash
taskstore add --source email \
  --text "ONE imperative line — the action, e.g. 'Reply to Brian re COD; remind July 15'" \
  --ref "SENDER | SUBJECT" \
  --date {{date}}
# add --priority high for Urgent emails only
```

Rules: `--text` is the action to take (not a summary of the email); keep it to one
line. Use `--priority high` only for Urgent. Do NOT push tasks for FYI, Promotional,
or Predatory mail.

## Step 5: Save Email Briefing

Run `mkdir -p ~/morning-brief` first. Estimate read time (word count / 200, rounded up).

Save to ~/morning-brief/{{date}}-email.md:

```
# Email Debriefing — {{date}}
~X min read

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
```

## Step 6: Update Frequent Contacts

Read ~/.claude/frequent-contacts.txt (create if missing). Add any within-org sender addresses not already listed. One address per line.

## Step 7: Create Draft Replies in Apple Mail

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
