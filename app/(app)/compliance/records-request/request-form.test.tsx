import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import type { DisclosureCategory } from "@/lib/api/reports";

import { RequestForm } from "./request-form";

/**
 * Recording a records request and producing its bundle.
 *
 * What needs pinning is the set of refusals, not the happy path: an
 * incomplete form must not be submittable, no category selection must
 * not mean everything, and a backend refusal must arrive as the
 * message the backend wrote rather than a status code.
 */

const CATEGORIES: DisclosureCategory[] = [
  {
    key: "flights",
    label: "Flight records",
    detail: "Every flight scheduled in the period.",
    filename: "flights.csv",
  },
  {
    key: "manifests",
    label: "Passenger and cargo manifests",
    detail: "One row per manifest line.",
    filename: "manifests.csv",
  },
];

const createObjectURL = vi.fn(() => "blob:records");
const revokeObjectURL = vi.fn();

/** Typed so `mock.calls[0][1]` is a RequestInit rather than an
 *  inferred empty tuple — the mock has to declare the parameters it
 *  will be inspected for. */
type FetchMock = (url: string, init: RequestInit) => Promise<Response>;

function zipResponse(over: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      "Content-Disposition": 'attachment; filename="records_faa_x.zip"',
      "X-Disclosure-Sha256": "abc123",
    }),
    blob: async () => new Blob(["zip"]),
    text: async () => "",
    ...over,
  } as Response;
}

beforeEach(() => {
  refresh.mockReset();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    writable: true,
    configurable: true,
  });
});

afterEach(() => vi.unstubAllGlobals());

function form() {
  render(<RequestForm categories={CATEGORIES} deadlineHours={48} />);
}

/** Everything the service requires, so a test can assert one omission
 *  at a time rather than re-typing the form. */
async function fill(
  user: ReturnType<typeof userEvent.setup>,
  omit: string[] = [],
) {
  if (!omit.includes("name")) {
    await user.type(screen.getByLabelText(/Requestor name/i), "A. Chen");
  }
  if (!omit.includes("received")) {
    await user.type(
      screen.getByLabelText(/Written request received/i),
      "2026-09-15T14:30",
    );
  }
  if (!omit.includes("reason")) {
    await user.type(
      screen.getByLabelText(/Reason given/i),
      "Surveillance of September operations.",
    );
  }
  if (!omit.includes("period")) {
    await user.type(screen.getByLabelText(/Period from/i), "2026-09-01");
    await user.type(screen.getByLabelText(/Period to/i), "2026-09-15");
  }
  if (!omit.includes("categories")) {
    await user.click(screen.getByRole("checkbox", { name: "Flight records" }));
  }
}

describe("what the form will not submit", () => {
  it("refuses an empty form", () => {
    form();
    expect(
      screen.getByRole("button", { name: /Produce and record/ }),
    ).toBeDisabled();
  });

  it("refuses a complete form with no records selected", async () => {
    // The one that matters most. Legacy's PRIA exporter substitutes
    // all eight sections when none are ticked, so an operator
    // intending to disclose two hands over eight.
    const user = userEvent.setup();
    form();
    await fill(user, ["categories"]);
    expect(
      screen.getByRole("button", { name: /Produce and record/ }),
    ).toBeDisabled();
  });

  it("refuses without the receipt time", async () => {
    // It is what the 48-hour commitment is measured from.
    const user = userEvent.setup();
    form();
    await fill(user, ["received"]);
    expect(
      screen.getByRole("button", { name: /Produce and record/ }),
    ).toBeDisabled();
  });

  it("refuses a reason too short to mean anything", async () => {
    const user = userEvent.setup();
    form();
    await fill(user, ["reason"]);
    await user.type(screen.getByLabelText(/Reason given/i), "audit");
    expect(
      screen.getByRole("button", { name: /Produce and record/ }),
    ).toBeDisabled();
  });

  it("says what is missing on hover", () => {
    form();
    expect(
      screen.getByRole("button", { name: /Produce and record/ }),
    ).toHaveAttribute("title", expect.stringContaining("at least one"));
  });

  it("enables once everything the service needs is there", async () => {
    const user = userEvent.setup();
    form();
    await fill(user);
    expect(
      screen.getByRole("button", { name: /Produce and record/ }),
    ).toBeEnabled();
  });
});

describe("the period", () => {
  it("bounds each date by the other", async () => {
    const user = userEvent.setup();
    form();
    await fill(user);
    expect(screen.getByLabelText(/Period from/i)).toHaveAttribute(
      "max",
      "2026-09-15",
    );
    expect(screen.getByLabelText(/Period to/i)).toHaveAttribute(
      "min",
      "2026-09-01",
    );
  });
});

describe("what the categories say for themselves", () => {
  it("renders each one's contents, not just its name", () => {
    // The person filling this in is deciding what leaves the building.
    form();
    expect(
      screen.getByText("Every flight scheduled in the period."),
    ).toBeInTheDocument();
    expect(screen.getByText("flights.csv")).toBeInTheDocument();
  });

  it("says selecting nothing is not shorthand for everything", () => {
    form();
    expect(
      screen.getByText(/Selecting nothing produces nothing/),
    ).toBeInTheDocument();
  });
});

describe("producing", () => {
  it("sends the scope and the selected categories", async () => {
    const fetchMock = vi.fn<FetchMock>(async () => zipResponse());
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    form();
    await fill(user);
    await user.click(
      screen.getByRole("button", { name: /Produce and record/ }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.requestor_name).toBe("A. Chen");
    expect(body.categories).toEqual(["flights"]);
    expect(body.period_start).toBe("2026-09-01");
    expect(body.aircraft_tail).toBeNull();
  });

  it("uppercases a registration and sends null when blank", async () => {
    const fetchMock = vi.fn<FetchMock>(async () => zipResponse());
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    form();
    await fill(user);
    await user.type(screen.getByLabelText(/Aircraft/i), "n100pa");
    await user.click(
      screen.getByRole("button", { name: /Produce and record/ }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.aircraft_tail).toBe("N100PA");
  });

  it("saves under the filename the service named", async () => {
    const anchors: HTMLAnchorElement[] = [];
    const create = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = create(tag);
      if (tag === "a") anchors.push(el as HTMLAnchorElement);
      return el;
    });
    vi.stubGlobal("fetch", vi.fn(async () => zipResponse()));
    const user = userEvent.setup();
    form();
    await fill(user);
    await user.click(
      screen.getByRole("button", { name: /Produce and record/ }),
    );
    await waitFor(() =>
      expect(anchors.at(-1)?.download).toBe("records_faa_x.zip"),
    );
    vi.mocked(document.createElement).mockRestore();
  });

  it("shows the archive hash so it can be matched to the log", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => zipResponse()));
    const user = userEvent.setup();
    form();
    await fill(user);
    await user.click(
      screen.getByRole("button", { name: /Produce and record/ }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("abc123");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the service's own refusal, not a status code", async () => {
    // The backend's messages are specific and actionable — an unknown
    // tail, a receipt in the future, a scope too large to produce
    // without truncating. Replacing them with "HTTP 404" throws away
    // the only useful thing in the response.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        zipResponse({
          ok: false,
          status: 404,
          text: async () =>
            JSON.stringify({
              detail:
                "No aircraft N404XX on this operator's fleet. Check the registration.",
            }),
        }),
      ),
    );
    const user = userEvent.setup();
    form();
    await fill(user);
    await user.click(
      screen.getByRole("button", { name: /Produce and record/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No aircraft N404XX",
    );
  });

  it("reports a validation refusal that arrives as a list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        zipResponse({
          ok: false,
          status: 422,
          text: async () =>
            JSON.stringify({ detail: [{ msg: "period_end is before period_start" }] }),
        }),
      ),
    );
    const user = userEvent.setup();
    form();
    await fill(user);
    await user.click(
      screen.getByRole("button", { name: /Produce and record/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "period_end is before period_start",
    );
  });

  it("says nothing was produced when the request could not be sent", async () => {
    // Not "try again" — the useful fact is that no bundle left and no
    // record was written, so the operator has not half-disclosed.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    const user = userEvent.setup();
    form();
    await fill(user);
    await user.click(
      screen.getByRole("button", { name: /Produce and record/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nothing was produced or recorded",
    );
  });

  it("releases the blob rather than holding the file until the tab closes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => zipResponse()));
    const user = userEvent.setup();
    form();
    await fill(user);
    await user.click(
      screen.getByRole("button", { name: /Produce and record/ }),
    );
    await waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:records"),
    );
  });
});
