import { loadZoneTable, listStaff } from "@/lib/api/auth";
import { listInspectionTypes } from "@/lib/api/inspections";
import { listVendors } from "@/lib/api/mx-vendors";
import { listAircraft } from "@/lib/api/ops";
import { localDay } from "@/lib/format/local-time";

type Option = { value: string; label: string };

/** What the inspection form picks from (#178): the fleet, legacy's types, the
 *  staff for "assigned to" and the vendors. A list that won't load leaves its
 *  picker empty rather than the page down. */
export async function inspectionFormOptions(): Promise<{
  aircraft: Option[];
  types: Option[];
  staff: Option[];
  vendors: Option[];
  today: string;
}> {
  const [fleet, types, staff, vendors, zones] = await Promise.allSettled([
    listAircraft(),
    listInspectionTypes(),
    listStaff(),
    listVendors(),
    loadZoneTable(),
  ]);
  return {
    aircraft:
      fleet.status === "fulfilled"
        ? fleet.value.items
            .filter((a) => a.is_active)
            .map((a) => ({ value: a.id, label: a.model ? `${a.tail_number} · ${a.model}` : a.tail_number }))
        : [],
    types: types.status === "fulfilled" ? types.value : [{ value: "annual", label: "Annual" }],
    staff: staff.status === "fulfilled" ? staff.value.items.map((s) => ({ value: s.id, label: s.full_name })) : [],
    vendors: vendors.status === "fulfilled" ? vendors.value.map((v) => ({ value: v.id, label: v.name })) : [],
    today: localDay(zones.status === "fulfilled" ? zones.value.fallback : "America/Anchorage"),
  };
}
