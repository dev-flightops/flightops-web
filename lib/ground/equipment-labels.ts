import type { GSEEquipmentType } from "@/lib/api/types";

/** Ground equipment types in words, wherever a unit is listed (#157: the
 *  ramper's list showed "belt_loader", "fuel_truck"). */
export const EQUIPMENT_TYPE_LABELS: Record<GSEEquipmentType, string> = {
  tug: "Tug",
  gpu: "GPU",
  deice_truck: "Deice Truck",
  belt_loader: "Belt Loader",
  fuel_truck: "Fuel Truck",
  lavatory: "Lavatory",
  air_start: "Air Start",
  heater: "Heater",
  other: "Other",
};

export function equipmentTypeLabel(type: string): string {
  return EQUIPMENT_TYPE_LABELS[type as GSEEquipmentType] ?? type.replace(/_/g, " ");
}
