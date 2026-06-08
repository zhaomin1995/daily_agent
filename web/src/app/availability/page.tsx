"use client";

import { useState } from "react";

interface CalendarEvent {
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isCancelled: boolean;
  showAs: string;
  isAllDay: boolean;
}

interface AccountResult {
  account: string;
  events: CalendarEvent[];
  error: string | null;
}

// "2026-06-03T09:30:00" → 570
function dtToMins(dt: string): number {
  const t = (dt.split("T")[1] || "00:00:00").split(":");
  return parseInt(t[0]) * 60 + parseInt(t[1]);
}

// 570 → "9:30 AM"
function minsToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${min.toString().padStart(2, "0")} ${ampm}`;
}

// "09:00" → 540
function hhmToMins(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cur = start;
  while (cur <= end) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// Compute free time slots in a day, given busy events and working hours
function computeFreeSlots(
  dateStr: string,
  allEvents: CalendarEvent[],
  workStart: number,
  workEnd: number,
  minDuration: number
): Array<{ start: number; end: number }> {
  const busy: Array<{ start: number; end: number }> = [];

  for (const ev of allEvents) {
    if (ev.isCancelled || ev.showAs === "free" || ev.showAs === "workingElsewhere") continue;
    if (ev.isAllDay && ev.start.dateTime.startsWith(dateStr)) return []; // fully blocked
    if (!ev.start.dateTime.startsWith(dateStr)) continue;
    const s = dtToMins(ev.start.dateTime);
    const e = dtToMins(ev.end.dateTime);
    if (e > s) busy.push({ start: Math.max(s, workStart), end: Math.min(e, workEnd) });
  }

  // Sort and merge
  busy.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const b of busy) {
    if (b.start >= b.end) continue;
    if (merged.length && b.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, b.end);
    } else {
      merged.push({ ...b });
    }
  }

  // Subtract from working hours window
  const free: Array<{ start: number; end: number }> = [];
  let cursor = workStart;
  for (const b of merged) {
    if (b.start > cursor) free.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < workEnd) free.push({ start: cursor, end: workEnd });

  return free.filter((s) => s.end - s.start >= minDuration);
}

const ACCOUNTS = [
  { id: "ucsd", label: "UCSD" },
  { id: "pitt", label: "Pitt" },
];

const PRESETS = [
  { label: "This week", value: "thisweek" },
  { label: "Next week", value: "nextweek" },
  { label: "Next 7 days", value: "7days" },
  { label: "Next 14 days", value: "14days" },
];

const SLOT_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hours", value: 90 },
];

export default function AvailabilityPage() {
  const today = todayStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 6));
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(["ucsd", "pitt"]);
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("17:00");
  const [minSlot, setMinSlot] = useState(30);
  const [excludeWeekends, setExcludeWeekends] = useState(true);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AccountResult[] | null>(null);
  const [showEvents, setShowEvents] = useState(false);

  const [availability, setAvailability] = useState("");
  const [copied, setCopied] = useState(false);

  function applyPreset(preset: string) {
    const d = new Date();
    const day = d.getDay(); // 0=Sun, 1=Mon...
    if (preset === "thisweek") {
      const diff = day === 0 ? -6 : 1 - day;
      const mon = addDays(today, diff);
      setStartDate(mon);
      setEndDate(addDays(mon, 4));
    } else if (preset === "nextweek") {
      const diff = day === 0 ? 1 : 8 - day;
      const mon = addDays(today, diff);
      setStartDate(mon);
      setEndDate(addDays(mon, 4));
    } else if (preset === "7days") {
      setStartDate(today);
      setEndDate(addDays(today, 6));
    } else if (preset === "14days") {
      setStartDate(today);
      setEndDate(addDays(today, 13));
    }
    setResults(null);
    setAvailability("");
  }

  function toggleAccount(id: string) {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  async function fetchCalendar() {
    if (!selectedAccounts.length) return;
    setLoading(true);
    setResults(null);
    setAvailability("");
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: selectedAccounts, startDate, endDate }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setLoading(false);
    }
  }

  function generateAvailability() {
    if (!results) return;
    const allEvents = results.flatMap((r) => r.events);
    const ws = hhmToMins(workStart);
    const we = hhmToMins(workEnd);
    const dates = getDatesInRange(startDate, endDate);
    const lines: string[] = [];

    for (const dateStr of dates) {
      const d = new Date(dateStr + "T12:00:00");
      const dow = d.getDay();
      if (excludeWeekends && (dow === 0 || dow === 6)) continue;
      const slots = computeFreeSlots(dateStr, allEvents, ws, we, minSlot);
      if (slots.length > 0) {
        const label = formatDateLabel(dateStr);
        const slotStr = slots.map((s) => `${minsToTime(s.start)}–${minsToTime(s.end)}`).join(", ");
        lines.push(`• ${label}: ${slotStr}`);
      }
    }

    if (!lines.length) {
      setAvailability("No availability found in the selected range. Try expanding the date range or adjusting working hours.");
      return;
    }

    setAvailability(
      `I'm available at the following times (Pacific Time):\n\n${lines.join("\n")}\n\nPlease let me know what works best for you.`
    );
  }

  function copyAvailability() {
    navigator.clipboard.writeText(availability);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadTxt() {
    const blob = new Blob([availability], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `availability-${startDate}-to-${endDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Events grouped by date for the event list view
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  if (results) {
    const allEvents = results.flatMap((r) => r.events);
    for (const ev of allEvents) {
      if (ev.isCancelled) continue;
      const dateKey = ev.start.dateTime.split("T")[0];
      if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
      eventsByDate[dateKey].push(ev);
    }
  }

  const errors = (results || []).filter((r) => r.error).map((r) => `${r.account.toUpperCase()}: ${r.error}`);
  const totalEvents = (results || []).reduce((sum, r) => sum + r.events.length, 0);

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Availability</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Pull your Outlook calendar and generate ready-to-paste availability for scheduling.
        </p>
      </div>

      {/* Controls card */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-4 space-y-4">
        {/* Date range */}
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Date range</p>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => applyPreset(p.value)}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setResults(null); setAvailability(""); }}
              className="px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400"
            />
            <span className="text-zinc-400 text-sm">to</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => { setEndDate(e.target.value); setResults(null); setAvailability(""); }}
              className="px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400"
            />
          </div>
        </div>

        {/* Working hours + options row */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Working hours</p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400"
              />
              <span className="text-zinc-400 text-sm">–</span>
              <input
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ring-zinc-400"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Min slot</p>
            <div className="flex gap-1.5">
              {SLOT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMinSlot(opt.value)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    minSlot === opt.value
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Calendars</p>
            <div className="flex gap-2">
              {ACCOUNTS.map((acc) => (
                <label key={acc.id} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(acc.id)}
                    onChange={() => toggleAccount(acc.id)}
                    className="rounded"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{acc.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Options</p>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeWeekends}
                onChange={(e) => setExcludeWeekends(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Exclude weekends</span>
            </label>
          </div>
        </div>

        {/* Fetch button */}
        <button
          onClick={fetchCalendar}
          disabled={loading || !selectedAccounts.length}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {loading && (
            <svg className="animate-spin shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          )}
          {loading ? "Fetching calendar…" : "Fetch Calendar"}
        </button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mb-4 p-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
          {errors.map((e, i) => (
            <p key={i} className="text-sm text-red-600 dark:text-red-400">{e}</p>
          ))}
          <p className="text-xs text-red-500 mt-1">Update tokens in <a href="/config" className="underline">Config</a>.</p>
        </div>
      )}

      {/* Event list (collapsible) */}
      {results && totalEvents > 0 && (
        <div className="mb-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowEvents((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
          >
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {totalEvents} event{totalEvents !== 1 ? "s" : ""} found
            </span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`text-zinc-400 transition-transform ${showEvents ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showEvents && (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
              {getDatesInRange(startDate, endDate).map((dateStr) => {
                const evs = eventsByDate[dateStr];
                if (!evs?.length) return null;
                return (
                  <div key={dateStr} className="px-4 py-2">
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      {formatDateLabel(dateStr)}
                    </p>
                    <div className="space-y-0.5">
                      {evs.map((ev, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            ev.showAs === "busy" || ev.showAs === "oof" ? "bg-red-400" :
                            ev.showAs === "tentative" ? "bg-yellow-400" : "bg-zinc-300"
                          }`} />
                          <span className="text-zinc-500 text-xs shrink-0 w-28">
                            {ev.isAllDay ? "All day" : `${minsToTime(dtToMins(ev.start.dateTime))}–${minsToTime(dtToMins(ev.end.dateTime))}`}
                          </span>
                          <span className="text-zinc-700 dark:text-zinc-300 truncate">{ev.subject || "(No title)"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {results && totalEvents === 0 && errors.length === 0 && (
        <p className="text-sm text-zinc-400 mb-4">No events found in this date range.</p>
      )}

      {/* Generate button */}
      {results && (
        <div className="mb-4">
          <button
            onClick={generateAvailability}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>
            </svg>
            Generate Availability Text
          </button>
        </div>
      )}

      {/* Output */}
      {availability && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ready to copy</span>
            <div className="flex gap-1.5">
              <button
                onClick={copyAvailability}
                className="text-xs px-2.5 py-1 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 transition-opacity"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={downloadTxt}
                className="text-xs px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                .txt
              </button>
            </div>
          </div>
          <textarea
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            rows={10}
            className="w-full px-4 py-3 text-sm bg-white dark:bg-zinc-950 focus:outline-none resize-none leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}
