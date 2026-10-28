import {
  COMPANY_SETTINGS_WRITERS,
  COST_SETTINGS_WRITERS,
  FLEET_EDITORS,
  hasAnyRole,
  INTEGRATION_ADMINS,
  type Role,
  STATION_ADMINS,
} from "@/lib/roles";

/**
 * Where a setting is set, and who may set it there (#138).
 *
 * A page that can't go ahead for want of a setting names it, says what it
 * stops and sends the person here: by a link when their roles can set it,
 * or by who to ask when they can't (components/ff/setup-notice.tsx). Each
 * editor set mirrors the service that takes the change, so a link is never
 * offered to someone the save would refuse.
 */
export const SETUP_PLACES = {
  fleet: {
    href: "/settings/fleet",
    name: "Settings → Fleet",
    who: "an Exec Admin, the Director of Operations, the Director of Maintenance or Maintenance",
    editors: FLEET_EDITORS,
  },
  company: {
    href: "/settings/company",
    name: "Settings → Company Profile",
    who: "an Exec Admin or the Director of Operations",
    editors: COMPANY_SETTINGS_WRITERS,
  },
  bases: {
    href: "/settings/bases",
    name: "Settings → Bases",
    who: "an Exec Admin or the Director of Operations",
    editors: COMPANY_SETTINGS_WRITERS,
  },
  costs: {
    href: "/settings/costs",
    name: "Settings → Costs",
    who: "an Exec Admin",
    editors: COST_SETTINGS_WRITERS,
  },
  textMessages: {
    href: "/settings/text-messages",
    name: "Settings → Text Messages",
    who: "an Exec Admin or the Director of Operations",
    editors: INTEGRATION_ADMINS,
  },
  stations: {
    href: "/stations",
    name: "Stations",
    who: "station staff, the Director of Operations or an Exec Admin",
    editors: STATION_ADMINS,
  },
} as const satisfies Record<string, { href: string; name: string; who: string; editors: ReadonlySet<Role> }>;

export type SetupPlace = keyof typeof SETUP_PLACES;

/** Whether someone with these roles may set what lives at `place`. */
export function canSetUp(roles: readonly string[], place: SetupPlace): boolean {
  return hasAnyRole(roles, SETUP_PLACES[place].editors);
}
