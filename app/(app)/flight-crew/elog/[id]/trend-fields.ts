/**
 * Per-airframe Tab 5 (Trends) field sets — Spec 4 §"7-tab Electronic
 * Flight Log / Tab 5". Lives in its own module so the trends-tab
 * component + tests both consume the same definition.
 *
 * Mirrors legacy `templates/elog/log_page.html` Tab 5:
 *   Turbine (caravan / kingair / pilatus): ITT + Torque + NG + NP at
 *     T/O and Cruise, Cruise Alt, Fuel Flow PPH, Oil Press/Temp °C,
 *     Oil Added, Notes
 *   Piston (c207 / ga8): RPM, Oil Press, Oil Temp °F, CHT, EGT,
 *     Fuel Flow GPH, Oil Added, Notes
 *   Twin piston (navajo): piston set + Manifold Press
 *
 * Unknown airframe types fall back to "unsupported" — the panel
 * renders a hint pointing the admin at the aircraft detail page to
 * set airframe_type.
 */

export type TrendInputKind = "number" | "text";

export interface TrendField {
  /** JSONB key on flight_log_legs.trend_data. */
  key: string;
  label: string;
  kind: TrendInputKind;
  /** Step for number inputs (1 by default; 0.1 for finer readouts). */
  step?: number;
  /** Optional grouping header — adjacent fields with the same group
   *  render under the same sub-heading ("Takeoff", "Cruise", etc.). */
  group?: string;
}

export type AirframeFamily = "turbine" | "piston" | "twin_piston" | "unsupported";

/** Map the raw airframe_type slug from aircraft.airframe_type to a
 *  family bucket. Falls back to "unsupported" so the UI can render a
 *  helpful message instead of a blank form. */
export function classifyAirframe(slug: string | null | undefined): AirframeFamily {
  if (!slug) return "unsupported";
  const normalized = slug.trim().toLowerCase();
  if (normalized === "caravan" || normalized === "kingair" || normalized === "pilatus") {
    return "turbine";
  }
  if (normalized === "navajo") return "twin_piston";
  if (normalized === "c207" || normalized === "ga8" || normalized === "c182") {
    return "piston";
  }
  return "unsupported";
}

const TURBINE: TrendField[] = [
  { key: "itt_takeoff_c", label: "ITT T/O (°C)", kind: "number", group: "Takeoff" },
  { key: "torque_takeoff_ftlb", label: "Torque T/O (ft-lb)", kind: "number", group: "Takeoff" },
  { key: "ng_takeoff_pct", label: "NG T/O (%)", kind: "number", step: 0.1, group: "Takeoff" },
  { key: "np_takeoff_rpm", label: "NP T/O (RPM)", kind: "number", group: "Takeoff" },
  { key: "cruise_alt_ft", label: "Cruise Alt (ft)", kind: "number", group: "Takeoff" },
  { key: "itt_cruise_c", label: "ITT Cruise (°C)", kind: "number", group: "Cruise" },
  { key: "torque_cruise_ftlb", label: "Torque Cruise (ft-lb)", kind: "number", group: "Cruise" },
  { key: "ng_cruise_pct", label: "NG Cruise (%)", kind: "number", step: 0.1, group: "Cruise" },
  { key: "np_cruise_rpm", label: "NP Cruise (RPM)", kind: "number", group: "Cruise" },
  { key: "fuel_flow_pph", label: "Fuel Flow (PPH)", kind: "number", step: 0.1, group: "Cruise" },
  { key: "oil_press_psi", label: "Oil Press (PSI)", kind: "number", group: "Engine" },
  { key: "oil_temp_c", label: "Oil Temp (°C)", kind: "number", group: "Engine" },
  { key: "oil_added_qt", label: "Oil Added (qt)", kind: "number", step: 0.1, group: "Engine" },
  { key: "notes", label: "Anomalies / Notes", kind: "text", group: "Engine" },
];

const PISTON: TrendField[] = [
  { key: "rpm", label: "RPM", kind: "number" },
  { key: "oil_press_psi", label: "Oil Press (PSI)", kind: "number" },
  { key: "oil_temp_f", label: "Oil Temp (°F)", kind: "number" },
  { key: "cht_f", label: "CHT (°F)", kind: "number" },
  { key: "egt_f", label: "EGT (°F)", kind: "number" },
  { key: "fuel_flow_gph", label: "Fuel Flow (GPH)", kind: "number", step: 0.1 },
  { key: "oil_added_qt", label: "Oil Added (qt)", kind: "number", step: 0.1 },
  { key: "notes", label: "Anomalies / Notes", kind: "text" },
];

const TWIN_PISTON: TrendField[] = [
  ...PISTON.filter((f) => f.key !== "notes"),
  { key: "manifold_press", label: "Manifold Press", kind: "number", step: 0.1 },
  { key: "notes", label: "Anomalies / Notes", kind: "text" },
];

/** Field set for the given airframe family. `unsupported` returns
 *  an empty list — the panel renders a hint instead of a form. */
export function fieldsForFamily(family: AirframeFamily): TrendField[] {
  if (family === "turbine") return TURBINE;
  if (family === "piston") return PISTON;
  if (family === "twin_piston") return TWIN_PISTON;
  return [];
}

/** Friendly display name for the airframe family header on the
 *  trend card. Pulled from the legacy template's labels. */
export function familyDisplayName(family: AirframeFamily, slug: string | null): string {
  if (family === "turbine") {
    if (slug === "caravan") return "Cessna 208B Caravan — PT6A";
    if (slug === "kingair") return "King Air 200 — Twin PT6A";
    if (slug === "pilatus") return "Pilatus PC-12 — Single PT6A";
    return "Turbine";
  }
  if (family === "twin_piston") return "PA-31 Navajo — Twin Piston";
  if (family === "piston") return "Piston Engine";
  return "Engine trend monitoring";
}
