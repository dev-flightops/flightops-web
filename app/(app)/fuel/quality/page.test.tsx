import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  FuelQualityTestResponse,
  FuelTypeResponse,
} from "@/lib/api/types";

const { TestApiError, listFuelQualityTests, listFuelTypes } = vi.hoisted(
  () => {
    class TestApiError extends Error {
      constructor(
        public status: number,
        public path: string,
        message: string,
      ) {
        super(message);
      }
    }
    return {
      TestApiError,
      listFuelQualityTests: vi.fn(),
      listFuelTypes: vi.fn(),
    };
  },
);

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({
  listFuelQualityTests,
  listFuelTypes,
}));
vi.mock("@/components/fuel/quality/add-test-dialog", () => ({
  AddFuelQualityTestDialog: () => <div data-testid="add-test-dialog" />,
}));

import FuelQualityPage from "./page";

function makeTest(
  overrides: Partial<FuelQualityTestResponse>,
): FuelQualityTestResponse {
  return {
    id: "t-1",
    base_code: "PANC",
    n_number: "N207GE",
    fuel_type: null,
    fuel_type_label_snapshot: "Jet A",
    test_kind: "sump",
    water_detected: false,
    particulates_detected: false,
    result: "pass",
    sample_volume_oz: 8,
    ambient_temp_c: -5,
    notes: null,
    tested_at: "2026-06-15T18:00:00Z",
    tested_by: { id: "u-1", full_name: "Phil B.", email: "phil@x" },
    tested_by_name: "Phil B.",
    created_at: "2026-06-15T18:00:00Z",
    ...overrides,
  };
}

const FUEL_TYPES: FuelTypeResponse[] = [
  { id: "ft-1", code: "JET-A", label: "Jet A", is_active: true, sort_order: 10 },
];

beforeEach(() => {
  listFuelQualityTests.mockReset();
  listFuelTypes.mockReset();
  listFuelTypes.mockResolvedValue({ items: FUEL_TYPES, total: 1 });
});

async function renderPage(search: { failures?: string; base?: string } = {}) {
  const ui = await FuelQualityPage({
    searchParams: Promise.resolve(search),
  });
  return render(ui);
}

describe("FuelQualityPage (M2-G-fuel-quality-log)", () => {
  it("renders the header + breadcrumb + Log Test button", async () => {
    listFuelQualityTests.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /fuel quality log/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("add-test-dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^fuel$/i })).toHaveAttribute(
      "href",
      "/fuel",
    );
  });

  it("renders 'Clean sample' for a passing test", async () => {
    listFuelQualityTests.mockResolvedValueOnce({
      items: [makeTest({})],
      total: 1,
    });

    await renderPage();

    expect(screen.getByText(/clean sample/i)).toBeInTheDocument();
    expect(screen.getByText("Pass")).toBeInTheDocument();
  });

  it("highlights a water-contamination finding", async () => {
    listFuelQualityTests.mockResolvedValueOnce({
      items: [
        makeTest({
          water_detected: true,
          result: "contamination_water",
          notes: "Sediment near sump valve",
        }),
      ],
      total: 1,
    });

    await renderPage();

    // "Water" appears twice — once in the Findings cell, once in the
    // Result chip. Both are intentional; just assert at least one.
    expect(screen.getAllByText("Water").length).toBeGreaterThan(0);
    expect(screen.getByText(/sediment near sump/i)).toBeInTheDocument();
  });

  it("flags 'particulates + water' combined finding", async () => {
    listFuelQualityTests.mockResolvedValueOnce({
      items: [
        makeTest({
          water_detected: true,
          particulates_detected: true,
          result: "contamination_particulate",
        }),
      ],
      total: 1,
    });

    await renderPage();

    expect(screen.getByText(/water \+ particulates/i)).toBeInTheDocument();
  });

  it("calls listFuelQualityTests with only_failures when ?failures=true", async () => {
    listFuelQualityTests.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ failures: "true" });

    expect(listFuelQualityTests).toHaveBeenCalledWith({
      onlyFailures: true,
      baseCode: undefined,
      limit: 100,
    });
  });

  it("nudges the user to the failures view when failures exist", async () => {
    listFuelQualityTests.mockResolvedValueOnce({
      items: [
        makeTest({ id: "t-1" }),
        makeTest({
          id: "t-2",
          water_detected: true,
          result: "contamination_water",
        }),
      ],
      total: 2,
    });

    await renderPage();

    expect(
      screen.getByText(/1 of 2 failed/i),
    ).toBeInTheDocument();
  });

  it("renders 'No tests logged yet' empty state on default view", async () => {
    listFuelQualityTests.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/no tests logged yet/i)).toBeInTheDocument();
  });

  it("renders 'Clean run' empty state on failures view", async () => {
    listFuelQualityTests.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ failures: "true" });

    expect(screen.getByText(/no failed tests on file/i)).toBeInTheDocument();
  });

  it("shows session-expired on 401", async () => {
    listFuelQualityTests.mockRejectedValueOnce(
      new TestApiError(401, "/x", "expired"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });

  it("shows a generic banner on 5xx", async () => {
    listFuelQualityTests.mockRejectedValueOnce(
      new TestApiError(500, "/x", "boom"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });
});
