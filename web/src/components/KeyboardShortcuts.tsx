"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const shortcuts = [
  { keys: ["1"], desc: "Go to Dashboard" },
  { keys: ["2"], desc: "Go to Logs" },
  { keys: ["3"], desc: "Go to Config" },
  { keys: ["?"], desc: "Show shortcuts" },
];

export default function KeyboardShortcuts() {
  const [showOverlay, setShowOverlay] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "1": router.push("/"); break;
        case "2": router.push("/logs"); break;
        case "3": router.push("/config"); break;
        case "?": setShowOverlay((v) => !v); break;
        case "Escape": setShowOverlay(false); break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [router]);

  if (!showOverlay) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setShowOverlay(false)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-4">Keyboard Shortcuts</h3>
        <ul className="space-y-2">
          {shortcuts.map((s) => (
            <li key={s.desc} className="flex items-center justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">{s.desc}</span>
              <div className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="px-2 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-800 rounded font-mono">{k}</kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
