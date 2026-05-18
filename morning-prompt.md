You are running my morning briefing routine. Today's date is {{date}}.

## Pre-flight: Check for Microsoft Graph Tokens

Check that token files exist for each account:
- ~/.claude/msgraph-token-ucsd.txt
- ~/.claude/msgraph-token-pitt.txt

If either file is missing or empty, skip that account and print this one-time setup guide in the briefing:

---
ONE-TIME SETUP REQUIRED FOR [ACCOUNT]:

1. Go to https://portal.azure.com and sign in with your [UCSD/Pitt] account
2. Search for "App registrations" → click "New registration"
3. Name it "Morning Briefing", set account type to
   "Accounts in any organizational directory and personal Microsoft accounts", click Register
4. Note the Application (client) ID shown on the overview page
5. Go to "API permissions" → "Add a permission" → "Microsoft Graph" → "Delegated permissions"
   Add: Mail.Read, Mail.ReadWrite — then click "Grant admin consent"
6. Go to "Certificates & secrets" → "New client secret" → copy the secret value
7. To get your access token, run this command in terminal (replace CLIENT_ID and CLIENT_SECRET):
   curl -X POST "https://login.microsoftonline.com/common/oauth2/v2.0/token" \
     -d "client_id=CLIENT_ID&client_secret=CLIENT_SECRET&scope=Mail.Read Mail.ReadWrite offline_access&grant_type=device_code"
   (Follow the device code flow: visit the URL shown, enter the code, sign in with your account)
8. Copy the access_token from the response and save it:
   echo "YOUR_ACCESS_TOKEN" > ~/.claude/msgraph-token-[ucsd/pitt].txt

NOTE: If UCSD/Pitt blocks app registration for your account, use a personal Microsoft account
(free at microsoft.com) to register the app in step 1 — set account type to
"Accounts in any organizational directory and personal Microsoft accounts" so it can still
authenticate your institutional email. All other steps remain the same.
---

## Step 1: Carry Over from Yesterday

Check if ~/morning-brief/{{yesterday}}.md exists. If it does, read it and extract any action items that were not marked as completed. List them under "## Carried Over from Yesterday" at the top of today's briefing.

## Step 2: Read Emails (Last 24 Hours, All Accounts)

For each account that has a valid token file, run the following curl command, substituting the correct token and account label. Parse the JSON response to extract emails.

**UCSD account:**
```bash
CUTOFF=$(date -u -v-1d +%Y-%m-%dT%H:%M:%SZ)
TOKEN=$(cat ~/.claude/msgraph-token-ucsd.txt)
curl -s -X GET \
  "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?\$filter=isRead eq false and receivedDateTime ge $CUTOFF&\$select=from,subject,receivedDateTime,bodyPreview,body,toRecipients&\$top=50&\$orderby=receivedDateTime desc" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Pitt account:**
```bash
CUTOFF=$(date -u -v-1d +%Y-%m-%dT%H:%M:%SZ)
TOKEN=$(cat ~/.claude/msgraph-token-pitt.txt)
curl -s -X GET \
  "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?\$filter=isRead eq false and receivedDateTime ge $CUTOFF&\$select=from,subject,receivedDateTime,bodyPreview,body,toRecipients&\$top=50&\$orderby=receivedDateTime desc" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

From each response, extract for every email: `from.emailAddress.address`, `from.emailAddress.name`, `subject`, `receivedDateTime`, and `body.content`.

## Step 3: Process and Triage Each Email

**Account separation**: Group emails by account (e.g. UCSD, Pitt). Treat each account separately in the output.

**Detect promotional/social emails**: If the sender address contains `no-reply`, `noreply`, `newsletter`, `donotreply`, `notifications`, `marketing`, or `automated`, OR the subject contains `unsubscribe`, `% off`, `deal`, `offer`, `coupon`, or `newsletter` — mark as Promotional. Keep the subject line only. Skip the body entirely.

**Classify within-org vs external**:
- UCSD: sender domain ends in `@ucsd.edu` → Within-org
- Pitt: sender domain ends in `@pitt.edu` → Within-org
- All other domains → External

**Assign a priority tier**:
- **Urgent**: From a frequent contact (someone I have replied to recently) AND within-org, OR contains a clear deadline or direct question
- **Action Needed**: Requires a reply or decision, but not urgent
- **FYI**: No reply needed, informational only

**Truncate long bodies**: If a non-promotional email body exceeds 400 words, summarize rather than paste in full and note it was truncated.

**For each Action Needed email**, generate a ready-to-use Claude Code prompt that:
- Identifies the sender, date, and what they asked for
- Includes the key excerpt or context from the email body
- Specifies the exact action (draft reply, review document, summarize, research, etc.)
- Tells Claude where to save the output if applicable
Keep each prompt self-contained so it can be pasted cold into a new Claude Code session with no extra context.

## Step 4: Review Workflow Folder

List and read all files in ~/Downloads/Workflow modified in the last 14 days. For each:
1. Read the full contents
2. Write a 2–3 sentence summary
3. Note any pending action items, deadlines, or open questions

## Step 5: Save Morning Briefing

Run `mkdir -p ~/morning-brief` first, then save to ~/morning-brief/{{date}}.md:

# Morning Briefing — {{date}}

## Carried Over from Yesterday
[Action items from {{yesterday}}.md still open, or "None"]

## [Account: UCSD]

### Urgent
[sender | subject | what is needed | deadline]

### Action Needed

**From:** sender@domain.com
**Subject:** Subject line
**What's needed:** One-line description

> **Claude Code prompt:**
> "[Self-contained prompt with sender, date, key request excerpt, exact action, and output path]"

### FYI
[sender | subject | one-line note]

### Promotional
[subject line list only]

## [Account: Pitt]
[Same structure as above]

## Drafted Email Responses
[Full draft for each Urgent or Action Needed email requiring a reply, labeled by account and subject]

## Workflow Document Summaries
[filename | summary | action items]

## Today's Priorities
[Ranked list: carried-over items first, then Urgent emails, then Action Needed, then document tasks]

## Step 6: Create Draft Replies via Graph API

For each email requiring a response, create a draft using the Graph API for the correct account. Run one curl block per draft, substituting the token, recipient address, subject, and body. Do NOT send — leave as draft only.

**UCSD account drafts:**
```bash
TOKEN=$(cat ~/.claude/msgraph-token-ucsd.txt)
curl -s -X POST \
  "https://graph.microsoft.com/v1.0/me/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Re: SUBJECT_HERE",
    "body": {"contentType": "Text", "content": "BODY_HERE"},
    "toRecipients": [{"emailAddress": {"address": "RECIPIENT_EMAIL_HERE"}}]
  }'
```

**Pitt account drafts:**
```bash
TOKEN=$(cat ~/.claude/msgraph-token-pitt.txt)
curl -s -X POST \
  "https://graph.microsoft.com/v1.0/me/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Re: SUBJECT_HERE",
    "body": {"contentType": "Text", "content": "BODY_HERE"},
    "toRecipients": [{"emailAddress": {"address": "RECIPIENT_EMAIL_HERE"}}]
  }'
```
