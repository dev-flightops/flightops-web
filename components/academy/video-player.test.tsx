import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SKIP_HINT, VIDEO_PROBLEM, VideoPlayer } from "./video-player";

const tracking = { enrollmentId: "e1", mediaId: "m1" };
let fetchMock: ReturnType<typeof vi.fn>;

function answer(row: Partial<{ finished: boolean }> = {}) {
  return new Response(JSON.stringify({ media_id: "m1", finished: false, ...row }), { status: 200 });
}

function player() {
  return document.querySelector("video") as HTMLVideoElement;
}

function at(element: HTMLVideoElement, seconds: number, duration = 100) {
  Object.defineProperty(element, "currentTime", { configurable: true, writable: true, value: seconds });
  Object.defineProperty(element, "duration", { configurable: true, value: duration });
  Object.defineProperty(element, "seeking", { configurable: true, value: false });
}

function reports() {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async () => answer());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("while it has to be watched", () => {
  it("reports as it plays, at most every ten seconds", async () => {
    render(<VideoPlayer src="/v.mp4" title="Icing" tracking={tracking} />);
    const video = player();
    at(video, 1);
    await act(async () => void fireEvent.timeUpdate(video));
    expect(reports()).toEqual([{ media_id: "m1", position_seconds: 1, duration_seconds: 100 }]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/academy/enrollments/e1/media-progress");

    at(video, 3);
    await act(async () => void fireEvent.timeUpdate(video));
    expect(reports()).toHaveLength(1);

    vi.advanceTimersByTime(10_000);
    at(video, 5);
    await act(async () => void fireEvent.timeUpdate(video));
    expect(reports()).toHaveLength(2);
    expect(reports()[1].position_seconds).toBe(5);
  });

  it("sends a seek past the furthest point back, and says why", () => {
    render(<VideoPlayer src="/v.mp4" title="Icing" tracking={tracking} initialPosition={20} />);
    const video = player();
    at(video, 80);
    fireEvent.seeking(video);
    expect(video.currentTime).toBe(20);
    expect(screen.getByText(SKIP_HINT)).toBeInTheDocument();
  });

  it("lets a learner go back over what they've seen", () => {
    render(<VideoPlayer src="/v.mp4" title="Icing" tracking={tracking} initialPosition={20} />);
    const video = player();
    at(video, 5);
    fireEvent.seeking(video);
    expect(video.currentTime).toBe(5);
    expect(screen.queryByText(SKIP_HINT)).toBeNull();
  });

  it("doesn't count a jump as watching", async () => {
    render(<VideoPlayer src="/v.mp4" title="Icing" tracking={tracking} initialPosition={20} />);
    const video = player();
    at(video, 90);
    await act(async () => void fireEvent.timeUpdate(video));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("picks up where the learner left off", () => {
    render(<VideoPlayer src="/v.mp4" title="Icing" tracking={tracking} initialPosition={42} />);
    const video = player();
    at(video, 0);
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(42);
  });

  it("picks up where the learner left off when the length was read before the page was live", () => {
    const readyState = vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(1);
    try {
      render(<VideoPlayer src="/v.mp4" title="Icing" tracking={tracking} initialPosition={42} />);
      expect(player().currentTime).toBe(42);
    } finally {
      readyState.mockRestore();
    }
  });

  it("at the end, tells the service until it counts, then lets go", async () => {
    fetchMock.mockImplementationOnce(async () => answer());
    fetchMock.mockImplementationOnce(async () => answer({ finished: true }));
    const onFinished = vi.fn();
    render(<VideoPlayer src="/v.mp4" title="Icing" tracking={tracking} onFinished={onFinished} />);
    const video = player();
    at(video, 100);
    await act(async () => void fireEvent.ended(video));
    expect(reports()[0].position_seconds).toBe(100);
    expect(onFinished).not.toHaveBeenCalled();

    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(onFinished).toHaveBeenCalledTimes(1);

    // Finished: free to skip around, and nothing more is sent.
    await act(async () => void vi.advanceTimersByTime(60_000));
    expect(reports()).toHaveLength(2);
    at(video, 80);
    fireEvent.seeking(video);
    expect(video.currentTime).toBe(80);
  });

  it("a report that fails doesn't break playback, and the next one carries on", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<VideoPlayer src="/v.mp4" title="Icing" tracking={tracking} />);
    const video = player();
    at(video, 1);
    await act(async () => void fireEvent.timeUpdate(video));
    vi.advanceTimersByTime(10_000);
    at(video, 4);
    await act(async () => void fireEvent.timeUpdate(video));
    expect(reports()).toHaveLength(2);
    expect(reports()[1].position_seconds).toBe(4);
  });

  it("sends where it got to as the page closes", async () => {
    render(<VideoPlayer src="/v.mp4" title="Icing" tracking={tracking} />);
    const video = player();
    at(video, 1);
    await act(async () => void fireEvent.timeUpdate(video));
    at(video, 3);
    await act(async () => void fireEvent.timeUpdate(video));
    expect(reports()).toHaveLength(1);
    await act(async () => void window.dispatchEvent(new Event("pagehide")));
    expect(reports()[1].position_seconds).toBe(3);
    expect(fetchMock.mock.calls[1][1].keepalive).toBe(true);
  });
});

describe("with nothing to track", () => {
  it("in the studio's preview, skips freely and records nothing", async () => {
    render(<VideoPlayer src="/v.mp4" title="Icing" tracking={null} />);
    const video = player();
    at(video, 80);
    fireEvent.seeking(video);
    await act(async () => void fireEvent.timeUpdate(video));
    await act(async () => void fireEvent.ended(video));
    expect(video.currentTime).toBe(80);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("when it won't play", () => {
  it("tries a fresh link once, then says so", () => {
    render(<VideoPlayer src="/v.mp4" title="Icing" tracking={tracking} />);
    const video = player();
    const load = vi.spyOn(video, "load").mockImplementation(() => {});
    fireEvent.error(video);
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.error(video);
    expect(screen.getByRole("alert")).toHaveTextContent(VIDEO_PROBLEM);
  });
});
