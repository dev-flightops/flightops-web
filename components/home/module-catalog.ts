/**
 * Module catalogue for the home grid — one entry per legacy `mod-card`
 * from `dispatch-platform-main/templates/home.html`.
 *
 * Each entry preserves the legacy's:
 *   - label + sub-label copy (verbatim)
 *   - icon as a raw SVG `path` string (verbatim from the legacy template)
 *   - colour family (icon fill + background tint at 8% / 12% opacity)
 *   - intended href once the module is live
 *
 * `status` controls whether the card is interactive:
 *   live  → renders as a Link to `href`
 *   m2|m3|m4 → renders as a non-interactive panel with a "Coming in Mx"
 *              tooltip (matches the user's request to disable not-yet-shipped
 *              modules instead of hiding them)
 *
 * `highlight` is the legacy's "special" treatment used on Flight Crew and
 * Fleet Brain (blue-tinted border + background). Optional.
 */

export type ModuleStatus = "live" | "m2" | "m3" | "m4";

export interface HomeModule {
  id: string;
  label: string;
  sub: string;
  href: string;
  status: ModuleStatus;
  color: string;       // hex for icon fill
  /** Optional accent treatment — blue glow on the card */
  highlight?: boolean;
  /** Raw `<path d="...">` payload for the icon SVG */
  iconPath: string;
}

// All icon paths copied verbatim from templates/home.html in
// dispatch-platform-main so the SVGs render pixel-identically.
export const HOME_MODULES: HomeModule[] = [
  {
    id: "flight-crew",
    label: "Flight Crew",
    sub: "Schedule, duty, weather, aircraft",
    href: "/crew/my-dashboard",
    status: "m3",
    color: "#0a84ff",
    highlight: true,
    iconPath:
      "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z",
  },
  {
    id: "reservations",
    label: "Reservations",
    sub: "Fleet Board, bookings, customers, billing",
    href: "/reservations/",
    status: "m2",
    color: "#34d399",
    iconPath:
      "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z",
  },
  {
    id: "dispatch",
    label: "Dispatch",
    sub: "Release, weather, crew, following",
    href: "/dispatch",
    status: "live",
    color: "#0a84ff",
    iconPath:
      "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h8v2H8v-2zm0 4h8v2H8v-2zm0-8h4v2H8V9z",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    sub: "Aircraft, squawks, MEL",
    href: "/maintenance",
    // Gated for the M1 demo deploy — Dispatch + Admin are the only
    // live cards on /home for that audience. Flip back to "live" when
    // the deploy promotes past M1.
    status: "m2",
    color: "#f87171",
    iconPath:
      "M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z",
  },
  {
    id: "ground-ops",
    label: "Ground Operations",
    sub: "Ramp, stations, GSE, fuel",
    href: "/ground-ops/",
    // Gated for the M1 demo deploy. See note on `maintenance`.
    status: "m2",
    color: "#fbbf24",
    iconPath:
      "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  },
  {
    id: "hr",
    label: "HR",
    sub: "Employees & payroll",
    href: "/employees/",
    status: "m3",
    color: "#a78bfa",
    iconPath:
      "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  },
  {
    id: "academy",
    label: "Academy",
    sub: "Training & courses",
    href: "/academy/",
    status: "m3",
    color: "#daa520",
    iconPath:
      "M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z",
  },
  {
    id: "compliance",
    label: "Records and Compliance",
    sub: "FAR, safety, regulatory checks",
    href: "/compliance/",
    status: "m3",
    color: "#34d399",
    iconPath:
      "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z",
  },
  {
    id: "safety",
    label: "Safety",
    sub: "Reports, hazards, incidents, SMS",
    href: "/safety/",
    status: "m3",
    color: "#60a5fa",
    iconPath:
      "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z",
  },
  {
    id: "admin",
    label: "Admin",
    sub: "Dashboards, analytics, users",
    href: "/dashboards",
    status: "live",
    color: "#fbbf24",
    iconPath:
      "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z",
  },
  {
    id: "documents",
    label: "Documents",
    sub: "GOM, bulletins, FAR/AIM",
    href: "/documents/",
    status: "m2",
    color: "#7e8ea0",
    iconPath:
      "M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z",
  },
  {
    id: "flight-following",
    label: "Flight Following",
    sub: "Live ops board, tracking, history",
    href: "/flight-following",
    // Gated for the M1 demo deploy. See note on `maintenance`.
    status: "m2",
    color: "#34d399",
    iconPath:
      "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  },
  {
    id: "housing",
    label: "Housing",
    sub: "Crew housing, rooms, assignments",
    href: "/housing/",
    status: "m3",
    color: "#a78bfa",
    iconPath: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  },
  {
    id: "invoicing",
    label: "Invoicing",
    sub: "Flight invoices, billing, AR",
    href: "/invoicing/",
    status: "m4",
    color: "#34d399",
    iconPath:
      "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h8v2H8v-2zm0 4h8v2H8v-2z",
  },
  {
    id: "fleetbrain",
    label: "Fleet Brain",
    sub: "AI ops assistant — ask anything",
    href: "/fleetbrain/",
    status: "m4",
    color: "#0a84ff",
    highlight: true,
    iconPath:
      "M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18 2.5 2.5 0 0 0 10 15.5 2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z",
  },
];

export function moduleStatusHint(status: ModuleStatus): string | null {
  if (status === "live") return null;
  return `Coming in ${status.toUpperCase()}`;
}
