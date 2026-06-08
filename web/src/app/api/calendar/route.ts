import fs from "fs";
import path from "path";
import { TOKEN_DIR } from "@/lib/paths";

export const dynamic = "force-dynamic";

export interface CalendarEvent {
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isCancelled: boolean;
  showAs: string;
  isAllDay: boolean;
}

async function fetchAccountEvents(
  account: string,
  startDate: string,
  endDate: string
): Promise<{ account: string; events: CalendarEvent[]; error: string | null }> {
  const tokenFile = path.join(TOKEN_DIR, `msgraph-token-${account}.txt`);
  if (!fs.existsSync(tokenFile) || fs.statSync(tokenFile).size === 0) {
    return { account, events: [], error: "No token configured" };
  }

  const token = fs.readFileSync(tokenFile, "utf-8").trim();
  const start = `${startDate}T00:00:00`;
  const end = `${endDate}T23:59:59`;
  const url =
    `https://graph.microsoft.com/v1.0/me/calendarView` +
    `?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}` +
    `&$select=subject,start,end,isCancelled,showAs,isAllDay` +
    `&$orderby=start/dateTime&$top=200`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: `outlook.timezone="America/Los_Angeles"`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as { error?: { message?: string } }).error?.message || `HTTP ${res.status}`;
      return { account, events: [], error: msg };
    }

    const data = (await res.json()) as { value: CalendarEvent[] };
    return { account, events: data.value || [], error: null };
  } catch (err) {
    return { account, events: [], error: String(err) };
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    accounts: string[];
    startDate: string;
    endDate: string;
  };

  const { accounts, startDate, endDate } = body;
  if (!accounts?.length || !startDate || !endDate) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const results = await Promise.all(
    accounts.map((acc) => fetchAccountEvents(acc.toLowerCase(), startDate, endDate))
  );

  return Response.json({ results });
}
