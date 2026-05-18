import fs from "fs";
import path from "path";
import { BRIEFING_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

/* Returns email detail extracted from the most recent briefing.
   The id parameter is a base64-encoded "account:subject" identifier. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Decode the email identifier
  let decoded: string;
  try {
    decoded = Buffer.from(id, "base64url").toString("utf-8");
  } catch {
    return Response.json({ error: "Invalid email ID" }, { status: 400 });
  }

  // For now, return a placeholder since actual email data requires
  // a live Graph API fetch. This structure supports the detail view UI.
  return Response.json({
    id,
    from: "unknown@example.com",
    fromName: "Unknown Sender",
    subject: decoded || "Email",
    receivedAt: new Date().toISOString(),
    account: "unknown",
    priority: "fyi",
    isPromotional: false,
    isWithinOrg: false,
    bodySummary: "Email detail requires a live connection to Microsoft Graph API. Configure your tokens in the Config page to enable email fetching.",
    draftReply: null,
  });
}
