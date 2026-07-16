import type { FlightType } from "@/lib/api/types";

/** Display labels for the FlightType union. Kept here (not in
 *  lib/api/types) because the labels are a UI concern; the API
 *  carries the raw values. */
export const FLIGHT_TYPE_LABELS: Record<FlightType, string> = {
  advisory: "Advisory",
  charter: "Charter",
  training: "Training",
  ferry: "Ferry",
  checkride: "Checkride",
  scheduled: "Scheduled",
  eas: "EAS",
  mx_checkflight: "MX Checkflight",
  other: "Other",
};
