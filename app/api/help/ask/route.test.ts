import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));

import { helpCorpus } from "@/lib/help/corpus";

import { POST } from "./route";

/**
 * The help assistant's proxy (#114): the question goes with the help
 * content's hash, the content itself only when the ai service asks for
 * it, and the answer streams straight back.
 */

const fetchMock = vi.fn();
const VERSION = createHash("sha256").update(helpCorpus(), "utf8").digest("hex");
const MESSAGES = [{ role: "user", content: "How do I release a flight?", page: { route: "/dispatch" } }];
const ANSWER = 'data: {"type":"text","text":"Open the packet."}\n\ndata: {"type":"done","stop_reason":"end_turn"}\n\n';

function ask(body: unknown = { messages: MESSAGES }) {
  return POST(
    new Request("https://app.example/api/help/ask", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function sent(call: number) {
  const [url, init] = fetchMock.mock.calls[call];
  return { url, init: init as RequestInit, body: JSON.parse(String((init as RequestInit).body)) };
}

const stream = () =>
  new Response(ANSWER, { status: 200, headers: { "Content-Type": "text/event-stream" } });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://gw.example");
  vi.stubGlobal("fetch", fetchMock);
  auth.mockResolvedValue({ access_token: "tok" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("POST /api/help/ask", () => {
  it("asks with the content's hash, and streams the answer back", async () => {
    fetchMock.mockResolvedValueOnce(stream());
    const response = await ask();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toBe(ANSWER);

    const { url, init, body } = sent(0);
    expect(url).toBe("https://gw.example/ai/help/ask");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(body).toEqual({ corpus_version: VERSION, messages: MESSAGES });
  });

  it("sends the content when the ai service doesn't hold it, then asks again", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ detail: "help_corpus_needed" }, { status: 409 }))
      .mockResolvedValueOnce(stream());
    const response = await ask();
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sent(0).body.corpus).toBeUndefined();
    expect(sent(1).body).toEqual({ corpus_version: VERSION, messages: MESSAGES, corpus: helpCorpus() });
  });

  it("passes a refusal on with its reason and when to try again", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ detail: "help_rate_limited" }, { status: 429, headers: { "Retry-After": "420" } }),
    );
    const response = await ask();
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("420");
    expect(await response.json()).toEqual({ error: "help_rate_limited" });
  });

  it("needs a session and a conversation", async () => {
    auth.mockResolvedValueOnce(null);
    expect((await ask()).status).toBe(401);
    expect((await ask("not json")).status).toBe(400);
    expect((await ask({ messages: "hello" })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
