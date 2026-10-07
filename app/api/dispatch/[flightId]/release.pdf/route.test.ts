import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, packetWeatherFor, getMyBrand } = vi.hoisted(() => ({
  auth: vi.fn(),
  packetWeatherFor: vi.fn(),
  getMyBrand: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/dispatch-risk", () => ({ packetWeatherFor }));
vi.mock("@/lib/api/auth", () => ({ getMyBrand }));

import { GET } from "./route";

/**
 * The dispatch packet PDF (#52): ops renders it and fetches the AAWU
 * charts itself (#53), so this brings only the company logo and the
 * flight's current weather for a flight with no packet kept at release.
 */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const WEATHER = {
  stops: [{ ident: "PABE", metar: "PABE 131600Z 34009KT 10SM CLR", taf: null, pireps: "" }],
  area_forecast: null,
};
const LOGO = "https://cdn.example/logo.png";
const fetchMock = vi.fn();

function backend(logoType = "image/png") {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === LOGO) {
      return new Response(PNG, { status: 200, headers: { "Content-Type": logoType } });
    }
    return new Response("%PDF-1.4 packet", {
      status: 200,
      headers: { "Content-Disposition": 'inline; filename="Dispatch_11_PABE_PAEM_20261006_1230.pdf"' },
    });
  });
}

function print() {
  return GET(new Request("https://app.example/api/dispatch/f-1/release.pdf"), {
    params: Promise.resolve({ flightId: "f-1" }),
  });
}

function opsCall() {
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/ops/"));
  return { url: call?.[0], init: call?.[1] as RequestInit, body: JSON.parse(String(call?.[1]?.body)) };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://gw.example");
  vi.stubGlobal("fetch", fetchMock);
  auth.mockResolvedValue({ access_token: "tok" });
  packetWeatherFor.mockResolvedValue(WEATHER);
  getMyBrand.mockResolvedValue({ name: "Demo Air", logo_url: LOGO });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("GET /api/dispatch/[flightId]/release.pdf", () => {
  it("brings the logo and the weather to ops and hands back its packet", async () => {
    backend();
    const response = await print();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="Dispatch_11_PABE_PAEM_20261006_1230.pdf"',
    );
    expect(await response.text()).toBe("%PDF-1.4 packet");
    const { url, init, body } = opsCall();
    expect(url).toBe("https://gw.example/ops/flights/f-1/packet.pdf");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
    expect(body).toEqual({ logo: Buffer.from(PNG).toString("base64"), weather: WEATHER });
    expect(packetWeatherFor).toHaveBeenCalledWith("f-1");
    // ops fetches the AAWU charts itself; nothing here carries them (#53).
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("aawu-charts"))).toBe(false);
  });

  it("leaves out what it couldn't get, for the packet to print without it", async () => {
    backend("text/html");
    packetWeatherFor.mockResolvedValue(null);
    expect((await print()).status).toBe(200);
    expect(opsCall().body).toEqual({});
  });

  it("only fetches a logo from an https address", async () => {
    backend();
    getMyBrand.mockResolvedValue({ name: "Demo Air", logo_url: "http://cdn.example/logo.png" });
    await print();
    expect(opsCall().body.logo).toBeUndefined();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("cdn.example"))).toBe(false);
  });

  it("passes a refusal on, and asks for a login first", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/ops/")
        ? new Response("flight_not_found", { status: 404 })
        : new Response("", { status: 404 }),
    );
    expect((await print()).status).toBe(404);

    auth.mockResolvedValue(null);
    fetchMock.mockClear();
    expect((await print()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
