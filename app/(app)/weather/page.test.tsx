import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  WeatherBatchResponse,
  WeatherReportResponse,
} from "@/lib/api/types";

const { TestApiError, batchWeather } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, batchWeather: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/weather", () => ({ batchWeather }));

// The form is a client component using useTransition + useRouter. The
// page also imports it, but for the server-side render we just need
// it to mount as a noop so we can assert on the page chrome.
vi.mock("./icao-input-form", async () => {
  const actual = await vi.importActual<typeof import("./icao-input-form")>(
    "./icao-input-form",
  );
  return {
    ...actual,
    IcaoInputForm: ({ initialIcaos }: { initialIcaos: string[] }) => (
      <div data-testid="icao-form" data-initial={initialIcaos.join(",")} />
    ),
  };
});

import WeatherPage from "./page";

function makeReport(
  overrides: Partial<WeatherReportResponse> & {
    icao: string;
    kind: "metar" | "taf";
  },
): WeatherReportResponse {
  return {
    raw: `${overrides.kind.toUpperCase()} ${overrides.icao} 011553Z 27015KT 10SM CLR 02/M03 A2992`,
    parsed_at: "2026-06-15T15:53:00Z",
    valid_until: "2026-06-15T16:53:00Z",
    cache_hit: false,
    flight_category: "VFR",
    alternate_required: false,
    visibility_sm: 10,
    ceiling_ft: null,
    wind_direction_deg: 270,
    wind_speed_kt: 15,
    wind_gust_kt: null,
    wind_variable: false,
    wind_calm: false,
    temp_c: 2,
    dewpoint_c: -3,
    altimeter_in_hg: 29.92,
    ...overrides,
  };
}

beforeEach(() => {
  batchWeather.mockReset();
});

async function renderPage(searchParams: { icaos?: string } = {}) {
  const ui = await WeatherPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

describe("WeatherPage", () => {
  it("renders only the form + empty-state hint when no ?icaos param", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { name: /weather/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("icao-form")).toHaveAttribute(
      "data-initial",
      "",
    );
    expect(
      screen.getByText(/enter one or more airports/i),
    ).toBeInTheDocument();
    expect(batchWeather).not.toHaveBeenCalled();
  });

  it("calls batchWeather with one METAR + one TAF per airport", async () => {
    const fakeBatch: WeatherBatchResponse = {
      items: [
        makeReport({ icao: "PANC", kind: "metar" }),
        makeReport({ icao: "PANC", kind: "taf" }),
        makeReport({ icao: "PAEN", kind: "metar" }),
        makeReport({ icao: "PAEN", kind: "taf" }),
      ],
      errors: [],
    };
    batchWeather.mockResolvedValueOnce(fakeBatch);

    await renderPage({ icaos: "panc,paen" });

    expect(batchWeather).toHaveBeenCalledTimes(1);
    const requests = batchWeather.mock.calls[0][0];
    expect(requests).toEqual([
      { icao: "PANC", kind: "metar" },
      { icao: "PANC", kind: "taf" },
      { icao: "PAEN", kind: "metar" },
      { icao: "PAEN", kind: "taf" },
    ]);
  });

  it("renders one card per ICAO with the VFR/IFR badge + raw text", async () => {
    batchWeather.mockResolvedValueOnce({
      items: [
        makeReport({ icao: "PANC", kind: "metar" }),
        makeReport({ icao: "PANC", kind: "taf" }),
      ],
      errors: [],
    });

    await renderPage({ icaos: "PANC" });

    expect(screen.getByText("PANC")).toBeInTheDocument();
    expect(screen.getByText(/^VFR$/i)).toBeInTheDocument();
    // Raw METAR text shows up in the pre block.
    expect(
      screen.getByText(/METAR PANC 011553Z 27015KT/),
    ).toBeInTheDocument();
  });

  it("dedupes + uppercases ?icaos before fanning out", async () => {
    batchWeather.mockResolvedValueOnce({ items: [], errors: [] });

    await renderPage({ icaos: "panc, PANC, paen" });

    const requests = batchWeather.mock.calls[0][0];
    const codes = [...new Set(requests.map((r: { icao: string }) => r.icao))];
    expect(codes).toEqual(["PANC", "PAEN"]);
  });

  it("caps to 10 airports per call (slice silently — form blocks > 10 with a banner)", async () => {
    batchWeather.mockResolvedValueOnce({ items: [], errors: [] });
    // 12 distinct 4-letter codes (KAAA … KAAL)
    const codes = Array.from({ length: 12 }, (_, i) =>
      `KAA${String.fromCharCode(65 + i)}`,
    ).join(",");
    await renderPage({ icaos: codes });

    const requests = batchWeather.mock.calls[0][0];
    // 2 per airport, capped at 10 airports = 20 requests.
    expect(requests).toHaveLength(20);
  });

  it("renders a per-row error message when an ICAO returns 404", async () => {
    batchWeather.mockResolvedValueOnce({
      items: [makeReport({ icao: "PANC", kind: "metar" })],
      errors: [
        { icao: "PANC", kind: "taf", status: 404, detail: "no TAF" },
      ],
    });

    await renderPage({ icaos: "PANC" });

    expect(
      screen.getByText(/no current taf for this airport/i),
    ).toBeInTheDocument();
  });

  it("renders the session-expired alert on 401", async () => {
    batchWeather.mockRejectedValueOnce(
      new TestApiError(401, "/weather/batch", "Unauthorized"),
    );

    await renderPage({ icaos: "PANC" });

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders a generic 'weather feed unavailable' on other errors", async () => {
    batchWeather.mockRejectedValueOnce(
      new TestApiError(502, "/weather/batch", "Bad Gateway"),
    );

    await renderPage({ icaos: "PANC" });

    expect(
      screen.getByText(/weather feed unavailable/i),
    ).toBeInTheDocument();
  });
});
