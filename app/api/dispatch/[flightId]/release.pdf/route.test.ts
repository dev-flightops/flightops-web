import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, packetWeatherFor } = vi.hoisted(() => ({
  auth: vi.fn(),
  packetWeatherFor: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/dispatch-risk", () => ({ packetWeatherFor }));

import { GET } from "./route";

/**
 * The dispatch packet PDF (#52): ops renders it, so this brings what only
 * the weather service fetches, the AAWU charts, and the flight's current
 * weather for a flight with no packet kept at release.
 */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const WEATHER = {
  stops: [{ ident: "PABE", metar: "PABE 131600Z 34009KT 10SM CLR", taf: null, pireps: "" }],
  area_forecast: null,
};
const fetchMock = vi.fn();

function backend(charts: Record<string, number>) {
  fetchMock.mockImplementation(async (url: string) => {
    const name = url.match(/aawu-charts\/(\w+)$/)?.[1];
    if (name) {
      return charts[name] === 200
        ? new Response(PNG, { status: 200, headers: { "Content-Type": "image/png" } })
        : new Response("chart_unavailable", { status: charts[name] ?? 404 });
    }
    return new Response("%PDF-1.4 packet", {
      status: 200,
      headers: { "Content-Disposition": 'inline; filename="11-dispatch-packet.pdf"' },
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
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("GET /api/dispatch/[flightId]/release.pdf", () => {
  it("brings the charts and the weather to ops and hands back its packet", async () => {
    backend({ icing: 200, turbulence: 200 });
    const response = await print();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="11-dispatch-packet.pdf"',
    );
    expect(await response.text()).toBe("%PDF-1.4 packet");
    const { url, init, body } = opsCall();
    expect(url).toBe("https://gw.example/ops/flights/f-1/packet.pdf");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
    const png = Buffer.from(PNG).toString("base64");
    expect(body).toEqual({ charts: { icing: png, turbulence: png }, weather: WEATHER });
    expect(packetWeatherFor).toHaveBeenCalledWith("f-1");
  });

  it("leaves out what it couldn't fetch, for the packet to print as unavailable", async () => {
    backend({ icing: 502, turbulence: 200 });
    packetWeatherFor.mockResolvedValue(null);
    expect((await print()).status).toBe(200);
    expect(opsCall().body).toEqual({ charts: { turbulence: Buffer.from(PNG).toString("base64") } });
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
