import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/dispatch";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { AssistantProvider } from "./assistant-context";
import { AssistantWidget } from "./assistant-widget";

/**
 * Peregrine Assistant (#114): the launcher above the Safety button and the
 * chat it opens. The answer appears as it arrives; a question that gets no
 * answer comes back to the box with the reason; the conversation is the
 * layout's, so it outlives the window.
 */

const fetchMock = vi.fn();
let wide = true;

function App({ roles = ["dispatcher"], name = "Dana" }: { roles?: string[]; name?: string | null }) {
  return (
    <AssistantProvider name={name} roles={roles}>
      <AssistantWidget />
    </AssistantProvider>
  );
}

function events(...lines: object[]) {
  const bytes = new TextEncoder().encode(lines.map((l) => `data: ${JSON.stringify(l)}\n\n`).join(""));
  const cut = Math.floor(bytes.length / 2);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, cut));
      controller.enqueue(bytes.slice(cut));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

// The launcher is the button that controls the window; the window has a
// close button of its own with the same name while it is open.
const launcher = () => document.querySelector<HTMLElement>('[aria-controls="peregrine-assistant"]')!;
const openIt = () => fireEvent.click(launcher());

function askIt(question: string) {
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

beforeEach(() => {
  pathname = "/dispatch";
  wide = true;
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: wide, media: query }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("the launcher", () => {
  it("sits above the Safety button, and in the corner where Safety isn't shown", () => {
    const { unmount } = render(<App />);
    expect(launcher()).toHaveClass("bottom-[4.5rem]");
    expect(launcher()).toHaveTextContent("Ask AI");
    unmount();
    pathname = "/safety/reports/new";
    render(<App />);
    expect(launcher()).toHaveClass("bottom-6");
  });

  it("opens the chat and closes it again, from the launcher, the window or Escape", () => {
    render(<App />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openIt();
    expect(screen.getByRole("dialog", { name: "Peregrine Assistant" })).toBeInTheDocument();
    expect(launcher()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Your question")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openIt();
    const dialog = screen.getByRole("dialog", { name: "Peregrine Assistant" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close Peregrine Assistant" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("isn't there outside the staff layout", () => {
    const { container } = render(<AssistantWidget />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the chat", () => {
  it("greets by name and suggests what someone in that job asks", () => {
    render(<App roles={["pilot"]} name="Priya" />);
    openIt();
    expect(screen.getByTestId("assistant-welcome")).toHaveTextContent("Hi Priya, I'm Peregrine Assistant.");
    expect(screen.getByRole("button", { name: "How do I file a FRAT?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "How do I release a flight?" })).not.toBeInTheDocument();
  });

  it("answers as it streams, with links into the app, asked from the page underneath", async () => {
    fetchMock.mockResolvedValueOnce(
      events(
        { type: "text", text: "Open the flight on [Dispatch](/dispatch), " },
        { type: "text", text: "then press **Generate PDF**." },
        { type: "done", stop_reason: "end_turn" },
      ),
    );
    render(<App />);
    openIt();
    askIt("How do I release a flight?");
    expect(await screen.findByRole("link", { name: "Dispatch" })).toHaveAttribute("href", "/dispatch");
    expect(screen.getByText("Generate PDF").tagName).toBe("STRONG");
    expect(screen.getByTestId("assistant-turn-user")).toHaveTextContent("How do I release a flight?");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: "user", content: "How do I release a flight?", page: { route: "/dispatch", title: "Dispatch" } },
    ]);
  });

  it("asks a suggested question, follows up with the conversation so far, and starts over", async () => {
    fetchMock
      .mockResolvedValueOnce(events({ type: "text", text: "Open it." }, { type: "done", stop_reason: "end_turn" }))
      .mockResolvedValueOnce(events({ type: "text", text: "Ask dispatch." }, { type: "done", stop_reason: "end_turn" }));
    render(<App />);
    openIt();
    fireEvent.click(screen.getByRole("button", { name: "Why won't my flight release?" }));
    await screen.findByText("Open it.");
    askIt("And if it's the weather?");
    await screen.findByText("Ask dispatch.");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages.map((m: { role: string }) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    await waitFor(() => expect(screen.getByTestId("assistant-welcome")).toBeInTheDocument());
  });

  it("keeps the conversation when the window closes and opens again", async () => {
    fetchMock.mockResolvedValueOnce(events({ type: "text", text: "Kept." }, { type: "done", stop_reason: "end_turn" }));
    render(<App />);
    openIt();
    askIt("Q?");
    await screen.findByText("Kept.");
    fireEvent.click(launcher());
    openIt();
    expect(screen.getByText("Kept.")).toBeInTheDocument();
  });

  it("starts the answer over when a fallback takes over", async () => {
    fetchMock.mockResolvedValueOnce(
      events(
        { type: "text", text: "Half an ans" },
        { type: "reset" },
        { type: "text", text: "The whole answer." },
        { type: "done", stop_reason: "end_turn" },
      ),
    );
    render(<App />);
    openIt();
    askIt("Q?");
    await screen.findByText("The whole answer.");
    expect(screen.queryByText(/Half an ans/)).not.toBeInTheDocument();
  });

  it("puts a question that got no answer back in the box, with the reason", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ error: "help_rate_limited" }, { status: 429, headers: { "Retry-After": "420" } }))
      .mockResolvedValueOnce(events({ type: "text", text: "Open " }, { type: "error", code: "anthropic_timeout" }))
      .mockResolvedValueOnce(events({ type: "refusal" }));
    render(<App />);
    openIt();
    askIt("Q1");
    expect(await screen.findByText(/Ask again in 7 minutes/)).toBeInTheDocument();
    expect(screen.getByLabelText("Your question")).toHaveValue("Q1");
    expect(screen.queryByTestId("assistant-turn-user")).not.toBeInTheDocument();
    askIt("Q2");
    expect(await screen.findByText(/took too long/)).toBeInTheDocument();
    askIt("Q3");
    expect(await screen.findByText(/can't answer that one/)).toBeInTheDocument();
  });

  it("tells a signed-out reader to sign in", async () => {
    const signIn = new Response("<html>Sign in</html>", { status: 200, headers: { "Content-Type": "text/html" } });
    Object.defineProperty(signIn, "redirected", { value: true });
    fetchMock.mockResolvedValueOnce(signIn);
    render(<App />);
    openIt();
    askIt("Q?");
    expect(await screen.findByText(/session expired/)).toBeInTheDocument();
  });

  it("sends one question at a time", async () => {
    fetchMock.mockResolvedValue(events({ type: "text", text: "Once." }, { type: "done", stop_reason: "end_turn" }));
    render(<App />);
    openIt();
    const box = screen.getByLabelText("Your question");
    fireEvent.change(box, { target: { value: "Q?" } });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByText("Once.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stays open beside the page on a desktop, and gives a phone its screen back", async () => {
    fetchMock.mockResolvedValue(
      events({ type: "text", text: "See [Dispatch](/dispatch)." }, { type: "done", stop_reason: "end_turn" }),
    );
    render(<App />);
    openIt();
    askIt("Where?");
    const follow = async () => {
      const link = await screen.findByRole("link", { name: "Dispatch" });
      link.addEventListener("click", (e) => e.preventDefault());
      fireEvent.click(link);
    };
    await follow();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    wide = false;
    await follow();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
