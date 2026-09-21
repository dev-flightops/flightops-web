/**
 * Every service behind the API gateway.
 *
 * Each answers `/<service>/health` with `{status:"ok", service:"<name>"}`;
 * the gateway itself answers `/health`.
 *
 * WHY THIS IS ITS OWN MODULE
 *
 * It lived inside the System Health page, which imports `@/lib/api/*`
 * and therefore reaches `apiFetch` and `await auth()` — so nothing
 * could import the list to check it. A list nobody can check is how
 * this one came to name six services while the platform ran sixteen.
 *
 * WHAT WENT WRONG WITH THE OLD LIST
 *
 * It named auth, ops, maintenance, flight-following, weather and
 * ground, with a comment saying it mirrored the gateway. It had
 * stopped mirroring anything. System Health reported the platform
 * healthy without ever probing documents, billing, reports, safety,
 * housing, academy, ai, admin, public or reservations — a green light
 * that had not looked at two thirds of what it claimed to cover.
 *
 * Kept in the order the gateway declares them so the two can be read
 * side by side. `platform-services.test.ts` pins the membership, and
 * the source of truth is `flightops-services/infra/nginx/dev.conf`.
 */
export const PLATFORM_SERVICES = [
  "academy",
  "admin",
  "ai",
  "auth",
  "billing",
  "documents",
  "flight-following",
  "ground",
  "housing",
  "maintenance",
  "ops",
  "public",
  "reports",
  "reservations",
  "safety",
  "weather",
] as const;

export type PlatformService = (typeof PLATFORM_SERVICES)[number];

/** The gateway path a service's health check answers on. */
export function healthPath(service: PlatformService | string): string {
  return `/${service}/health`;
}
