/**
 * The page theme (#78): dark by default, as ForeFlight's app is; light when
 * the user picks it. Kept in a cookie rather than localStorage so the server
 * renders the right theme into the first byte — no flash of the wrong one.
 */
export type ThemeMode = "dark" | "light";

export const THEME_COOKIE = "fo-theme";

/** A year: the choice is a preference, not a session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Anything but an explicit "light" is the default dark theme. */
export function themeFromCookie(value: string | null | undefined): ThemeMode {
  return value === "light" ? "light" : "dark";
}
