"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, type ThemeMode } from "@/lib/theme/theme-mode";

const ThemeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>({
  mode: "dark",
  setMode: () => {},
});

/**
 * Holds the page theme (#78). The root layout reads the cookie and passes
 * it in, so the server and the first client render agree; a change flips
 * `data-theme` on <html> (the tokens in globals.css follow) and stores the
 * choice for the next page load.
 */
export function ThemeProvider({ initial, children }: { initial: ThemeMode; children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(initial);
  const setMode = useCallback((next: ThemeMode) => {
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
    setModeState(next);
  }, []);
  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
