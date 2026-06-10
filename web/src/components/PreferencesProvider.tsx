"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Accent presets — each carries a gradient pair (start + end rgb triples) so the
// same choice drives both solid accents (.bg-accent) and the brand gradient
// (.bg-gradient-brand / .text-gradient-brand). "aurora" is the default.
export const ACCENTS = [
  { id: "aurora", label: "Aurora", from: "99 102 241", to: "236 72 153" },
  { id: "grape", label: "Grape", from: "168 85 247", to: "236 72 153" },
  { id: "ocean", label: "Ocean", from: "59 130 246", to: "34 211 238" },
  { id: "forest", label: "Forest", from: "16 185 129", to: "20 184 166" },
  { id: "sunset", label: "Sunset", from: "249 115 22", to: "236 72 153" },
  { id: "coral", label: "Coral", from: "244 63 94", to: "249 115 22" },
  { id: "ice", label: "Ice", from: "34 211 238", to: "99 102 241" },
  { id: "zinc", label: "Mono", from: "24 24 27", to: "82 82 91" },
] as const;

export type AccentColor = (typeof ACCENTS)[number]["id"];
type FontSize = "sm" | "base" | "lg";

interface Preferences {
  accent: AccentColor;
  fontSize: FontSize;
  highContrast: boolean;
}

interface PreferencesContextValue extends Preferences {
  setAccent: (c: AccentColor) => void;
  setFontSize: (s: FontSize) => void;
  setHighContrast: (v: boolean) => void;
}

const defaults: Preferences = { accent: "aurora", fontSize: "base", highContrast: false };

const PreferencesContext = createContext<PreferencesContextValue>({
  ...defaults,
  setAccent: () => {},
  setFontSize: () => {},
  setHighContrast: () => {},
});

export function usePreferences() {
  return useContext(PreferencesContext);
}

// Lookup by id, plus migration for the old 5-name scheme stored in localStorage.
const accentById = Object.fromEntries(ACCENTS.map((a) => [a.id, a])) as Record<string, (typeof ACCENTS)[number]>;
const legacyAccent: Record<string, AccentColor> = {
  blue: "ocean",
  purple: "grape",
  green: "forest",
  orange: "sunset",
  zinc: "zinc",
};

function normalizeAccent(value: unknown): AccentColor {
  if (typeof value === "string") {
    if (value in accentById) return value as AccentColor;
    if (value in legacyAccent) return legacyAccent[value];
  }
  return defaults.accent;
}

const fontSizeClasses: Record<FontSize, string> = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
};

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(defaults);

  useEffect(() => {
    const stored = localStorage.getItem("preferences");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPrefs({ ...defaults, ...parsed, accent: normalizeAccent(parsed.accent) });
      } catch {}
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const accent = accentById[prefs.accent] ?? accentById[defaults.accent];
    // Both stops drive the gradient utilities; --accent-rgb is the primary solid.
    root.style.setProperty("--accent-rgb", accent.from);
    root.style.setProperty("--accent-rgb-2", accent.to);
    root.classList.toggle("high-contrast", prefs.highContrast);
    root.classList.remove("text-sm", "text-base", "text-lg");
    root.classList.add(fontSizeClasses[prefs.fontSize]);
  }, [prefs]);

  const save = useCallback((next: Preferences) => {
    setPrefs(next);
    localStorage.setItem("preferences", JSON.stringify(next));
  }, []);

  return (
    <PreferencesContext.Provider
      value={{
        ...prefs,
        setAccent: (c) => save({ ...prefs, accent: c }),
        setFontSize: (s) => save({ ...prefs, fontSize: s }),
        setHighContrast: (v) => save({ ...prefs, highContrast: v }),
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
