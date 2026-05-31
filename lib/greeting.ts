/**
 * Time-of-day greeting matching the legacy home page header:
 *
 *   05:00–11:59 → "Good morning"
 *   12:00–17:59 → "Good afternoon"
 *   18:00–04:59 → "Good evening"
 *
 * Defaults to the server's local time, but accepts a `now` arg for tests.
 * No localisation yet — matches the legacy's single English copy.
 */
export type Greeting = "Good morning" | "Good afternoon" | "Good evening";

export function greetingForHour(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function currentGreeting(now: Date = new Date()): Greeting {
  return greetingForHour(now.getHours());
}

/** Returns the user's first name from a full name string, or empty string. */
export function firstNameFrom(fullName: string | null | undefined): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0] ?? "";
}
