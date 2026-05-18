import fs from "fs";
import path from "path";
import { TOKEN_DIR, BRIEFING_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

interface AccountStatus {
  name: string;
  tokenFile: string;
  hasToken: boolean;
}

function checkAccount(name: string, filename: string): AccountStatus {
  const tokenFile = path.join(TOKEN_DIR, filename);
  const exists = fs.existsSync(tokenFile);
  const hasToken = exists && fs.statSync(tokenFile).size > 0;
  return { name, tokenFile: filename, hasToken };
}

export async function GET() {
  const accounts = [
    checkAccount("UCSD", "msgraph-token-ucsd.txt"),
    checkAccount("Pitt", "msgraph-token-pitt.txt"),
  ];

  const briefingDirExists = fs.existsSync(BRIEFING_DIR);
  const briefingCount = briefingDirExists
    ? fs.readdirSync(BRIEFING_DIR).filter((f) => f.endsWith(".md")).length
    : 0;

  return Response.json({ accounts, briefingDirExists, briefingCount });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { account, token } = body;

  if (!account || !token) {
    return Response.json(
      { error: "account and token are required" },
      { status: 400 }
    );
  }

  const validAccounts: Record<string, string> = {
    ucsd: "msgraph-token-ucsd.txt",
    pitt: "msgraph-token-pitt.txt",
  };

  const filename = validAccounts[account.toLowerCase()];
  if (!filename) {
    return Response.json({ error: "Invalid account name" }, { status: 400 });
  }

  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
  }

  fs.writeFileSync(path.join(TOKEN_DIR, filename), token.trim());
  return Response.json({ success: true });
}
