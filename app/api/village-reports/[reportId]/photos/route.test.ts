// @vitest-environment node
// A route handler runs on the server: under jsdom, its File in a Request
// body never reaches request.formData().
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth }));

import { POST } from "./route";

const fetchMock = vi.fn();

function send(body: FormData) {
  return POST(new Request("https://app.example/x", { method: "POST", body }), {
    params: Promise.resolve({ reportId: "r-1" }),
  });
}

function withPhoto() {
  const body = new FormData();
  body.append("photo", new File(["jpeg bytes"], "runway.jpg", { type: "image/jpeg" }));
  return body;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://gw.example");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  auth.mockResolvedValue({ access_token: "tok" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a village report's photo, sent on (#121)", () => {
  it("goes to the weather service with the session's token and its name", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "p-1", width: 1280, height: 960 }, { status: 201 }));
    const res = await send(withPhoto());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://gw.example/weather/village-reports/r-1/photos");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    const photo = (init.body as FormData).get("photo") as File;
    expect(photo.name).toBe("runway.jpg");
    expect(await photo.text()).toBe("jpeg bytes");
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "p-1", width: 1280, height: 960 });
  });

  it("passes the service's refusal on, so the form can say why", async () => {
    fetchMock.mockResolvedValue(Response.json({ detail: "too_many_photos" }, { status: 409 }));
    const res = await send(withPhoto());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ detail: "too_many_photos" });
  });

  it("refuses a form without a photo", async () => {
    const res = await send(new FormData());
    expect(res.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses without a session", async () => {
    auth.mockResolvedValue(null);
    const res = await send(withPhoto());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
