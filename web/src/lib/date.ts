// Local calendar date as YYYY-MM-DD.
//
// Do NOT use `new Date().toISOString().split("T")[0]` for "today": toISOString()
// converts to UTC, so for timezones behind UTC (e.g. US Pacific) the date rolls
// over in the evening and you get tomorrow's date. The morning briefs are named
// by *local* date (e.g. 2026-06-09-email.md), so matching must be done in local
// time. This formats from the local Y/M/D components and is locale-independent.
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
