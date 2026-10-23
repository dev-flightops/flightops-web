import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AskPanel } from "./ask-panel";
import { useHelpChat } from "./use-help-chat";

/**
 * Ask, in the help panel (#114): the answer appears as it arrives, and
 * a question that gets no answer comes back to the box with the reason.
 */

const fetchMock = vi.fn();
const PAGE = { route: "/dispatch", title: "Dispatch" };

function Harness({ onNavigate = () => {} }: { onNavigate?: () => void }) {
  const chat = useHelpChat();
  return <AskPanel chat={chat} page={PAGE} onNavigate={onNavigate} />;
}

function events(...lines: object[]) {
  const text = lines.map((line) => `data: ${JSON.stringify(line)}\n\n`).join("");
  const bytes = new TextEncoder().encode(text);
  // Cut mid-event, as the network does.
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

function askIt(question: string) {
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("AskPanel", () => {
  it("answers, with links to pages, and sends the page asked from", async () => {
    fetchMock.mockResolvedValueOnce(
      events(
        { type: "text", text: "Open the flight on [Dispatch](/dispatch), " },
        { type: "text", text: "then press **Generate PDF**." },
        { type: "done", stop_reason: "end_turn" },
      ),
    );
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} />);
    askIt("How do I release a flight?");

    const link = await screen.findByRole("link", { name: "Dispatch" });
    expect(screen.getByText("Generate PDF").tagName).toBe("STRONG");
    // jsdom can't navigate; following the link is what matters here.
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalled();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/help/ask");
    expect(JSON.parse(init.body)).toEqual({
      messages: [{ role: "user", content: "How do I release a flight?", page: PAGE }],
    });
  });

  it("sends the conversation so far with a follow-up", async () => {
    fetchMock
      .mockResolvedValueOnce(events({ type: "text", text: "Open it." }, { type: "done", stop_reason: "end_turn" }))
      .mockResolvedValueOnce(events({ type: "text", text: "Ask dispatch." }, { type: "done", stop_reason: "end_turn" }));
    render(<Harness />);
    askIt("How do I release?");
    await screen.findByText("Open it.");
    askIt("And if it's refused?");
    await screen.findByText("Ask dispatch.");

    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(second.messages).toEqual([
      { role: "user", content: "How do I release?", page: PAGE },
      { role: "assistant", content: "Open it." },
      { role: "user", content: "And if it's refused?", page: PAGE },
    ]);
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
    render(<Harness />);
    askIt("Q?");
    await screen.findByText("The whole answer.");
    expect(screen.queryByText(/Half an ans/)).not.toBeInTheDocument();
  });

  it("puts a question that got no answer back in the box, with the reason", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: "help_rate_limited" }, { status: 429, headers: { "Retry-After": "420" } }),
    );
    render(<Harness />);
    askIt("How do I file a FRAT?");
    expect(await screen.findByText(/Ask again in 7 minutes/)).toBeInTheDocument();
    expect(screen.getByLabelText("Your question")).toHaveValue("How do I file a FRAT?");
    expect(screen.queryByTestId("ask-turn-user")).not.toBeInTheDocument();
  });

  it("says so when the answer fails part-way or is declined", async () => {
    fetchMock
      .mockResolvedValueOnce(events({ type: "text", text: "Open " }, { type: "error", code: "anthropic_timeout" }))
      .mockResolvedValueOnce(events({ type: "refusal" }));
    render(<Harness />);
    askIt("Q1");
    expect(await screen.findByText(/took too long/)).toBeInTheDocument();
    askIt("Q2");
    expect(await screen.findByText(/can't answer that one/)).toBeInTheDocument();
    expect(screen.getByLabelText("Your question")).toHaveValue("Q2");
  });

  it("tells a signed-out reader to sign in, not that the answer broke", async () => {
    const signIn = new Response("<html>Sign in</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
    Object.defineProperty(signIn, "redirected", { value: true });
    fetchMock.mockResolvedValueOnce(signIn);
    render(<Harness />);
    askIt("Q?");
    expect(await screen.findByText(/session expired/)).toBeInTheDocument();
  });

  it("starts from a suggested question, and starts over", async () => {
    fetchMock.mockResolvedValueOnce(events({ type: "text", text: "Steps." }, { type: "done", stop_reason: "end_turn" }));
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Why won't my flight release?" }));
    await screen.findByText("Steps.");
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    await waitFor(() => expect(screen.getByTestId("ask-empty")).toBeInTheDocument());
  });
});
