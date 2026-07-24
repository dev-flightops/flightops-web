import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FlightDetail, RampPhotoResponse } from "@/lib/api/types";

const { TestApiError, getFlight, listRampPhotos } = vi.hoisted(() => {
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
    getFlight: vi.fn(),
    listRampPhotos: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ getFlight }));
vi.mock("@/lib/api/ground", () => ({ listRampPhotos }));

// Mock the client-side upload form so useActionState (React 19) doesn't
// blow up in the jsdom env — we cover the server-render pieces here and
// exercise the upload flow end-to-end in the browser.
vi.mock("./upload-form", () => ({
  UploadRampPhotoForm: () => <div data-testid="upload-form-stub" />,
}));

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import RamperPhotosPage from "./page";

function makeFlight(overrides: Partial<FlightDetail> = {}): FlightDetail {
  return {
    id: "f-1",
    flight_number: "GRT201",
    origin: "PANC",
    destination: "PABE",
    scheduled_departure_at: "2026-07-23T18:00:00Z",
    scheduled_arrival_at: "2026-07-23T19:00:00Z",
    status: "scheduled",
    aircraft: {
      id: "ac-1",
      tail_number: "N207GE",
      model: "C208B",
      seats: 9,
      max_payload_lbs: 2000,
      is_active: true,
    },
    pax_count: 5,
    cargo_lbs: 250,
    notes: null,
    max_payload_lbs: 2000,
    released_at: null,
    released_by: null,
    ...overrides,
  } as FlightDetail;
}

function makePhoto(
  overrides: Partial<RampPhotoResponse> = {},
): RampPhotoResponse {
  return {
    id: "p-1",
    flight_id: "f-1",
    photo_type: "secured_load",
    file_key: "t-1/abc.jpg",
    original_filename: "abc.jpg",
    content_type: "image/jpeg",
    notes: null,
    uploaded_by_user_id: "u-1",
    uploaded_by_name: "Ramp Rita",
    url: "/uploads/ramp_photos/t-1/abc.jpg",
    ...overrides,
  };
}

beforeEach(() => {
  getFlight.mockReset();
  listRampPhotos.mockReset();
  notFoundMock.mockReset().mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

async function renderPage(flightId = "f-1") {
  const page = await RamperPhotosPage({
    params: Promise.resolve({ flightId }),
  });
  render(page);
}

describe("/ramper/[flightId]/photos", () => {
  it("renders flight header + Photos(0) + required-photo checklist all red", async () => {
    getFlight.mockResolvedValue(makeFlight());
    listRampPhotos.mockResolvedValue({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByRole("heading", { name: "GRT201" })).toBeDefined();
    expect(screen.getByText(/N207GE · C208B/)).toBeDefined();
    expect(screen.getByText(/Photos \(0\)/)).toBeDefined();
    expect(screen.getByText("No photos yet")).toBeDefined();
    for (const label of ["Secured Load", "Hazmat Placard", "Damage Documentation"]) {
      expect(screen.getByText(label)).toBeDefined();
    }
    // Upload form is rendered as a mocked stub.
    expect(screen.getByTestId("upload-form-stub")).toBeDefined();
  });

  it("renders uploaded photos + flips checklist to green for covered types", async () => {
    getFlight.mockResolvedValue(makeFlight());
    listRampPhotos.mockResolvedValue({
      items: [
        makePhoto({ id: "p-1", photo_type: "secured_load" }),
        makePhoto({ id: "p-2", photo_type: "hazmat_placard", url: "/uploads/x.jpg" }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByText(/Photos \(2\)/)).toBeDefined();
    // "damage_documentation" was not uploaded — still red.
    const damageEl = screen.getByText("Damage Documentation");
    expect(damageEl.className).toMatch(/status-red/);
    // Secured Load appears in the checklist as green.
    const securedEls = screen.getAllByText(/Secured Load|secured load/i);
    const green = securedEls.find((el) =>
      /status-green/.test(el.className),
    );
    expect(green).toBeDefined();
  });

  it("surfaces a yellow warning banner when photo list errors", async () => {
    getFlight.mockResolvedValue(makeFlight());
    listRampPhotos.mockRejectedValue(
      new TestApiError(403, "/ground/flights/f-1/photos", "Forbidden"),
    );

    await renderPage();

    expect(
      screen.getByText(/don't have permission to view ramp photos/),
    ).toBeDefined();
  });

  it("triggers notFound when the flight id 404s", async () => {
    getFlight.mockRejectedValue(
      new TestApiError(404, "/ops/flights/x", "Not Found"),
    );
    listRampPhotos.mockResolvedValue({ items: [], total: 0 });
    await expect(renderPage("does-not-exist")).rejects.toThrow(/NEXT_NOT_FOUND/);
    expect(notFoundMock).toHaveBeenCalled();
  });
});
