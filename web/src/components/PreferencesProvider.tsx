"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type AccentColor = "zinc" | "blue" | "purple" | "green" | "orange";
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

const defaults: Preferences = { accent: "zinc", fontSize: "base", highContrast: false };

const PreferencesContext = createContext<PreferencesContextValue>({
  ...defaults,
  setAccent: () => {},
  setFontSize: () => {},
  setHighContrast: () => {},
});

export function usePreferences() {
  return useContext(PreferencesContext);
}

const accentVars: Record<AccentColor, string> = {
  zinc: "24 24 27",
  blue: "59 130 246",
  purple: "139 92 246",
  green: "34 197 94",
  orange: "249 115 22",
};

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
      try { setPrefs({ ...defaults, ...JSON.parse(stored) }); } catch {}
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-rgb", accentVars[prefs.accent]);
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
