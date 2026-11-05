import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PDF_PROBLEM, PdfPager } from "./pdf-pager";

const pdf = vi.hoisted(() => ({ pages: 3, getDocument: vi.fn(), destroy: vi.fn(async () => {}) }));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: pdf.getDocument,
}));

const tracking = { enrollmentId: "e1", mediaId: "m1" };
let fetchMock: ReturnType<typeof vi.fn>;
let counted = 0;

function reports() {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).includes("media-progress"))
    .map(([, init]) => JSON.parse(init.body));
}

beforeEach(() => {
  counted = 0;
  pdf.pages = 3;
  pdf.getDocument.mockImplementation(() => ({
    promise: Promise.resolve({
      numPages: pdf.pages,
      destroy: pdf.destroy,
      getPage: async () => ({
        getViewport: () => ({ width: 600, height: 800 }),
        render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
      }),
    }),
  }));
  // The service's own rule: one page further at most.
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (!String(url).includes("media-progress")) {
      return new Response(new ArrayBuffer(8), { status: 200 });
    }
    const body = JSON.parse(String(init?.body));
    counted = Math.max(counted, Math.min(body.page, counted + 1));
    return new Response(
      JSON.stringify({ media_id: "m1", page: counted, page_count: body.page_count, finished: counted >= body.page_count }),
      { status: 200 },
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function opened(text = /Page 1 of 3/) {
  await screen.findByText(text);
  await waitFor(() => expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled());
}

describe("a PDF that has to be paged through", () => {
  it("counts the first page on sight, and each next one", async () => {
    const onFinished = vi.fn();
    render(<PdfPager src="/a.pdf" title="Handout" tracking={tracking} onFinished={onFinished} />);
    await opened();
    await waitFor(() => expect(reports()).toEqual([{ media_id: "m1", page: 1, page_count: 3 }]));

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await opened(/Page 2 of 3/);
    await waitFor(() => expect(reports()).toHaveLength(2));
    expect(reports()[1].page).toBe(2);
    expect(onFinished).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findByText(/Page 3 of 3/);
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
  });

  it("a one-page PDF is finished on sight", async () => {
    pdf.pages = 1;
    const onFinished = vi.fn();
    render(<PdfPager src="/a.pdf" title="Handout" tracking={tracking} onFinished={onFinished} />);
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  it("opens where the learner got to", async () => {
    counted = 2;
    render(<PdfPager src="/a.pdf" title="Handout" tracking={tracking} initialPage={2} />);
    await opened(/Page 2 of 3/);
    await waitFor(() => expect(reports()[0]).toEqual({ media_id: "m1", page: 2, page_count: 3 }));
    expect(reports()).toHaveLength(1);
  });

  it("going back over earlier pages reports nothing", async () => {
    counted = 2;
    render(<PdfPager src="/a.pdf" title="Handout" tracking={tracking} initialPage={2} />);
    await opened(/Page 2 of 3/);
    await waitFor(() => expect(reports()).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    await opened(/Page 1 of 3/);
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await opened(/Page 2 of 3/);
    expect(reports()).toHaveLength(1);
  });

  it("arrow keys turn the page", async () => {
    render(<PdfPager src="/a.pdf" title="Handout" tracking={tracking} />);
    await opened();
    fireEvent.keyDown(screen.getByRole("group", { name: "Handout" }), { key: "ArrowRight" });
    await screen.findByText(/Page 2 of 3/);
  });

  it("catches up when a report didn't get through", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<PdfPager src="/a.pdf" title="Handout" tracking={tracking} />);
      await opened();
      await waitFor(() => expect(counted).toBe(1));
      fetchMock.mockRejectedValueOnce(new Error("offline"));
      fireEvent.click(screen.getByRole("button", { name: /Next/ }));
      await opened(/Page 2 of 3/);
      expect(counted).toBe(1);
      await act(async () => void (await vi.advanceTimersByTimeAsync(5_000)));
      await waitFor(() => expect(counted).toBe(2));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("with nothing to track", () => {
  it("records nothing", async () => {
    render(<PdfPager src="/a.pdf" title="Handout" tracking={null} />);
    await opened();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await opened(/Page 2 of 3/);
    expect(reports()).toEqual([]);
  });
});

describe("when it won't open", () => {
  it("says so, for a file that's gone", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("", { status: 404 }));
    render(<PdfPager src="/a.pdf" title="Handout" tracking={tracking} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(PDF_PROBLEM);
  });

  it("says so, for a file that isn't really a PDF", async () => {
    pdf.getDocument.mockImplementation(() => ({ promise: Promise.reject(new Error("bad")) }));
    render(<PdfPager src="/a.pdf" title="Handout" tracking={tracking} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(PDF_PROBLEM);
  });
});
