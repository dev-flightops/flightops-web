import { DEFAULT_TIME_ZONE } from "@/lib/format/local-time";

/**
 * Time-of-day greeting matching the legacy home page header:
 *
 *   05:00–11:59 → "Good morning"
 *   12:00–17:59 → "Good afternoon"
 *   18:00–04:59 → "Good evening"
 *
 * By the hour in the company's zone (#157): it had read the server's
 * clock, UTC on Vercel, so the client got "Good afternoon" at 7:30 AM in
 * Alaska. Accepts `now` for tests. No localisation yet — matches the
 * legacy's single English copy.
 */
export type Greeting = "Good morning" | "Good afternoon" | "Good evening";

export function greetingForHour(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function currentGreeting(
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Greeting {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now),
  );
  return greetingForHour(hour);
}

/** Returns the user's first name from a full name string, or empty string. */
export function firstNameFrom(fullName: string | null | undefined): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0] ?? "";
}
