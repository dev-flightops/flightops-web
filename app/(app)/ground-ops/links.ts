/**
 * The Ground Ops hub's sub-links — the static half. The page adds the
 * live counts (badges, the station and GSE totals) when it renders.
 *
 * In its own module so components/home/module-status.test.ts can sweep
 * it. This hub dimmed its own shipped pages twice — Add Station, then
 * Add Equipment, both left marked `m2` over a working form — and a
 * catalogue declared inside a page file is out of the guard's reach:
 * Next.js lets a page module export only its route config.
 */

export type GroundOpsLinkStatus = "live" | "m2" | "m3" | "m4";

export interface GroundOpsLink {
  label: string;
  sublabel?: string;
  href: string;
  status: GroundOpsLinkStatus;
}

export const GROUND_OPS_LINKS = {
  rampDashboard: {
    label: "Ramp Dashboard",
    sublabel: "Flight board, turnaround timers",
    href: "/ramper",
    status: "live",
  },
  rampFuelOrders: {
    label: "Fuel Orders",
    sublabel: "Confirm and complete fuel deliveries",
    href: "/fuel/orders",
    status: "live",
  },
  rampMessages: {
    label: "Ramp Messages",
    sublabel: "Base-level communication channel",
    href: "/ramper/messages",
    status: "m3",
  },
  allStations: {
    label: "All Stations",
    href: "/stations",
    status: "live",
  },
  stationIssues: {
    label: "Station Issues",
    sublabel: "Runway, facility, and ops issues",
    href: "/stations",
    status: "live",
  },
  addStation: {
    label: "Add Station",
    sublabel: "Register a new ICAO station",
    href: "/stations/new",
    status: "live",
  },
  equipmentDashboard: {
    label: "Equipment Dashboard",
    href: "/equipment",
    status: "live",
  },
  addEquipment: {
    label: "Add Equipment",
    sublabel: "Register new GSE unit",
    href: "/equipment/new",
    status: "live",
  },
  orderFuel: {
    label: "Order Fuel",
    sublabel: "New fuel order by aircraft and base",
    href: "/fuel/orders/new",
    status: "live",
  },
  fuelOrders: {
    label: "Fuel Orders",
    sublabel: "All orders, status, and history",
    href: "/fuel/orders",
    status: "live",
  },
  suppliers: {
    label: "Suppliers & Pricing",
    sublabel: "Manage fuel suppliers and base pricing",
    href: "/fuel/suppliers",
    status: "live",
  },
  fuelQuality: {
    label: "Fuel Quality Log",
    sublabel: "Quality testing records and compliance",
    href: "/fuel/quality",
    status: "live",
  },
} as const satisfies Record<string, GroundOpsLink>;
