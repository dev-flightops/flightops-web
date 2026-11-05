import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMBED_PROBLEM, EmbedPlayer } from "./embed-player";
import { SKIP_HINT } from "./video-player";

const tracking = { enrollmentId: "e1", mediaId: "m1" };
const PLAYING = 1;
const ENDED = 0;
let fetchMock: ReturnType<typeof vi.fn>;

function reports() {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
}

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ finished: false }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete window.YT;
  delete window.Vimeo;
});

describe("YouTube", () => {
  let now = 0;
  let options: { videoId: string; playerVars: Record<string, number>; events: { onStateChange?: (e: { data: number }) => void; onError?: () => void } };
  const seekTo = vi.fn();
  const destroy = vi.fn();

  beforeEach(() => {
    now = 0;
    seekTo.mockClear();
    destroy.mockClear();
    window.YT = {
      PlayerState: { ENDED, PLAYING },
      Player: vi.fn(function (this: unknown, _element: HTMLElement, given: typeof options) {
        options = given;
        return {
          getCurrentTime: () => now,
          getDuration: () => 300,
          getPlayerState: () => PLAYING,
          seekTo,
          destroy,
        };
      }) as unknown as NonNullable<Window["YT"]>["Player"],
    };
  });

  async function start(props: Partial<Parameters<typeof EmbedPlayer>[0]> = {}) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const view = render(
      <EmbedPlayer provider="youtube" reference="abc123DEF45" title="Icing" tracking={tracking} {...props} />,
    );
    await waitFor(() => expect(window.YT?.Player).toHaveBeenCalled());
    return view;
  }

  it("plays the video from where the learner got to, without YouTube's cookies", async () => {
    await start({ initialPosition: 42.5 });
    expect(options.videoId).toBe("abc123DEF45");
    expect(options.playerVars.start).toBe(42);
    expect((options as unknown as { host: string }).host).toBe("https://www.youtube-nocookie.com");
  });

  it("reports as it plays", async () => {
    await start();
    now = 1;
    await act(async () => void (await vi.advanceTimersByTimeAsync(1000)));
    expect(reports()[0]).toEqual({ media_id: "m1", position_seconds: 1, duration_seconds: 300 });
  });

  it("sends a skip ahead back, and says why", async () => {
    await start({ initialPosition: 20 });
    now = 200;
    await act(async () => void (await vi.advanceTimersByTimeAsync(1000)));
    expect(seekTo).toHaveBeenCalledWith(20, true);
    expect(screen.getByText(SKIP_HINT)).toBeInTheDocument();
    expect(reports()).toEqual([]);
  });

  it("at the end, tells the service", async () => {
    await start();
    await act(async () => options.events.onStateChange?.({ data: ENDED }));
    expect(reports()[0].position_seconds).toBe(300);
  });

  it("with nothing to track, skips freely and records nothing", async () => {
    await start({ tracking: null });
    now = 200;
    await act(async () => void (await vi.advanceTimersByTimeAsync(1000)));
    expect(seekTo).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says so when the owner doesn't allow it", async () => {
    await start();
    await act(async () => options.events.onError?.());
    expect(screen.getByRole("alert")).toHaveTextContent(EMBED_PROBLEM);
  });

  it("takes the player away with the page", async () => {
    const view = await start();
    view.unmount();
    expect(destroy).toHaveBeenCalled();
  });
});

describe("Vimeo", () => {
  let handlers: Record<string, (data: { seconds: number; duration: number }) => void>;
  let given: { url: string; dnt: boolean };
  const setCurrentTime = vi.fn(async () => 0);

  beforeEach(() => {
    handlers = {};
    setCurrentTime.mockClear();
    window.Vimeo = {
      Player: vi.fn(function (this: unknown, _element: HTMLElement, options: typeof given) {
        given = options;
        return {
          on: (event: string, handler: (data: { seconds: number; duration: number }) => void) => {
            handlers[event] = handler;
          },
          setCurrentTime,
          ready: async () => {},
          destroy: async () => {},
        };
      }) as unknown as NonNullable<Window["Vimeo"]>["Player"],
    };
    // Its script tag "loads" at once.
    const append = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, "appendChild").mockImplementation(((node: Node) => {
      const added = append(node);
      queueMicrotask(() => (node as HTMLScriptElement).onload?.(new Event("load")));
      return added;
    }) as typeof document.head.appendChild);
  });

  afterEach(() => vi.restoreAllMocks());

  it("opens an unlisted video by its hash, without tracking", async () => {
    render(<EmbedPlayer provider="vimeo" reference="76979871/8272103f6e" title="Icing" tracking={tracking} />);
    await waitFor(() => expect(window.Vimeo?.Player).toHaveBeenCalled());
    expect(given.url).toBe("https://vimeo.com/76979871/8272103f6e");
    expect(given.dnt).toBe(true);
  });

  it("reports as it plays, sends a skip back, and tells the service at the end", async () => {
    render(<EmbedPlayer provider="vimeo" reference="76979871" title="Icing" tracking={tracking} initialPosition={10} />);
    await waitFor(() => expect(handlers.timeupdate).toBeDefined());

    await act(async () => handlers.timeupdate({ seconds: 11, duration: 300 }));
    expect(reports()[0]).toEqual({ media_id: "m1", position_seconds: 11, duration_seconds: 300 });

    await act(async () => handlers.timeupdate({ seconds: 250, duration: 300 }));
    expect(setCurrentTime).toHaveBeenLastCalledWith(11);
    expect(screen.getByText(SKIP_HINT)).toBeInTheDocument();

    await act(async () => handlers.ended({ seconds: 300, duration: 300 }));
    expect(reports().at(-1).position_seconds).toBe(300);
  });
});
