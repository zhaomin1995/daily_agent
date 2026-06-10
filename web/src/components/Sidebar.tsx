"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import DarkModeToggle from "./DarkModeToggle";
import StatusIndicator from "./StatusIndicator";
import { usePreferences, ACCENTS } from "./PreferencesProvider";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavGroup {
  label?: string; // undefined = no section header
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: "grid" },
    ],
  },
  {
    label: "Daily",
    items: [
      { href: "/action-items", label: "Today", icon: "check-square" },
      { href: "/logs", label: "Logs", icon: "file-text" },
      { href: "/availability", label: "Availability", icon: "calendar" },
      { href: "/email-draft", label: "Email Draft", icon: "mail" },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/submissions", label: "Submissions", icon: "book-open" },
      { href: "/references", label: "References", icon: "list" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/config", label: "Config", icon: "settings" },
    ],
  },
];

// Flat list for mobile tab bar (top-level items only)
const mobileNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/action-items", label: "Today", icon: "check-square" },
  { href: "/logs", label: "Logs", icon: "file-text" },
  { href: "/availability", label: "Availability", icon: "calendar" },
  { href: "/submissions", label: "Submissions", icon: "book-open" },
  { href: "/config", label: "Config", icon: "settings" },
];

const icons: Record<string, React.ReactNode> = {
  grid: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  "file-text": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  "book-open": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  "list": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  mail: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  "check-square": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
};

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
    >
      <polyline points="11 17 6 12 11 7" />
      <polyline points="18 17 13 12 18 7" />
    </svg>
  );
}

function getPageTitle(pathname: string): string {
  for (const group of navGroups) {
    const match = group.items.find((item) => item.href === pathname);
    if (match) return match.label;
  }
  return "Daily Agent";
}

export default function Sidebar() {
  const pathname = usePathname();
  const { accent, setAccent } = usePreferences();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  function NavLink({ item }: { item: NavItem }) {
    const active = pathname === item.href;
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={`flex items-center gap-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          collapsed ? "justify-center px-2" : "px-2.5"
        } ${
          active
            ? "bg-gradient-brand text-white shadow-brand"
            : "text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
        }`}
      >
        {icons[item.icon]}
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 flex-col transition-all duration-200 ${
          collapsed ? "w-14" : "w-52"
        }`}
      >
        {/* Header */}
        <div className={`border-b border-zinc-200 dark:border-zinc-800 flex items-center ${collapsed ? "px-3 py-4 justify-center" : "px-4 py-5 justify-between"}`}>
          {!collapsed && (
            <div>
              <h1 className="text-base font-semibold tracking-tight leading-tight">Daily Agent</h1>
              <p className="text-[11px] text-zinc-400 mt-0.5">Automation Dashboard</p>
            </div>
          )}
          <button
            onClick={toggleCollapse}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>

        {/* Grouped navigation */}
        <nav className={`flex-1 py-3 space-y-4 overflow-y-auto ${collapsed ? "px-1.5" : "px-3"}`}>
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {/* Section label — hidden when collapsed */}
              {group.label && !collapsed && (
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 px-2.5">
                  {group.label}
                </p>
              )}
              {/* Divider between groups when collapsed */}
              {group.label && collapsed && gi > 0 && (
                <div className="border-t border-zinc-200 dark:border-zinc-800 mb-2" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Theme swatches — quick accent switch (full picker lives in Config) */}
        {!collapsed && (
          <div className="px-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 px-2.5">Theme</p>
            <div className="flex flex-wrap gap-1.5 px-2.5">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  title={a.label}
                  aria-label={`Accent ${a.label}`}
                  aria-pressed={accent === a.id}
                  className={`w-4 h-4 rounded-full transition-transform hover:scale-125 ${
                    accent === a.id ? "ring-2 ring-offset-1 ring-accent ring-offset-zinc-50 dark:ring-offset-zinc-950 scale-110" : ""
                  }`}
                  style={{ backgroundImage: `linear-gradient(135deg, rgb(${a.from}), rgb(${a.to}))` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        {!collapsed && (
          <div className="px-3 pb-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 px-2.5">Quick Links</p>
            <a href="ticktick://" title="TickTick" className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/60 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              TickTick
            </a>
            <a href="ms-outlook://" title="Outlook" className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/60 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="2 9 12 15 22 9" /></svg>
              Outlook
            </a>
          </div>
        )}
        {collapsed && (
          <div className="px-1.5 pb-2 border-t border-zinc-200 dark:border-zinc-800 pt-2 space-y-0.5">
            <a href="ticktick://" title="TickTick" className="flex justify-center px-2 py-1.5 rounded-lg text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/60 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </a>
            <a href="ms-outlook://" title="Outlook" className="flex justify-center px-2 py-1.5 rounded-lg text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/60 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="2 9 12 15 22 9" /></svg>
            </a>
          </div>
        )}

        {/* Footer: status + dark mode */}
        <div className={`py-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5 ${collapsed ? "px-1.5" : "px-3"}`}>
          <StatusIndicator collapsed={collapsed} />
          <DarkModeToggle collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 safe-area-bottom">
        <div className="flex justify-around items-center h-14">
          {mobileNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  active ? "text-accent" : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {icons[item.icon]}
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export { getPageTitle };
