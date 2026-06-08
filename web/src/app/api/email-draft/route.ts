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
 * One POST endpoint with three actions:
 *   - "search"       : find received emails matching a query (for context)
 *   - "generate"     : draft a new email from an intent + selected context emails
 *   - "create-draft" : save the result as an Outlook draft (never sends)
 *
 * Auth reuses the same Microsoft Graph tokens as the rest of the app:
 * ~/.claude/msgraph-token-{account}.txt (account = ucsd | pitt).
 * ------------------------------------------------------------------ */

// A trimmed-down email record returned to the client for the context picker.
interface EmailMatch {
  id: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  receivedDateTime: string;
  bodyPreview: string;
}

// Read a Graph token for an account, or null if not configured.
function readToken(account: string): string | null {
  const tokenFile = path.join(TOKEN_DIR, `msgraph-token-${account}.txt`);
  if (!fs.existsSync(tokenFile) || fs.statSync(tokenFile).size === 0) return null;
  return fs.readFileSync(tokenFile, "utf-8").trim();
}

// Strip HTML to readable plain text for use as model context.
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

// Search the user's mailbox for messages matching a free-text query.
async function searchMessages(account: string, query: string): Promise<EmailMatch[]> {
  const token = readToken(account);
  if (!token) throw new Error(`No token configured for ${account}`);

  // Graph $search ranks by relevance; it cannot be combined with $orderby.
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

// Fetch the full plain-text body of a single message by id.
async function fetchMessageBody(
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

// Draft a new email with Claude, grounded in the selected context emails.
async function generateDraft(params: {
  account: string;
  messageIds: string[];
  intent: string;
  recipients: string;
  extraContext: string;
  tone: string;
}): Promise<{ subject: string; body: string }> {
  const { account, messageIds, intent, recipients, extraContext, tone } = params;

  // Pull each selected email's full text and assemble a context block.
  const contexts = await Promise.all(
    messageIds.slice(0, 8).map((id) => fetchMessageBody(account, id).catch(() => null))
  );
  const contextBlock = contexts
    .filter((c): c is NonNullable<typeof c> => c !== null)
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

  // Parse the JSON the model returns; fall back to using raw output as the body.
  const out = stdout.trim();
  const match = out.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { subject?: string; body?: string };
      if (parsed.body) {
        return { subject: parsed.subject || "(no subject)", body: parsed.body };
      }
    } catch {
      /* fall through to raw fallback */
    }
  }
  return { subject: "Draft email", body: out };
}

// Create an Outlook draft (saved to Drafts, never sent).
async function createDraft(params: {
  account: string;
  subject: string;
  body: string;
  recipients: string;
}): Promise<{ id: string; webLink: string }> {
  const { account, subject, body, recipients } = params;
  const token = readToken(account);
  if (!token) throw new Error(`No token configured for ${account}`);

  // Split a comma/semicolon-separated recipient string into Graph recipients.
  const toRecipients = recipients
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));

  const res = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject,
      body: { contentType: "Text", content: body },
      toRecipients,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { id: string; webLink: string };
  return { id: data.id, webLink: data.webLink };
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action } = body as { action?: string };

  try {
    switch (action) {
      case "search": {
        const { account, query } = body as { account?: string; query?: string };
        if (!account || !query?.trim()) {
          return Response.json({ error: "account and query are required" }, { status: 400 });
        }
        const messages = await searchMessages(account.toLowerCase(), query.trim());
        return Response.json({ messages });
      }
      case "generate": {
        const { account, messageIds, intent, recipients, extraContext, tone } = body as {
          account?: string;
          messageIds?: string[];
          intent?: string;
          recipients?: string;
          extraContext?: string;
          tone?: string;
        };
        if (!account || !intent?.trim()) {
          return Response.json({ error: "account and intent are required" }, { status: 400 });
        }
        const result = await generateDraft({
          account: account.toLowerCase(),
          messageIds: messageIds || [],
          intent: intent.trim(),
          recipients: recipients || "",
          extraContext: extraContext || "",
          tone: tone || "warm and professional",
        });
        return Response.json(result);
      }
      case "create-draft": {
        const { account, subject, body: emailBody, recipients } = body as {
          account?: string;
          subject?: string;
          body?: string;
          recipients?: string;
        };
        if (!account || !emailBody?.trim()) {
          return Response.json({ error: "account and body are required" }, { status: 400 });
        }
        const result = await createDraft({
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
