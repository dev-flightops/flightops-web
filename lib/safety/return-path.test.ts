import { describe, expect, it } from "vitest";

import { safeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it("keeps same-origin absolute paths", () => {
    expect(safeReturnPath("/housing")).toBe("/housing");
    expect(safeReturnPath("/dispatch?flight=abc")).toBe("/dispatch?flight=abc");
    expect(safeReturnPath("/employees/6ffd98c1-1566-4c41-99be-920fc9ea0615")).toBe(
      "/employees/6ffd98c1-1566-4c41-99be-920fc9ea0615",
    );
  });

  it("falls back when there is no return_url", () => {
    expect(safeReturnPath(undefined)).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath("")).toBeNull();
  });

  it("rejects off-origin and scheme-bearing values", () => {
    // Rendered into an href, so these are the ones that matter.
    expect(safeReturnPath("//evil.test/phish")).toBeNull();
    expect(safeReturnPath("/\\evil.test/phish")).toBeNull();
    expect(safeReturnPath("https://evil.test")).toBeNull();
    expect(safeReturnPath("javascript:alert(1)")).toBeNull();
    expect(safeReturnPath("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects relative paths, which would resolve against /safety/report", () => {
    expect(safeReturnPath("housing")).toBeNull();
    expect(safeReturnPath("../settings/users")).toBeNull();
  });
});
