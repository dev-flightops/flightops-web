import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WeatherBriefingListItem } from "@/lib/api/types";

const { TestApiError, listWeatherBriefings } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listWeatherBriefings: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/weather", () => ({ listWeatherBriefings }));

import WeatherBriefingsPage from "./page";

function makeBriefing(
  overrides: Partial<WeatherBriefingListItem> & { id: string },
): WeatherBriefingListItem {
  return {
    airports: ["PANC", "PABE"],
    flight: null,
    aircraft: null,
    worst_flight_category: "VFR",
    briefed_by: { id: "u-1", full_name: "Dispatcher", email: "d@x" },
    created_at: "2026-06-15T14:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  listWeatherBriefings.mockReset();
});

async function renderPage() {
  const ui = await WeatherBriefingsPage();
  return render(ui);
}

describe("WeatherBriefingsPage (M2-G-27 list)", () => {
  it("renders the legacy title + subtitle + New Briefing CTA", async () => {
    listWeatherBriefings.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /weather briefings/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/stored weather briefings/i),
    ).toBeInTheDocument();
    // Empty-state below the header also renders a /weather/new link
    // — assert at least one is present and all point at the right href.
    const links = screen.getAllByRole("link", { name: /\+ new briefing/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(
      links.every((a) => a.getAttribute("href") === "/weather/new"),
    ).toBe(true);
  });

  it("calls listWeatherBriefings with the page limit", async () => {
    listWeatherBriefings.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(listWeatherBriefings).toHaveBeenCalledWith({ limit: 100 });
  });

  it("renders one row per briefing with airports joined, conditions pill, and a View link", async () => {
    listWeatherBriefings.mockResolvedValueOnce({
      items: [
        makeBriefing({
          id: "b-1",
          airports: ["PANC", "PABE", "PAKN"],
          worst_flight_category: "LIFR",
          flight: { id: "f-1", flight_number: "GV101" },
          aircraft: { id: "ac-1", tail_number: "N207GE" },
        }),
        makeBriefing({
          id: "b-2",
          airports: ["PANC"],
          worst_flight_category: null,
        }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByText("PANC, PABE, PAKN")).toBeInTheDocument();
    expect(screen.getByText("GV101")).toBeInTheDocument();
    expect(screen.getByText("N207GE")).toBeInTheDocument();
    expect(screen.getByText(/^lifr$/i)).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: /view/i });
    expect(links[0]).toHaveAttribute("href", "/weather/b-1");
    expect(links[1]).toHaveAttribute("href", "/weather/b-2");
  });

  it("renders the empty-state with a deep link to /weather/new", async () => {
    listWeatherBriefings.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/no briefings yet/i)).toBeInTheDocument();
    // Header "+ New Briefing" + empty-state "Create First Briefing"
    // both target /weather/new (legacy history.html copy).
    const headerCta = screen.getByRole("link", { name: /\+ new briefing/i });
    const emptyCta = screen.getByRole("link", {
      name: /create first briefing/i,
    });
    expect(headerCta).toHaveAttribute("href", "/weather/new");
    expect(emptyCta).toHaveAttribute("href", "/weather/new");
  });

  it("renders the session-expired alert on 401", async () => {
    listWeatherBriefings.mockRejectedValueOnce(
      new TestApiError(401, "/weather/briefings", "Unauthorized"),
    );

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders the generic error alert on 5xx", async () => {
    listWeatherBriefings.mockRejectedValueOnce(
      new TestApiError(502, "/weather/briefings", "Bad Gateway"),
    );

    await renderPage();

    expect(screen.getByText(/briefings feed unavailable/i)).toBeInTheDocument();
  });
});
