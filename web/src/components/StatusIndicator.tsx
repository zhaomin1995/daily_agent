"use client";

import { useEffect, useState } from "react";

export default function StatusIndicator({ collapsed = false }: { collapsed?: boolean }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    function check() {
      fetch("/api/tools", { method: "HEAD" })
        .then(() => setOnline(true))
        .catch(() => setOnline(false));
    }
    check();
    const interval = setInterval(check, 30000);
    window.addEventListener("online", () => setOnline(true));
    window.addEventListener("offline", () => setOnline(false));
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 ${collapsed ? "justify-center" : "px-3"}`}>
      <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-500" : "bg-red-500"}`} />
      {!collapsed && <span>{online ? "Connected" : "Offline"}</span>}
    </div>
  );
}
