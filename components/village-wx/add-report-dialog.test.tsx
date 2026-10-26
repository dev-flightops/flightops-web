import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  state: { status: "idle" } as Record<string, unknown>,
  refresh: vi.fn(),
}));
vi.mock("@/app/(app)/village-wx/actions", () => ({ fileVillageReportAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: hooks.refresh }) }));
// The test runner has React 18, which has no useActionState: the form's
// state is the one a test sets.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: () => [hooks.state, () => {}, false],
}));
vi.mock("@/lib/images/downscale", () => ({
  downscalePhoto: vi.fn(async (file: File) => new Blob([`small ${file.name}`], { type: "image/jpeg" })),
}));

import { AddReportDialog } from "./add-report-dialog";

const AIRPORTS = [
  { id: "a-1", icao: "PAVA", name: "Chevak", region: null, is_active: true, notes: null, has_instrument_approach: false, instrument_approach_changed_at: null },
];

function photo(name: string) {
  return new File(["jpeg bytes"], name, { type: "image/jpeg" });
}

beforeEach(() => {
  hooks.state = { status: "idle" };
  vi.restoreAllMocks();
});

describe("photos with a village report (#121)", () => {
  it("sends each, made small, once the report is filed", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 201 }));
    const { rerender } = render(<AddReportDialog airports={AIRPORTS} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Report" }));
    fireEvent.change(screen.getByLabelText("Photos"), {
      target: { files: [photo("runway.jpg"), photo("clouds.jpg")] },
    });
    expect(screen.getByText("2 photos to send with the report.")).toBeInTheDocument();

    hooks.state = { status: "ok", reportId: "r-1" };
    rerender(<AddReportDialog airports={AIRPORTS} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/village-reports/r-1/photos");
    expect((init?.body as FormData).get("photo")).toBeInstanceOf(Blob);
    await waitFor(() => expect(hooks.refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says which photo didn't go, and why, keeping the report", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 201 }))
      .mockResolvedValueOnce(
        Response.json({ detail: "photo_must_be_jpeg_png_webp_or_gif" }, { status: 422 }),
      );
    const { rerender } = render(<AddReportDialog airports={AIRPORTS} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Report" }));
    fireEvent.change(screen.getByLabelText("Photos"), {
      target: { files: [photo("runway.jpg"), photo("fog.heic")] },
    });
    hooks.state = { status: "ok", reportId: "r-2" };
    rerender(<AddReportDialog airports={AIRPORTS} />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "fog.heic: a format browsers can't show; take it as a JPEG",
      ),
    );
    expect(screen.getByText("Report filed; not every photo went")).toBeInTheDocument();
  });

  it("names the host's own size cap and an unreadable photo", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response("Request Entity Too Large", { status: 413 }))
      .mockResolvedValueOnce(Response.json({ detail: "photo_unreadable" }, { status: 422 }));
    const { rerender } = render(<AddReportDialog airports={AIRPORTS} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Report" }));
    fireEvent.change(screen.getByLabelText("Photos"), {
      target: { files: [photo("huge.jpg"), photo("broken.jpg")] },
    });
    hooks.state = { status: "ok", reportId: "r-4" };
    rerender(<AddReportDialog airports={AIRPORTS} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("huge.jpg: too large"));
    expect(screen.getByRole("alert")).toHaveTextContent("broken.jpg: couldn't be read as a picture");
  });

  it("doesn't send photos picked after an earlier report to it", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 201 }));
    const { rerender } = render(<AddReportDialog airports={AIRPORTS} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Report" }));
    hooks.state = { status: "ok", reportId: "r-3" };
    rerender(<AddReportDialog airports={AIRPORTS} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "+ Add Report" }));
    fireEvent.change(screen.getByLabelText("Photos"), { target: { files: [photo("later.jpg")] } });
    rerender(<AddReportDialog airports={AIRPORTS} />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("1 photo to send with the report.")).toBeInTheDocument();
  });

  it("forgets the picked photos when closed", () => {
    render(<AddReportDialog airports={AIRPORTS} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Report" }));
    fireEvent.change(screen.getByLabelText("Photos"), { target: { files: [photo("runway.jpg")] } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Add Report" }));
    expect(screen.queryByText(/to send with the report/)).not.toBeInTheDocument();
  });
});
