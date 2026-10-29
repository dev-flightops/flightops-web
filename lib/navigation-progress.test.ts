import { describe, expect, it } from "vitest";

import { opensAnotherPage } from "./navigation-progress";

const HERE = "https://www.peregrineflight.com/dispatch?flight=abc";

describe("opensAnotherPage (#142)", () => {
  it("is another page for another path or other search parameters", () => {
    expect(opensAnotherPage("/schedule", HERE)).toBe(true);
    expect(opensAnotherPage("/dispatch?flight=def", HERE)).toBe(true);
    expect(opensAnotherPage("/dispatch", HERE)).toBe(true);
    expect(opensAnotherPage("https://www.peregrineflight.com/home", HERE)).toBe(true);
  });

  it("is nothing to wait for at the same address or with only the hash changed", () => {
    expect(opensAnotherPage("/dispatch?flight=abc", HERE)).toBe(false);
    expect(opensAnotherPage("/dispatch?flight=abc#weather", HERE)).toBe(false);
    expect(opensAnotherPage(HERE, HERE)).toBe(false);
  });

  it("is nothing for another site or an address it can't read", () => {
    expect(opensAnotherPage("https://www.weather.gov/aawu/", HERE)).toBe(false);
    expect(opensAnotherPage("/home", "not a url")).toBe(false);
  });
});
