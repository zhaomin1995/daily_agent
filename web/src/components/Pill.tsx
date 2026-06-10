import type { ReactNode } from "react";

// Unified pill/badge: soft fill + matching ring, one tone per semantic color.
// Used across the app for category, source, priority, and status badges so they
// all share the same shape and weight.
export type PillTone =
  | "indigo"
  | "violet"
  | "fuchsia"
  | "sky"
  | "blue"
  | "emerald"
  | "amber"
  | "red"
  | "slate"
  | "zinc";

const TONES: Record<PillTone, string> = {
  indigo: "bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800/50",
  violet: "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-800/50",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:ring-fuchsia-800/50",
  sky: "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-800/50",
  blue: "bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800/50",
  emerald: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800/50",
  amber: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/50",
  red: "bg-red-100 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800/50",
  slate: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  zinc: "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700",
};

export default function Pill({
  tone = "zinc",
  className = "",
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
