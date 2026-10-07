import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth }));
const getPlanDocument = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/integrations", () => ({ getPlanDocument }));

import { ApiError } from "@/lib/api/client";

import { GET } from "./route";

/**
 * A ForeFlight plan's document (#55): a fresh link from ops on every
 * click, because ForeFlight's expire.
 */

const PLAN = "11111111-1111-4111-8111-111111111111";

function call(planId: string, kind: string) {
  return GET(new Request("https://app.example/x"), { params: Promise.resolve({ planId, kind }) });
}

beforeEach(() => {
  auth.mockReset();
  getPlanDocument.mockReset();
  auth.mockResolvedValue({ access_token: "t" });
});

describe("ForeFlight plan documents", () => {
  it("goes to the fresh link ops asked ForeFlight for", async () => {
    getPlanDocument.mockResolvedValue({ url: "https://docs.foreflight.example/navlog.pdf?sig=x" });
    const response = await call(PLAN, "navlog");
    expect(getPlanDocument).toHaveBeenCalledWith(PLAN, "navlog");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://docs.foreflight.example/navlog.pdf?sig=x");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("asks ops nothing for a document kind or plan id it doesn't know", async () => {
    expect((await call(PLAN, "weather")).status).toBe(404);
    expect((await call("../flights", "navlog")).status).toBe(404);
    expect(getPlanDocument).not.toHaveBeenCalled();
  });

  it("refuses without a session", async () => {
    auth.mockResolvedValue(null);
    expect((await call(PLAN, "wb")).status).toBe(401);
    expect(getPlanDocument).not.toHaveBeenCalled();
  });

  it("says plainly why there's no document", async () => {
    getPlanDocument.mockRejectedValue(
      new ApiError(409, "/ops/x", '{"detail":"foreflight_not_connected"}'),
    );
    const refused = await call(PLAN, "briefing");
    expect(refused.status).toBe(409);
    expect(await refused.text()).toMatch(/ForeFlight isn't connected any more/);

    getPlanDocument.mockRejectedValue(new ApiError(404, "/ops/x", '{"detail":"document_unavailable"}'));
    const missing = await call(PLAN, "briefing");
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("ForeFlight has no such document for this flight yet.");
  });

  it("won't send the browser to a link that isn't https", async () => {
    getPlanDocument.mockResolvedValue({ url: "javascript:alert(1)" });
    expect((await call(PLAN, "navlog")).status).toBe(502);
  });
});
