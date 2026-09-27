import { describe, expect, it } from "vitest";

import {
  EXTERNAL_HOME,
  guardRedirect,
  isExternalPath,
  isStaffSession,
  STAFF_HOME,
} from "./external-access";

const go = (
  path: string,
  roles: string[] | undefined,
  { loggedIn = true, isServerAction = false } = {},
) => guardRedirect({ loggedIn, roles, path, isServerAction });

describe("isStaffSession", () => {
  it("is staff with any platform role", () => {
    expect(isStaffSession(["pilot"])).toBe(true);
    expect(isStaffSession(["exec_admin", "dispatcher"])).toBe(true);
  });

  it("is not staff with no role, or only roles the platform does not know", () => {
    expect(isStaffSession([])).toBe(false);
    expect(isStaffSession(undefined)).toBe(false);
    expect(isStaffSession(["charter_client"])).toBe(false);
    expect(isStaffSession(["fuel_supplier"])).toBe(false);
  });
});

describe("guardRedirect — signed out", () => {
  it("sends every page to /login, but not /login itself", () => {
    expect(go("/dispatch", undefined, { loggedIn: false })).toBe("/login");
    expect(go("/portal", undefined, { loggedIn: false })).toBe("/login");
    expect(go("/login", undefined, { loggedIn: false })).toBeNull();
  });

  it("lets a server action through to fail on its own terms", () => {
    expect(
      go("/dispatch", undefined, { loggedIn: false, isServerAction: true }),
    ).toBeNull();
  });

  it("leaves the cross-tenant supplier portal to its own cookie", () => {
    // It was redirected to the staff login, so a supplier without a
    // staff account could never reach its own sign-in page.
    expect(go("/fuel-supplier/login", undefined, { loggedIn: false })).toBeNull();
    expect(go("/fuel-supplier", undefined, { loggedIn: false })).toBeNull();
  });
});

describe("guardRedirect — staff", () => {
  const staff = ["dispatcher"];

  it("goes anywhere", () => {
    expect(go("/dispatch", staff)).toBeNull();
    expect(go("/settings/users", staff)).toBeNull();
    expect(go("/portal", staff)).toBeNull();
  });

  it("is sent home from /login", () => {
    expect(go("/login", staff)).toBe(STAFF_HOME);
  });
});

describe("guardRedirect — a customer or supplier login", () => {
  const customer: string[] = [];

  it("stays on the portal and the supplier inbox", () => {
    expect(go("/portal", customer)).toBeNull();
    expect(go("/portal/221da87e", customer)).toBeNull();
    expect(go("/fuel/supplier", customer)).toBeNull();
  });

  it("is sent to the portal from everywhere else, home included", () => {
    for (const path of ["/", "/home/", "/dispatch", "/settings/users", "/reservations/"]) {
      expect(go(path, customer)).toBe(EXTERNAL_HOME);
    }
  });

  it("is sent to the portal, not staff home, from /login", () => {
    expect(go("/login", customer)).toBe(EXTERNAL_HOME);
  });

  it("matches whole segments, so a look-alike route is not open", () => {
    expect(isExternalPath("/portal-admin")).toBe(false);
    expect(isExternalPath("/fuel/suppliers")).toBe(false);
    expect(go("/fuel/suppliers", customer)).toBe(EXTERNAL_HOME);
  });
});
