import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/headers so getSupplierSession / setSupplierSession /
// clearSupplierSession can be exercised without a Next.js runtime.
const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import {
  clearSupplierSession,
  getSupplierSession,
  setSupplierSession,
} from "./supplier-session";

function makeJar() {
  const store = new Map<string, string>();
  return {
    get: (name: string) =>
      store.has(name) ? { name, value: store.get(name)! } : undefined,
    set: ({ name, value }: { name: string; value: string }) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
  };
}

beforeEach(() => {
  cookiesMock.mockReset();
});

describe("supplier-session", () => {
  it("setSupplierSession persists a JSON cookie the getter can read back", async () => {
    const jar = makeJar();
    cookiesMock.mockResolvedValue(jar);

    await setSupplierSession({
      access_token: "eyJ.tok.en",
      account_id: "acc-1",
      full_name: "Sarah Kessler",
      email: "sarah@avfuel.com",
      bindings: [
        { tenant_id: "t-1", fuel_supplier_id: "s-1" },
        { tenant_id: "t-2", fuel_supplier_id: "s-2" },
      ],
      expires_in: 3600,
    });

    const read = await getSupplierSession();
    expect(read).not.toBeNull();
    expect(read!.access_token).toBe("eyJ.tok.en");
    expect(read!.account_id).toBe("acc-1");
    expect(read!.bindings).toHaveLength(2);
    expect(read!.expires_at).toBeGreaterThan(Date.now() / 1000);
  });

  it("getSupplierSession returns null when the cookie is unset", async () => {
    cookiesMock.mockResolvedValue(makeJar());
    expect(await getSupplierSession()).toBeNull();
  });

  it("getSupplierSession returns null when the stored JSON is malformed", async () => {
    const jar = makeJar();
    jar.set({ name: "fuel_supplier_session", value: "not-json" });
    cookiesMock.mockResolvedValue(jar);
    expect(await getSupplierSession()).toBeNull();
  });

  it("getSupplierSession returns null when the JWT expiry has passed", async () => {
    const jar = makeJar();
    // expires_at is 1 second in the past.
    const past = Math.floor(Date.now() / 1000) - 1;
    jar.set({
      name: "fuel_supplier_session",
      value: JSON.stringify({
        access_token: "tok",
        account_id: "acc",
        full_name: "x",
        email: "x@x",
        bindings: [],
        expires_at: past,
      }),
    });
    cookiesMock.mockResolvedValue(jar);
    expect(await getSupplierSession()).toBeNull();
  });

  it("getSupplierSession returns null when required fields are missing", async () => {
    const jar = makeJar();
    jar.set({
      name: "fuel_supplier_session",
      value: JSON.stringify({ access_token: 42 }),
    });
    cookiesMock.mockResolvedValue(jar);
    expect(await getSupplierSession()).toBeNull();
  });

  it("clearSupplierSession removes the cookie", async () => {
    const jar = makeJar();
    jar.set({
      name: "fuel_supplier_session",
      value: JSON.stringify({
        access_token: "tok",
        account_id: "acc",
        full_name: "x",
        email: "x@x",
        bindings: [],
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    });
    cookiesMock.mockResolvedValue(jar);
    await clearSupplierSession();
    expect(await getSupplierSession()).toBeNull();
  });
});
