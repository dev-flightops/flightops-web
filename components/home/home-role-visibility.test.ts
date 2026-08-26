import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/roles";

import { HOME_MODULES, HOME_MODULE_ROLES } from "./module-catalog";
import { HOME_QUICK_LINKS } from "./quick-links";

const seesTile = (id: string, role: string) => {
  const allowed = HOME_MODULE_ROLES[id];
  return !allowed || (allowed as readonly string[]).includes(role);
};

const seesLink = (label: string, role: string) => {
  const link = HOME_QUICK_LINKS.find((l) => l.label === label);
  if (!link?.roles) return true;
  return (link.roles as readonly string[]).includes(role);
};

describe("the three home surfaces agree", () => {
  // Found the hard way: the tiles were gated but the top-bar "Ops" chip,
  // the quick-link strip and the header gear were not, so a pilot with no
  // Reservations tile still had three other ways into Reservations. These
  // tests exist so that stays fixed.
  it("never offers a shortcut into a module whose tile is hidden", () => {
    for (const role of ROLES) {
      if (!seesTile("reservations", role)) {
        // The Ops chip deep-links to /reservations/.
        expect(
          HOME_QUICK_LINKS.some(
            (l) => l.href.startsWith("/reservations") && seesLink(l.label, role),
          ),
          `${role} has no reservations tile but a shortcut to it`,
        ).toBe(false);
      }
    }
  });

  it("keeps Settings to the same role as the settings department", () => {
    const settings = HOME_QUICK_LINKS.find((l) => l.label === "Settings");
    expect(settings?.roles).toEqual(["exec_admin"]);
  });

  it("keeps \"my\" links to people who actually fly", () => {
    // A reservations agent has no logbook, no duty history and no flight
    // history. These leaked through on the first pass because the tiles
    // were gated and the shortcut strip was not.
    for (const label of ["My Flight History", "My Duty History", "Flight Log"]) {
      expect(
        seesLink(label, "reservations_agent"),
        `${label} offered to a reservations agent`,
      ).toBe(false);
      expect(seesLink(label, "pilot"), `${label} hidden from a pilot`).toBe(true);
    }
  });

  it("keeps EOD consistent with the operations nav", () => {
    const eod = HOME_QUICK_LINKS.find((l) => l.href === "/eod");
    expect(eod?.roles).toContain("ground_ops");
    expect(eod?.roles).toContain("dispatcher");
    expect(eod?.roles).not.toContain("pilot");
  });
});

describe("reservations_agent tiles", () => {
  const AGENT = "reservations_agent";

  it("gets reservations and the read-only board", () => {
    expect(seesTile("reservations", AGENT)).toBe(true);
    expect(seesTile("flight-following", AGENT)).toBe(true);
  });

  it("gets nothing else from flight ops or the back office", () => {
    for (const closed of [
      "dispatch",
      "flight-crew",
      "maintenance",
      "ground-ops",
      "hr",
      "invoicing",
      "housing",
      "compliance",
      "fleetbrain",
    ]) {
      expect(seesTile(closed, AGENT), `agent sees ${closed}`).toBe(false);
    }
  });
});

describe("home tiles per role", () => {
  it("hides reservations from pilots — the client's example", () => {
    expect(seesTile("reservations", "pilot")).toBe(false);
    expect(seesTile("reservations", "crew_member")).toBe(false);
    expect(seesTile("reservations", "dispatcher")).toBe(true);
  });

  it.each(ROLES)("%s keeps academy and safety", (role) => {
    expect(seesTile("academy", role)).toBe(true);
    expect(seesTile("safety", role)).toBe(true);
  });

  it.each(ROLES)("%s gets at least one tile", (role) => {
    const visible = HOME_MODULES.filter(
      (m) => !m.roleGate && seesTile(m.id, role),
    );
    expect(visible.length).toBeGreaterThan(0);
  });

  it("exec_admin sees every tile that is not externally scoped", () => {
    for (const m of HOME_MODULES) {
      if (m.roleGate) continue; // supplier portal etc.
      expect(seesTile(m.id, "exec_admin"), `${m.id} hidden from admin`).toBe(
        true,
      );
    }
  });
});

describe("the home matrix itself", () => {
  it("only names roles that exist", () => {
    const known = new Set<string>(ROLES);
    for (const [id, roles] of Object.entries(HOME_MODULE_ROLES)) {
      for (const r of roles) {
        expect(known.has(r), `${id} names unknown role ${r}`).toBe(true);
      }
    }
    for (const l of HOME_QUICK_LINKS) {
      for (const r of l.roles ?? []) {
        expect(known.has(r), `${l.label} names unknown role ${r}`).toBe(true);
      }
    }
  });

  it("only names tiles that exist", () => {
    const known = new Set(HOME_MODULES.map((m) => m.id));
    for (const id of Object.keys(HOME_MODULE_ROLES)) {
      expect(known.has(id), `unknown home tile ${id}`).toBe(true);
    }
  });
});
