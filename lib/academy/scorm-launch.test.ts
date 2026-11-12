import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth }));

import { scormLaunchResponse } from "./scorm-launch";

/** A SCORM run's link for the lesson's frame (the bug doc's Section 6). */

const fetchMock = vi.fn();

beforeEach(() => {
  auth.mockReset();
  auth.mockResolvedValue({ access_token: "t" });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("a SCORM run's link", () => {
  it("is the API's own address, with the origin the player trusts", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ path: "/academy/scorm/run/t1/abc/", expires_at: "2026-11-13T00:00:00Z" }), {
        status: 200,
      }),
    );
    const response = await scormLaunchResponse("/academy/enrollments/e1/media/m1/scorm-launch");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/academy/enrollments/e1/media/m1/scorm-launch",
      expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer t" } }),
    );
    expect(await response.json()).toEqual({
      url: "https://api.example.test/academy/scorm/run/t1/abc/",
      origin: "https://api.example.test",
      expires_at: "2026-11-13T00:00:00Z",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("passes the service's refusal on as it came", async () => {
    fetchMock.mockResolvedValue(new Response('{"detail":"not_enrollee"}', { status: 403 }));
    const response = await scormLaunchResponse("/x");
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('{"detail":"not_enrollee"}');
  });

  it("asks nothing without a session", async () => {
    auth.mockResolvedValue(null);
    expect((await scormLaunchResponse("/x")).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
