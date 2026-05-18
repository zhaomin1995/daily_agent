"use client";

import { usePathname } from "next/navigation";
import DarkModeToggle from "./DarkModeToggle";
import { getPageTitle } from "./Sidebar";

/* Sticky top bar on mobile showing the current page name and a dark mode toggle */
export default function MobileHeader() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="md:hidden sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 px-4 py-5 flex items-center justify-between safe-area-top">
      <div>
        <h1 className="text-base font-semibold tracking-tight leading-none">{title}</h1>
        <p className="text-[10px] text-zinc-400 mt-1">Daily Agent</p>
      </div>
      <DarkModeToggle />
    </header>
  );
}
