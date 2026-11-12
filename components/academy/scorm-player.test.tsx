import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LessonMedia, ScormAttempt } from "@/lib/api/academy";

import { ScormPlayer, scormResultText } from "./scorm-player";

/** A SCORM module in a lesson (the bug doc's Section 6). */

const API = "https://api.example.test";
const item: LessonMedia = {
  id: "m1",
  lesson_id: "l1",
  ordinal: 0,
  kind: "scorm",
  title: "Icing",
  must_finish: true,
  source: "file",
  filename: "icing.zip",
  size_bytes: 1000,
  link_url: null,
  link_provider: null,
  link_ref: null,
  document_id: null,
  scorm: { version: "1.2", title: "Icing", launch_path: "index.html", mastery_score: null, file_count: 3, unpacked_bytes: 9 },
};
const fetchMock = vi.fn();

function launched() {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ url: `${API}/academy/scorm/run/t/k/`, origin: API, expires_at: "x" }), { status: 200 }),
  );
}

function post(data: unknown, origin = API) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, origin }));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a SCORM module", () => {
  it("opens the learner's own run in a frame from the API's address", async () => {
    launched();
    render(<ScormPlayer item={item} enrollmentId="e1" finished={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Start the module" }));
    const frame = await screen.findByTitle("Icing");
    expect(fetchMock).toHaveBeenCalledWith("/api/academy/enrollments/e1/scorm-launch/m1", { method: "POST" });
    expect(frame).toHaveAttribute("src", `${API}/academy/scorm/run/t/k/`);
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("moves the lesson on once the service reads it as passed, from that address only", async () => {
    launched();
    const onFinished = vi.fn();
    render(<ScormPlayer item={item} enrollmentId="e1" finished={false} onFinished={onFinished} />);
    fireEvent.click(screen.getByRole("button", { name: "Start the module" }));
    await screen.findByTitle("Icing");
    const passed = { type: "flightops-scorm", mediaId: "m1", status: "passed", finished: true, scorePercent: 90 };
    post(passed, "https://elsewhere.example");
    post({ ...passed, mediaId: "other" });
    expect(onFinished).not.toHaveBeenCalled();
    post(passed);
    post(passed);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Passed · 90%/)).toBeInTheDocument();
  });

  it("is a preview, counting for nothing, without an enrollment", async () => {
    launched();
    const onFinished = vi.fn();
    render(<ScormPlayer item={item} enrollmentId={null} finished={false} onFinished={onFinished} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview the module" }));
    await screen.findByTitle("Icing");
    expect(fetchMock).toHaveBeenCalledWith("/api/academy/media/m1/scorm-preview", { method: "POST" });
    post({ type: "flightops-scorm", mediaId: "m1", status: "passed", finished: true, scorePercent: null });
    expect(onFinished).not.toHaveBeenCalled();
    expect(screen.getByText(/A preview counts for nothing/)).toBeInTheDocument();
  });

  it("carries on a run already begun, and says where it stands", () => {
    const attempt: ScormAttempt = {
      media_id: "m1",
      status: "failed",
      score_percent: 60,
      score_raw: 60,
      score_max: null,
      total_seconds: 720,
      launch_count: 2,
      finished: false,
      finished_at: null,
      last_saved_at: "x",
    };
    render(<ScormPlayer item={item} enrollmentId="e1" attempt={attempt} finished={false} />);
    expect(screen.getByRole("button", { name: "Carry on with the module" })).toBeInTheDocument();
    expect(screen.getByText("Failed: take it again to pass · 60% · 12 min")).toBeInTheDocument();
  });

  it("says why it couldn't open", async () => {
    fetchMock.mockResolvedValue(new Response('{"detail":"several_scos_in_package"}', { status: 422 }));
    render(<ScormPlayer item={item} enrollmentId="e1" finished={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Start the module" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/several SCOs/));
  });

  it("puts a run in words", () => {
    expect(scormResultText("completed", null)).toBe("Completed");
    expect(scormResultText("incomplete", 42.4, 30)).toBe("In progress · 42%");
  });
});
