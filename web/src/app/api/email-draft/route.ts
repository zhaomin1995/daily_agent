import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { TOKEN_DIR } from "@/lib/paths";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ *
 * Email Draft Assistant API
 *
 * Drafts a new email from context in emails you already received.
 * Two providers:
 *   - "applemail" : reads/writes Apple Mail (Mail.app) via osascript,
 *                   the same way the Email Debriefing tool does. No token.
 *   - "graph"     : Microsoft Graph using ~/.claude/msgraph-token-*.txt.
 *
 * One POST endpoint, actions: "accounts", "search", "generate",
 * "create-draft". All drafts are saved, never sent.
 * ------------------------------------------------------------------ */

interface EmailMatch {
  id: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  receivedDateTime: string;
  bodyPreview: string;
  account?: string; // Apple Mail account name
  body?: string; // full (capped) text — included for the applemail provider
}

// ---------- Apple Mail (osascript) helpers ----------

// Run a static AppleScript, passing dynamic values via env vars so there is
// no string interpolation into the script (injection-safe). The script reads
// them with `system attribute "NAME"`.
async function osa(script: string, vars: Record<string, string> = {}): Promise<string> {
  const { stdout } = await execAsync(
    `osascript <<'EDA_APPLESCRIPT'\n${script}\nEDA_APPLESCRIPT`,
    { env: { ...process.env, ...vars }, timeout: 150000, maxBuffer: 20 * 1024 * 1024 }
  );
  return stdout;
}

const RS = "\x1e"; // record separator between messages
const US = "\x1f"; // unit separator between fields

// List Mail.app accounts and their primary address.
const ACCOUNTS_SCRIPT = `
set RS to (ASCII character 30)
set US to (ASCII character 31)
tell application "Mail"
    set out to ""
    repeat with acct in every account
        set e to ""
        try
            set ea to email addresses of acct
            if class of ea is list then
                if (count of ea) > 0 then set e to item 1 of ea
            else
                set e to ea as string
            end if
        end try
        set out to out & (name of acct) & US & e & RS
    end repeat
    return out
end tell`;

// Search Inbox by subject/sender (and body when EDA_DEEP="1"); returns up to
// 15 matches WITH a preview and capped full body, so generate needs no re-fetch.
const SEARCH_SCRIPT = `
set q to system attribute "EDA_QUERY"
set deepFlag to system attribute "EDA_DEEP"
set daysBack to 7
try
    set daysBack to (system attribute "EDA_DAYS") as integer
end try
set RS to (ASCII character 30)
set US to (ASCII character 31)
tell application "Mail"
    set cutoff to (current date) - (daysBack * days)
    set out to ""
    set n to 0
    repeat with acct in every account
        try
            if deepFlag is "1" then
                set matches to (messages of mailbox "Inbox" of acct whose date received > cutoff and (subject contains q or sender contains q or content contains q))
            else
                set matches to (messages of mailbox "Inbox" of acct whose date received > cutoff and (subject contains q or sender contains q))
            end if
            repeat with msg in matches
                if n ≥ 15 then exit repeat
                set n to n + 1
                set fromName to ""
                set fromAddr to ""
                try
                    set fromName to extract name from (sender of msg)
                    set fromAddr to extract address from (sender of msg)
                end try
                set subj to subject of msg
                set dstr to (date received of msg) as string
                set bodyText to ""
                try
                    set bodyText to content of msg
                end try
                set preview to bodyText
                if (count of characters of preview) > 255 then set preview to (text 1 thru 255 of preview)
                if (count of characters of bodyText) > 4000 then set bodyText to (text 1 thru 4000 of bodyText)
                set out to out & (name of acct) & US & fromName & US & fromAddr & US & subj & US & dstr & US & preview & US & bodyText & RS
            end repeat
        end try
        if n ≥ 15 then exit repeat
    end repeat
    return out
end tell`;

// Create an Apple Mail draft (saved to Drafts, never sent).
const DRAFT_SCRIPT = `
set theSubject to system attribute "EDA_SUBJECT"
set theBody to system attribute "EDA_BODY"
set theSender to system attribute "EDA_SENDER"
set theRecips to system attribute "EDA_RECIPS"
tell application "Mail"
    set newDraft to make new outgoing message with properties {subject:theSubject, content:theBody, visible:false}
    if theSender is not "" then
        try
            set sender of newDraft to theSender
        end try
    end if
    set AppleScript's text item delimiters to ","
    set recipList to text items of theRecips
    set AppleScript's text item delimiters to ""
    repeat with r in recipList
        set a to my trimStr(r as string)
        if a is not "" then
            make new to recipient at newDraft with properties {address:a}
        end if
    end repeat
    save newDraft
end tell
return "ok"

on trimStr(s)
    repeat while s starts with " "
        set s to text 2 thru -1 of s
    end repeat
    repeat while (s is not "") and (s ends with " ")
        set s to text 1 thru -2 of s
    end repeat
    return s
end trimStr`;

function parseAppleAccounts(out: string): Array<{ name: string; email: string }> {
  return out
    .split(RS)
    .filter((r) => r.trim())
    .map((r) => {
      const [name, email] = r.split(US);
      return { name: (name || "").trim(), email: (email || "").trim() };
    });
}

function parseAppleMatches(out: string): EmailMatch[] {
  return out
    .split(RS)
    .filter((r) => r.trim())
    .map((r, i) => {
      const [account, fromName, fromEmail, subject, date, preview, body] = r.split(US);
      return {
        id: `apple-${i}`,
        account: (account || "").trim(),
        fromName: (fromName || "").trim(),
        fromEmail: (fromEmail || "").trim(),
        subject: (subject || "(no subject)").trim(),
        receivedDateTime: (date || "").trim(),
        bodyPreview: (preview || "").trim(),
        body: body || "",
      };
    });
}

// ---------- Microsoft Graph helpers ----------

function readToken(account: string): string | null {
  const tokenFile = path.join(TOKEN_DIR, `msgraph-token-${account}.txt`);
  if (!fs.existsSync(tokenFile) || fs.statSync(tokenFile).size === 0) return null;
  return fs.readFileSync(tokenFile, "utf-8").trim();
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function graphSearch(account: string, query: string): Promise<EmailMatch[]> {
  const token = readToken(account);
  if (!token) throw new Error(`No token configured for ${account}`);
  const url =
    `https://graph.microsoft.com/v1.0/me/messages` +
    `?$search=${encodeURIComponent(`"${query}"`)}` +
    `&$select=id,subject,from,receivedDateTime,bodyPreview&$top=15`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: "eventual" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    value: Array<{
      id: string;
      subject?: string;
      from?: { emailAddress?: { name?: string; address?: string } };
      receivedDateTime?: string;
      bodyPreview?: string;
    }>;
  };
  return (data.value || []).map((m) => ({
    id: m.id,
    subject: m.subject || "(no subject)",
    fromName: m.from?.emailAddress?.name || "",
    fromEmail: m.from?.emailAddress?.address || "",
    receivedDateTime: m.receivedDateTime || "",
    bodyPreview: m.bodyPreview || "",
  }));
}

async function graphFetchBody(
  account: string,
  id: string
): Promise<{ subject: string; from: string; date: string; text: string }> {
  const token = readToken(account);
  if (!token) throw new Error(`No token configured for ${account}`);
  const url =
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}` +
    `?$select=subject,from,receivedDateTime,body`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to fetch message body (HTTP ${res.status})`);
  const m = (await res.json()) as {
    subject?: string;
    from?: { emailAddress?: { name?: string; address?: string } };
    receivedDateTime?: string;
    body?: { contentType?: string; content?: string };
  };
  const raw = m.body?.content || "";
  const text = m.body?.contentType?.toLowerCase() === "html" ? htmlToText(raw) : raw.trim();
  return {
    subject: m.subject || "(no subject)",
    from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "",
    date: m.receivedDateTime || "",
    text,
  };
}

async function graphCreateDraft(params: {
  account: string;
  subject: string;
  body: string;
  recipients: string;
}): Promise<{ id: string; webLink: string }> {
  const { account, subject, body, recipients } = params;
  const token = readToken(account);
  if (!token) throw new Error(`No token configured for ${account}`);
  const toRecipients = recipients
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));
  const res = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ subject, body: { contentType: "Text", content: body }, toRecipients }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { id: string; webLink: string };
  return { id: data.id, webLink: data.webLink };
}

// ---------- Drafting (shared) ----------

// Build the draft with Claude, grounded in the provided context emails.
async function generateDraft(params: {
  contexts: Array<{ subject: string; from: string; date: string; text: string }>;
  intent: string;
  recipients: string;
  extraContext: string;
  tone: string;
}): Promise<{ subject: string; body: string }> {
  const { contexts, intent, recipients, extraContext, tone } = params;

  const contextBlock = contexts
    .map(
      (c, i) =>
        `--- Context email ${i + 1} ---\nFrom: ${c.from}\nDate: ${c.date}\nSubject: ${c.subject}\n\n${c.text.slice(0, 4000)}`
    )
    .join("\n\n");

  const prompt = `You are helping the researcher Lanting Yang draft a professional email.

WHAT THIS EMAIL SHOULD ACCOMPLISH:
${intent}
${recipients ? `\nRECIPIENTS: ${recipients}` : ""}
${extraContext ? `\nADDITIONAL CONTEXT FROM THE USER:\n${extraContext}` : ""}

CONTEXT FROM EMAILS THE USER RECEIVED (use these for accurate concrete details — links, steps, file paths, names, deadlines, account info):
${contextBlock || "(no context emails were selected)"}

Instructions:
- Write in a ${tone} tone.
- Pull concrete details (links, step-by-step instructions, paths, names, dates) from the context emails above. Do NOT invent specifics that aren't supported by the context.
- If you are relaying setup or access instructions to others, present them as clear numbered steps.
- Keep it concise and skimmable. No greeting placeholders like "[Name]" unless the recipient is unknown.
- Return ONLY a JSON object with exactly two keys: "subject" and "body". No markdown, no code fences, no commentary.`;

  const escaped = prompt.replace(/'/g, "'\\''");
  const { stdout } = await execAsync(`claude -p '${escaped}'`, {
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  });

  const out = stdout.trim();
  const match = out.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { subject?: string; body?: string };
      if (parsed.body) return { subject: parsed.subject || "(no subject)", body: parsed.body };
    } catch {
      /* fall through */
    }
  }
  return { subject: "Draft email", body: out };
}

// ---------- Route ----------

export async function POST(request: Request) {
  const body = await request.json();
  const { action, provider } = body as { action?: string; provider?: string };
  const isApple = (provider || "applemail") === "applemail";

  try {
    switch (action) {
      case "accounts": {
        if (!isApple) return Response.json({ accounts: [] });
        const accounts = parseAppleAccounts(await osa(ACCOUNTS_SCRIPT));
        return Response.json({ accounts });
      }

      case "search": {
        const { account, query, deep, days } = body as {
          account?: string;
          query?: string;
          deep?: boolean;
          days?: number;
        };
        if (!query?.trim()) return Response.json({ error: "query is required" }, { status: 400 });
        if (isApple) {
          const out = await osa(SEARCH_SCRIPT, {
            EDA_QUERY: query.trim(),
            EDA_DEEP: deep ? "1" : "0",
            EDA_DAYS: String(days && days > 0 ? days : 7),
          });
          return Response.json({ messages: parseAppleMatches(out) });
        }
        if (!account) return Response.json({ error: "account is required" }, { status: 400 });
        return Response.json({ messages: await graphSearch(account.toLowerCase(), query.trim()) });
      }

      case "generate": {
        const { account, messageIds, contextEmails, intent, recipients, extraContext, tone } = body as {
          account?: string;
          messageIds?: string[];
          contextEmails?: Array<{ subject?: string; from?: string; date?: string; text?: string }>;
          intent?: string;
          recipients?: string;
          extraContext?: string;
          tone?: string;
        };
        if (!intent?.trim()) return Response.json({ error: "intent is required" }, { status: 400 });

        // Context comes inline (applemail) or is fetched by id (graph).
        let contexts: Array<{ subject: string; from: string; date: string; text: string }> = [];
        if (contextEmails?.length) {
          contexts = contextEmails.slice(0, 8).map((c) => ({
            subject: c.subject || "",
            from: c.from || "",
            date: c.date || "",
            text: c.text || "",
          }));
        } else if (!isApple && messageIds?.length && account) {
          const fetched = await Promise.all(
            messageIds.slice(0, 8).map((id) => graphFetchBody(account.toLowerCase(), id).catch(() => null))
          );
          contexts = fetched.filter((c): c is NonNullable<typeof c> => c !== null);
        }

        const result = await generateDraft({
          contexts,
          intent: intent.trim(),
          recipients: recipients || "",
          extraContext: extraContext || "",
          tone: tone || "warm and professional",
        });
        return Response.json(result);
      }

      case "create-draft": {
        const { account, subject, body: emailBody, recipients, sender } = body as {
          account?: string;
          subject?: string;
          body?: string;
          recipients?: string;
          sender?: string;
        };
        if (!emailBody?.trim()) return Response.json({ error: "body is required" }, { status: 400 });

        if (isApple) {
          await osa(DRAFT_SCRIPT, {
            EDA_SUBJECT: subject || "(no subject)",
            EDA_BODY: emailBody,
            EDA_SENDER: sender || "",
            EDA_RECIPS: recipients || "",
          });
          return Response.json({ ok: true, appleMail: true });
        }

        if (!account) return Response.json({ error: "account is required" }, { status: 400 });
        const result = await graphCreateDraft({
          account: account.toLowerCase(),
          subject: subject || "(no subject)",
          body: emailBody,
          recipients: recipients || "",
        });
        return Response.json({ ok: true, ...result });
      }

      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
